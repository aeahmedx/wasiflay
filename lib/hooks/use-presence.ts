"use client";

import { useEffect, useMemo, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * Live headcount for a room. Independent of the message channel so that
 * a presence failure never takes messages down with it.
 * Returns null when presence is unavailable — render nothing rather than 0.
 */
export function usePresenceCount(roomId: string, userId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;

    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    channel = supabase.channel(`presence:${roomId}`, {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        if (cancelled || !channel) return;
        setCount(Object.keys(channel.presenceState()).length);
      })
      .subscribe(async (status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          await channel?.track({ at: Date.now() });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setCount(null);
        }
      });

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [roomId, userId, supabase]);

  return count;
}
