"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCountdown, useCountdown } from "@/lib/hooks/use-now";
import type { Match, Standing } from "@/lib/queries/predictions";
import { PredictForm } from "@/components/matches/predict-form";

const HEADLINE: Record<string, string> = {
  exact: "Called it exactly",
  margin: "Right winner and margin",
  winner: "Called the winner",
  goals: "Right total goals",
  none: "No points",
};

/**
 * The tournament, on the home screen.
 *
 * The size problem is solved by the schedule's own shape: four fields
 * run at once, so a "next match" is really a next *slot* of four. The
 * block shows at most one slot — which means at most four live rows and
 * four upcoming ones, whether the weekend holds eight fixtures or
 * eighty. It cannot grow, and it cannot miss anything, because the full
 * list lives on /matches and is one tap away.
 *
 * What it shows follows the moment rather than the schedule:
 *
 *   nothing at all      renders nothing
 *   before kickoff      the next slot, pickable
 *   during a match      what's playing, with rooms; the next slot folded
 *   just after          the result, then the next slot
 *   weekend over        the final, and the board
 */
export function TournamentBlock({
  result,
  live,
  nextSlot,
  upcomingCount,
  standing,
  userId,
  startCollapsed = false,
}: {
  result: Match | null;
  /** Everything being played right now. Capped by reality at four. */
  live: Match[];
  /** Every fixture sharing the next kickoff. Also four. */
  nextSlot: Match[];
  /** Everything still to come, for the link out. */
  upcomingCount: number;
  standing: Standing | null;
  userId: string | null;
  startCollapsed?: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [collapsed, setCollapsed] = useState(startCollapsed);
  const [picking, setPicking] = useState<string | null>(null);
  const [justPicked, setJustPicked] = useState<Record<string, [number, number]>>(
    {}
  );

  const isLive = live.length > 0;
  const slotKickoff = nextSlot[0]?.kicks_off_at ?? null;
  const left = useCountdown(slotKickoff);

  /**
   * A lock or a result has to reach people already looking at this.
   * Predictions too — the counts and the standing move without any
   * match itself changing.
   */
  useEffect(() => {
    const channel = supabase
      .channel("tournament-block")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "predictions" },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, router]);

  if (!result && live.length === 0 && nextSlot.length === 0) return null;

  const kickedOff = left !== null && left <= 0;

  function pickOf(match: Match): [number, number] | null {
    const local = justPicked[match.id];
    if (local) return local;
    if (match.my_home !== null && match.my_away !== null) {
      return [match.my_home, match.my_away];
    }
    return null;
  }

  function collapse() {
    if (result) {
      document.cookie = `wl_seen_result=${result.id}; path=/; max-age=${
        60 * 60 * 24
      }; SameSite=Lax`;
    }
    setCollapsed(true);
    // The cookie alone isn't enough — navigating back would serve a
    // payload rendered before it existed.
    router.refresh();
  }

  // ---- collapsed -------------------------------------------------
  if (collapsed) {
    const summary = isLive
      ? live.length > 1
        ? `${live.length} matches on now`
        : `${live[0].home_team} v ${live[0].away_team}`
      : nextSlot.length > 0
      ? nextSlot.length > 1
        ? `${nextSlot.length} matches next`
        : `${nextSlot[0].home_team} v ${nextSlot[0].away_team}`
      : result
      ? `${result.home_team} ${result.home_score}\u2013${result.away_score} ${result.away_team}`
      : "";

    return (
      <button
        onClick={() => setCollapsed(false)}
        className="mb-4 flex w-full items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-left"
      >
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-amber-900">
          {isLive ? "Live" : "Tournament"}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-stone-800" dir="auto">
          {summary}
        </span>
        {standing && standing.played > 0 && (
          <span className="shrink-0 text-sm font-semibold tabular-nums text-stone-900">
            #{standing.rank}
          </span>
        )}
      </button>
    );
  }

  const slotTime = slotKickoff
    ? new Date(slotKickoff).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  return (
    <section className="mb-5 overflow-hidden rounded-lg border border-amber-300 bg-amber-50">
      {/* --- what just finished ------------------------------------ */}
      {result && (
        <div className="border-b border-amber-200 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">
                Full time
              </p>
              <Link
                href={`/matches/${result.id}`}
                className="mt-0.5 block font-semibold text-stone-900 underline decoration-stone-400 underline-offset-4"
                dir="auto"
              >
                {result.home_team} {result.home_score}
                {"\u2013"}
                {result.away_score} {result.away_team}
              </Link>
              {result.my_tier ? (
                <p className="mt-0.5 text-sm text-stone-700">
                  {HEADLINE[result.my_tier]} · you said {result.my_home}
                  {"\u2013"}
                  {result.my_away}
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-stone-600">
                  You had no pick on this one.
                </p>
              )}
            </div>

            {(result.my_points ?? 0) > 0 && (
              <span className="shrink-0 rounded-full bg-emerald-800 px-3 py-1 text-sm font-semibold text-stone-0">
                +{result.my_points}
              </span>
            )}
          </div>

          {(result.my_points ?? 0) > 0 && (
            <div className="mt-2 flex items-center gap-3">
              <Link
                href={`/create?type=announcement&q=${encodeURIComponent(
                  result.my_tier === "exact"
                    ? `Called it: ${result.home_team} ${result.home_score}\u2013${result.away_score} ${result.away_team}`
                    : `${result.home_team} ${result.home_score}\u2013${result.away_score} ${result.away_team} — I said ${result.my_home}\u2013${result.my_away}`
                )}`}
                className="rounded-lg bg-amber-400 px-3.5 py-1.5 text-sm font-semibold text-on-brand"
              >
                {result.my_tier === "exact" ? "Post it" : "Say something"}
              </Link>
              <Link
                href={`/matches/${result.id}`}
                className="text-sm text-stone-700 underline underline-offset-4"
              >
                See who called it
              </Link>
            </div>
          )}
        </div>
      )}

      {/* --- being played right now -------------------------------- */}
      {isLive && (
        <div className="border-b border-amber-200 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
            {live.length > 1 ? `${live.length} playing now` : "Playing now"}
          </p>

          <ul className="mt-1.5 space-y-2">
            {live.map((m) => {
              const pick = pickOf(m);
              return (
                <li key={m.id} className="flex items-center gap-2">
                  <Link
                    href={`/matches/${m.id}`}
                    className="min-w-0 flex-1 font-semibold leading-snug text-stone-900 underline decoration-stone-400 underline-offset-4"
                    dir="auto"
                  >
                    {m.home_team} v {m.away_team}
                  </Link>

                  {pick && (
                    <span className="shrink-0 rounded-full bg-stone-0 px-2.5 py-0.5 text-sm font-medium tabular-nums text-stone-900">
                      {pick[0]}
                      {"\u2013"}
                      {pick[1]}
                    </span>
                  )}

                  {m.room_slug && (
                    <Link
                      href={`/rooms/${m.room_slug}`}
                      className="shrink-0 rounded-full bg-emerald-800 px-3 py-1 text-sm font-medium text-stone-0"
                    >
                      Room
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* --- the next slot -----------------------------------------
          Shown in full when nothing is playing, folded to one line when
          something is: during a match, the match is the only subject. */}
      {nextSlot.length > 0 && (
        <div className="px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
              {nextSlot.length > 1
                ? `Next up · ${slotTime}`
                : "Next up"}
            </p>
            {left !== null && !kickedOff && (
              <span className="text-xs font-medium tabular-nums text-amber-900">
                {formatCountdown(left)}
              </span>
            )}
          </div>

          {/* Always the full list.

              This used to collapse to a one-line link whenever anything
              was playing, so a screen of LIVE rows was followed by a
              sentence nobody read — people could not tell what was on
              now and what was next. The next four render exactly as
              they did before the first whistle. */}
          <ul className="mt-2 space-y-2.5">
            {nextSlot.map((m) => {
              const pick = pickOf(m);
              const open = m.is_open && !kickedOff;

              if (picking === m.id && userId) {
                return (
                  <li key={m.id}>
                    <p
                      className="font-semibold leading-snug text-stone-900"
                      dir="auto"
                    >
                      {m.home_team} v {m.away_team}
                    </p>
                    <div className="mt-2">
                      <PredictForm
                        match={m}
                        onDoneAction={(h, a) => {
                          setJustPicked((p) => ({ ...p, [m.id]: [h, a] }));
                          setPicking(null);
                        }}
                      />
                    </div>
                  </li>
                );
              }

              return (
                <li key={m.id} className="flex items-center gap-2">
                  <Link
                    href={`/matches/${m.id}`}
                    className="min-w-0 flex-1 font-semibold leading-snug text-stone-900"
                    dir="auto"
                  >
                    {m.home_team} v {m.away_team}
                  </Link>

                  {pick && (
                    <span className="shrink-0 rounded-full bg-stone-0 px-2.5 py-0.5 text-sm font-medium tabular-nums text-stone-900">
                      {pick[0]}
                      {"\u2013"}
                      {pick[1]}
                    </span>
                  )}

                  {open &&
                    (userId ? (
                      <button
                        onClick={() => setPicking(m.id)}
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                          pick
                            ? "bg-stone-0 text-stone-700"
                            : "bg-amber-400 text-on-brand"
                        }`}
                      >
                        {pick ? "Change" : "Pick"}
                      </button>
                    ) : (
                      <Link
                        replace
                        href="/signup?next=%2F"
                        className="shrink-0 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold uppercase tracking-wide text-on-brand"
                      >
                        Pick
                      </Link>
                    ))}

                  {!open && !pick && (
                    <span className="shrink-0 text-xs text-stone-500">
                      Closed
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Everything beyond this slot is one tap away, never a list
              that grows with the schedule. */}
          {upcomingCount > nextSlot.length && (
            <Link
              href="/matches"
              className="mt-2.5 block text-sm text-stone-700 underline underline-offset-4"
            >
              {upcomingCount - nextSlot.length} more still to come
            </Link>
          )}
        </div>
      )}

      {/* --- where you stand --------------------------------------- */}
      <div className="border-t border-amber-200 px-4 py-3">
        {standing && standing.played > 0 && (
          <p className="mb-2.5 text-sm text-stone-700">
            {standing.rank === 1
              ? `Top of ${standing.total}`
              : `${standing.rank} of ${standing.total}`}
            {standing.gap_above > 0 && ` · ${standing.gap_above} behind`}
          </p>
        )}

        {/* One door instead of two: the hub holds the schedule, the
            bracket and the board, so splitting them here sent people to
            a narrower version of the same place. */}
        <Link
          href="/hub"
          className="block rounded-lg bg-amber-400 px-4 py-2.5 text-center text-sm font-semibold text-on-brand"
        >
          Go to Tourney Hub
        </Link>

        <div className="mt-2 flex items-center justify-center gap-4">
          <Link
            href="/rules"
            className="text-xs text-stone-500 underline underline-offset-4"
          >
            How it works
          </Link>
          <button onClick={collapse} className="text-xs text-stone-500">
            Hide
          </button>
        </div>
      </div>
    </section>
  );
}
