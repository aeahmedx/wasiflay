"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { announceIfOffline } from "@/lib/offline";
import {
  addReaction,
  buildReactionMap,
  getRoomReactions,
  removeReaction,
  type Emoji,
  type Reaction,
  type ReactionMap,
} from "@/lib/queries/reactions";

const POLL_INTERVAL_MS = 8000;

/**
 * Reactions live on their own channel, separate from messages. If the
 * reaction channel fails, chat keeps working — a reaction count is worth
 * far less than a message.
 */
export function useReactions(roomId: string, userId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Reaction[]>([]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const map: ReactionMap = useMemo(
    () => buildReactionMap(rows, userId),
    [rows, userId]
  );

  const refresh = useCallback(async () => {
    try {
      setRows(await getRoomReactions(supabase, roomId));
    } catch {
      // Non-critical. The next tick retries.
    }
  }, [supabase, roomId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    channel = supabase
      .channel(`reactions:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_reactions",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as Reaction;
          if (!row.id || cancelled) return;
          setRows((current) =>
            current.some((r) => r.id === row.id) ? current : [...current, row]
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "message_reactions",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const old = payload.old as Partial<Reaction>;
          if (!old.id || cancelled) return;
          setRows((current) => current.filter((r) => r.id !== old.id));
        }
      )
      .subscribe((status) => {
        if (cancelled) return;
        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          if (!poll) poll = setInterval(() => void refresh(), POLL_INTERVAL_MS);
        } else if (status === "SUBSCRIBED" && poll) {
          clearInterval(poll);
          poll = null;
          void refresh();
        }
      });

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [roomId, supabase, refresh]);

  /** Optimistic toggle, rolled back on failure. */
  const toggle = useCallback(
    async (messageId: string, emoji: Emoji) => {
      if (!userId) return;

      // Same reasoning as the helpful button: an optimistic pill that
      // appears and vanishes reads as a bug.
      if (announceIfOffline()) return;

      const existing = rowsRef.current.find(
        (r) =>
          r.message_id === messageId &&
          r.user_id === userId &&
          r.emoji === emoji
      );

      if (existing) {
        setRows((c) => c.filter((r) => r.id !== existing.id));
        try {
          await removeReaction(supabase, messageId, userId, emoji);
        } catch {
          setRows((c) => [...c, existing]);
        }
        return;
      }

      const optimistic: Reaction = {
        id: `temp-${messageId}-${emoji}-${Date.now()}`,
        message_id: messageId,
        room_id: roomId,
        user_id: userId,
        emoji,
      };
      setRows((c) => [...c, optimistic]);

      try {
        await addReaction(supabase, messageId, userId, emoji);
        // The realtime INSERT carries the real row; drop the placeholder.
        setRows((c) => c.filter((r) => r.id !== optimistic.id));
        void refresh();
      } catch {
        setRows((c) => c.filter((r) => r.id !== optimistic.id));
      }
    },
    [supabase, userId, roomId, refresh]
  );

  return { reactions: map, toggle };
}
