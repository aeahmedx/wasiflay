"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getOpenReportCount } from "@/lib/queries/moderation";

/**
 * The open-report count, live. Split out from the old header counts
 * component now that the Activity badge lives on the tab bar — two
 * components subscribing to the same notifications table was wasteful.
 *
 * Seeded from the server so there's no flash of a wrong number.
 */
export function ModBadge({
  isStaff,
  initialReports,
}: {
  isStaff: boolean;
  initialReports: number;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [reports, setReports] = useState(initialReports);

  const refresh = useCallback(async () => {
    setReports(await getOpenReportCount(supabase));
  }, [supabase]);

  useEffect(() => {
    if (!isStaff) return;

    let channel: RealtimeChannel | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    channel = supabase
      .channel("mod-badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reports" },
        () => {
          // Coalesce bursts: fifty reports at once is one refetch.
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => void refresh(), 400);
        }
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, isStaff, refresh]);

  if (!isStaff) return null;

  return (
    <Link
      href="/mod"
      className="text-sm text-emerald-800 underline underline-offset-4"
    >
      {reports > 0 ? `Mod (${reports})` : "Mod"}
    </Link>
  );
}
