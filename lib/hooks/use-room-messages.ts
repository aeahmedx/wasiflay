"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  getAuthors,
  getMessagesSince,
  type Author,
  type Message,
} from "@/lib/queries/messages";

export type ConnectionState = "connecting" | "live" | "polling";

/** How long to wait for the socket before giving up and polling. */
const SUBSCRIBE_TIMEOUT_MS = 8000;
const POLL_INTERVAL_MS = 5000;
/** Occasionally retry realtime while polling, in case the network recovers. */
const REALTIME_RETRY_MS = 60000;

export type PendingMessage = {
  tempId: string;
  body: string;
  failed: boolean;
};

export function useRoomMessages(
  roomId: string,
  initial: Message[],
  blockedIds: string[] = []
) {
  const supabase = useMemo(() => createClient(), []);
  // Realtime events arrive straight from the table, bypassing the
  // public_messages view — so blocking has to be applied here too, or a
  // blocked person's messages reappear live and vanish on refresh.
  const blocked = useMemo(() => new Set(blockedIds), [blockedIds]);

  const [messages, setMessages] = useState<Message[]>(initial);
  const [authors, setAuthors] = useState<Record<string, Author>>({});
  const [connection, setConnection] = useState<ConnectionState>("connecting");

  // Refs so timers and callbacks never read stale state.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const authorsRef = useRef(authors);
  authorsRef.current = authors;

  /** Insert, ignoring anything already held. Keeps chronological order. */
  const mergeMessages = useCallback((incoming: Message[]) => {
    if (incoming.length === 0) return;
    setMessages((current) => {
      const seen = new Set(current.map((m) => m.id));
      const added = incoming.filter((m) => !seen.has(m.id));
      if (added.length === 0) return current;
      return [...current, ...added].sort((a, b) =>
        a.created_at.localeCompare(b.created_at)
      );
    });
  }, []);

  /** Fetch any author we don't already have cached. */
  const ensureAuthors = useCallback(
    async (list: Message[]) => {
      const missing = Array.from(
        new Set(
          list.map((m) => m.author_id).filter((id) => !authorsRef.current[id])
        )
      );
      if (missing.length === 0) return;

      try {
        const fetched = await getAuthors(supabase, missing);
        setAuthors((current) => {
          const next = { ...current };
          fetched.forEach((a) => (next[a.id] = a));
          return next;
        });
      } catch {
        // Names degrade to "Someone". Not worth surfacing.
      }
    },
    [supabase]
  );

  useEffect(() => {
    void ensureAuthors(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void ensureAuthors(messages);
  }, [messages, ensureAuthors]);

  // ---- realtime subscription with polling fallback -------------------
  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let subscribeTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let polling = false;

    const lastTimestamp = () => {
      const list = messagesRef.current;
      return list.length > 0
        ? list[list.length - 1].created_at
        : new Date(Date.now() - 60_000).toISOString();
    };

    async function pollOnce() {
      try {
        const fresh = await getMessagesSince(supabase, roomId, lastTimestamp());
        if (!cancelled) mergeMessages(fresh);
      } catch {
        // Transient. The next tick tries again.
      }
    }

    function startPolling() {
      if (polling || cancelled) return;
      polling = true;
      setConnection("polling");
      void pollOnce();
      pollTimer = setInterval(pollOnce, POLL_INTERVAL_MS);
      // Periodically attempt to get realtime back.
      retryTimer = setTimeout(() => {
        if (cancelled) return;
        stopPolling();
        connect();
      }, REALTIME_RETRY_MS);
    }

    function stopPolling() {
      polling = false;
      if (pollTimer) clearInterval(pollTimer);
      if (retryTimer) clearTimeout(retryTimer);
      pollTimer = null;
      retryTimer = null;
    }

    function connect() {
      if (cancelled) return;
      setConnection("connecting");

      channel = supabase
        .channel(`room:${roomId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => {
            const row = payload.new as Message;
            if (!row.id || blocked.has(row.author_id)) return;
            mergeMessages([row]);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => {
            // A moderator removing a message must clear it from every
            // screen already in the room, not just on next reload.
            const row = payload.new as Message & { is_removed?: boolean };
            if (!row.id) return;
            if (row.is_removed) {
              setMessages((current) => current.filter((m) => m.id !== row.id));
            } else {
              setMessages((current) =>
                current.map((m) => (m.id === row.id ? { ...m, ...row } : m))
              );
            }
          }
        )
        .subscribe((status) => {
          if (cancelled) return;

          if (status === "SUBSCRIBED") {
            if (subscribeTimer) clearTimeout(subscribeTimer);
            stopPolling();
            setConnection("live");
            // Close the gap between initial load and subscription.
            void pollOnce();
            return;
          }

          if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            startPolling();
          }
        });

      // The socket can hang without ever reporting an error.
      subscribeTimer = setTimeout(() => {
        if (!cancelled && !polling) startPolling();
      }, SUBSCRIBE_TIMEOUT_MS);
    }

    connect();

    return () => {
      cancelled = true;
      stopPolling();
      if (subscribeTimer) clearTimeout(subscribeTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [roomId, supabase, mergeMessages, blocked]);

  return { messages, authors, connection, mergeMessages };
}
