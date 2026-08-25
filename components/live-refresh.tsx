"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * How often to refresh regardless of what realtime says. Frequent
 * enough that a missed event is never noticed, rare enough to be free.
 */
const POLL_MS = 15000;

/**
 * Keeps a server-rendered page current.
 *
 * Two mechanisms, deliberately:
 *
 *   Realtime is the fast path. A result entered at the side of a pitch
 *   reaches every open screen in well under a second.
 *
 *   The poll is the guarantee. Realtime has failed silently in this app
 *   before — a subscription to a table that wasn't in the publication
 *   listened to nothing for weeks and nobody could tell. During a
 *   tournament, "usually works" is not a property worth having.
 *
 * The poll only runs while the tab is visible, so a phone in a pocket
 * costs nothing, and it fires immediately when the tab comes back —
 * which is the moment the screen is most likely to be stale.
 */
export function LiveRefresh({
  watch,
  debounceMs = 400,
  pollMs = POLL_MS,
}: {
  /** Tables and filters to watch, in Supabase's filter syntax. */
  watch: { table: string; filter?: string }[];
  debounceMs?: number;
  /** 0 disables the backstop. Only sensible where nothing can change. */
  pollMs?: number;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // Serialised so the effect doesn't re-subscribe on every render just
  // because the caller passed a fresh array literal.
  const key = JSON.stringify(watch);

  useEffect(() => {
    const targets = JSON.parse(key) as { table: string; filter?: string }[];

    let debounce: ReturnType<typeof setTimeout> | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    function refreshSoon() {
      // A moderator entering a result fires several changes at once;
      // one refresh covers all of them.
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => router.refresh(), debounceMs);
    }

    const channel =
      targets.length > 0 ? supabase.channel(`live:${key}`) : null;

    if (channel) {
      for (const target of targets) {
        channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: target.table,
            ...(target.filter ? { filter: target.filter } : {}),
          },
          refreshSoon
        );
      }
      channel.subscribe();
    }

    function startPolling() {
      if (poll || pollMs <= 0) return;
      poll = setInterval(() => {
        if (document.visibilityState === "visible") router.refresh();
      }, pollMs);
    }

    function stopPolling() {
      if (poll) {
        clearInterval(poll);
        poll = null;
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        // Coming back is when the screen is most likely to be stale.
        router.refresh();
        startPolling();
      } else {
        stopPolling();
      }
    }

    if (document.visibilityState === "visible") startPolling();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (debounce) clearTimeout(debounce);
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibility);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, router, key, debounceMs, pollMs]);

  return null;
}
