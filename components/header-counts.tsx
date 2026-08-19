"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getUnreadCount } from "@/lib/queries/notifications";
import { getOpenReportCount } from "@/lib/queries/moderation";

/**
 * Server-rendered counts are correct exactly once — at render. The mod
 * badge sat stale until a full refresh, which is useless during an event
 * when reports arrive while you're looking at the page.
 *
 * Seeded from the server so there's no flash of a wrong number, then
 * kept current over realtime.
 */
export function HeaderCounts({
  userId,
  isStaff,
  initialUnread,
  initialReports,
}: {
  userId: string;
  isStaff: boolean;
  initialUnread: number;
  initialReports: number;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [unread, setUnread] = useState(initialUnread);
  const [reports, setReports] = useState(initialReports);

  const refreshUnread = useCallback(async () => {
    setUnread(await getUnreadCount(supabase));
  }, [supabase]);

  const refreshReports = useCallback(async () => {
    if (!isStaff) return;
    setReports(await getOpenReportCount(supabase));
  }, [supabase, isStaff]);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const bump = (fn: () => Promise<void>) => {
      // Coalesce bursts: fifty reports arriving at once is one refetch.
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void fn(), 400);
    };

    channel = supabase.channel(`header:${userId}`);

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      () => bump(refreshUnread)
    );

    if (isStaff) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reports" },
        () => bump(refreshReports)
      );
    }

    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, userId, isStaff, refreshUnread, refreshReports]);

  return (
    <>
      <Link
        href="/notifications"
        className="text-sm text-emerald-800 underline underline-offset-4"
      >
        {unread > 0 ? `Activity (${unread})` : "Activity"}
      </Link>
      {isStaff && (
        <Link
          href="/mod"
          className="text-sm text-emerald-800 underline underline-offset-4"
        >
          {reports > 0 ? `Mod (${reports})` : "Mod"}
        </Link>
      )}
    </>
  );
}
