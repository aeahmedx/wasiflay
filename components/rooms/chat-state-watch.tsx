"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ChatState } from "@/lib/queries/messages";

/** Often enough to feel immediate, rare enough to be free. */
const POLL_MS = 8000;

/**
 * Keeps a room's open/closed state honest.
 *
 * Two transitions have no event to listen for:
 *
 *   kickoff — the room opens because time moved; no row changes
 *   result  — the match row changes, but the room's own state is
 *             computed, so nothing tells the room anything
 *
 * Realtime on the match covers the second one when it's working. This
 * exists because "when it's working" isn't good enough for the thing
 * that decides whether hundreds of people can talk during a match. A
 * poll costs one cheap function call every eight seconds and cannot
 * fail quietly.
 *
 * It only refreshes when the answer actually differs from what's on
 * screen, so a steady state costs nothing but the query.
 */
export function ChatStateWatch({
  roomId,
  current,
}: {
  roomId: string;
  current: ChatState;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  /**
   * `current` is in the dependencies rather than held in a ref.
   *
   * A ref would avoid rebuilding the interval, but assigning to one
   * during render is exactly what React tells you not to do — and the
   * saving is imaginary: chat_state changes about three times in a
   * match, so the interval is rebuilt three times.
   */
  useEffect(() => {
    let cancelled = false;

    async function check() {
      const { data, error } = await supabase.rpc("room_chat_state", {
        p_room: roomId,
      });
      if (cancelled || error) return;

      const next = data as ChatState | null;
      if (next && next !== current) {
        router.refresh();
      }
    }

    const timer = setInterval(() => void check(), POLL_MS);

    // The tab coming back into view is the other moment the answer is
    // likely stale — someone returns to the room after the match ended.
    function onVisible() {
      if (document.visibilityState === "visible") void check();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [supabase, roomId, router, current]);

  return null;
}
