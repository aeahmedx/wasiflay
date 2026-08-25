"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Keeps a server-rendered page current.
 *
 * Realtime works well inside the room because the room holds its
 * messages in client state. A server-rendered page has no such state —
 * so when a moderator removes a post, the person reading it carries on
 * reading something that no longer exists, and only finds out when they
 * navigate.
 *
 * This subscribes to the rows that page is built from and calls
 * router.refresh() when any of them change. The server re-renders,
 * which is also how a deleted post becomes a 404 rather than a ghost.
 *
 * Deliberately not a data subscription: it fetches nothing and holds
 * nothing. It only knows that something changed, and lets the page it
 * sits on decide what that means.
 */
export function LiveRefresh({
  watch,
  debounceMs = 400,
}: {
  /** Tables and filters to watch, in Supabase's filter syntax. */
  watch: { table: string; filter?: string }[];
  debounceMs?: number;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // Serialised so the effect doesn't re-subscribe on every render just
  // because the caller passed a fresh array literal.
  const key = JSON.stringify(watch);

  useEffect(() => {
    const targets = JSON.parse(key) as { table: string; filter?: string }[];
    if (targets.length === 0) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase.channel(`live:${key}`);

    for (const target of targets) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: target.table,
          ...(target.filter ? { filter: target.filter } : {}),
        },
        () => {
          // A moderator removing a post and its answers fires several
          // changes at once; one refresh covers all of them.
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => router.refresh(), debounceMs);
        }
      );
    }

    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [supabase, router, key, debounceMs]);

  return null;
}
