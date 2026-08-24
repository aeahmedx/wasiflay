"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  getLeaderboard,
  getMyStanding,
  type LeaderRow,
  type Standing,
} from "@/lib/queries/predictions";

/**
 * The board, live.
 *
 * Only the top is listed. A phone can't usefully show two hundred rows,
 * and nobody reads past about twenty anyway — what people actually want
 * is the top, their own position, and how far off the next place they
 * are. Anyone outside the listed range gets their own row pinned
 * underneath instead.
 */
export function LeaderboardView({
  initialRows,
  initialStanding,
}: {
  initialRows: LeaderRow[];
  initialStanding: Standing | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState(initialRows);
  const [standing, setStanding] = useState(initialStanding);

  const refresh = useCallback(async () => {
    const [next, mine] = await Promise.all([
      getLeaderboard(supabase, 25),
      getMyStanding(supabase),
    ]);
    setRows(next);
    setStanding(mine);
  }, [supabase]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Results land in bursts — one match scores every prediction on it
    // at once — so a short debounce turns a hundred row changes into
    // one refetch.
    const channel = supabase
      .channel("leaderboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "predictions" },
        () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => void refresh(), 600);
        }
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [supabase, refresh]);

  const inList = rows.some((r) => r.is_me);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-stone-200 bg-stone-0 px-4 py-8 text-center">
        <p className="text-stone-600">
          Nobody has scored yet. Make a pick and you&apos;ll be on here.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-lg bg-emerald-800 px-4 py-2.5 font-medium text-stone-0"
        >
          Find a match
        </Link>
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li
            key={r.user_id}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
              r.is_me
                ? "border-emerald-800 bg-emerald-50"
                : "border-stone-200 bg-stone-0"
            }`}
          >
            <span className="w-7 shrink-0 text-right text-sm font-semibold tabular-nums text-stone-500">
              {r.rank}
            </span>

            <Link
              href={`/profile/${r.user_id}`}
              className="min-w-0 flex-1 truncate font-medium text-stone-900"
              dir="auto"
            >
              {r.display_name}
              {r.is_me && (
                <span className="ml-1.5 text-xs font-normal text-emerald-800">
                  you
                </span>
              )}
            </Link>

            {r.exact_count > 0 && (
              <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">
                {r.exact_count} exact
              </span>
            )}

            <span className="w-10 shrink-0 text-right font-semibold tabular-nums text-stone-900">
              {r.points}
            </span>
          </li>
        ))}
      </ul>

      {/* Outside the listed range — pinned so there's always a row that
          is yours, and always a gap to close. */}
      {!inList && standing && standing.played > 0 && (
        <>
          <p className="my-2 text-center text-sm text-stone-400">···</p>
          <div className="flex items-center gap-3 rounded-lg border border-emerald-800 bg-emerald-50 px-3 py-2.5">
            <span className="w-7 shrink-0 text-right text-sm font-semibold tabular-nums text-stone-500">
              {standing.rank}
            </span>
            <span className="min-w-0 flex-1 font-medium text-stone-900">
              You
            </span>
            <span className="w-10 shrink-0 text-right font-semibold tabular-nums text-stone-900">
              {standing.points}
            </span>
          </div>
        </>
      )}

      {standing && standing.played > 0 && standing.gap_above > 0 && (
        <p className="mt-3 text-center text-sm text-stone-600">
          {standing.gap_above}{" "}
          {standing.gap_above === 1 ? "point" : "points"} off the place above.
        </p>
      )}

      {standing && standing.rank === 1 && (
        <p className="mt-3 text-center text-sm font-medium text-emerald-800">
          You&apos;re top. Stay there.
        </p>
      )}
    </>
  );
}
