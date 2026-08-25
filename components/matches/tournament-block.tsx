"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Match, Standing } from "@/lib/queries/predictions";
import {
  formatCountdown,
  useCountdown,
} from "@/lib/hooks/use-now";
import { PredictForm } from "@/components/matches/predict-form";
import { MatchRow } from "@/components/matches/match-row";

const HEADLINE: Record<string, string> = {
  exact: "Called it exactly",
  margin: "Right winner and margin",
  winner: "Called the winner",
  goals: "Right total goals",
  none: "No points",
};

/**
 * The tournament, in one block.
 *
 * Previously this was two separate cards — a result and a next match —
 * stacked on top of each other, which read as two unrelated
 * announcements rather than one running story. It's one card now, in
 * the order the weekend actually happens: what just finished, what's on
 * next, where you stand.
 *
 * Collapses to a single line, and can always be opened again. A
 * scoreboard people can permanently dismiss isn't a scoreboard.
 */
export function TournamentBlock({
  result,
  live,
  recent,
  next,
  upcoming,
  standing,
  userId,
  startCollapsed = false,
}: {
  result: Match | null;
  /** Everything being played right now. Was a single match, which meant
   *  two of three simultaneous kickoffs were invisible. */
  live: Match[];
  /** Shown when nothing is live or upcoming, so the block never
   *  disappears mid-tournament. */
  recent: Match[];
  /** The soonest match still open for picks. */
  next: Match | null;
  /** The rest of the open fixtures, behind a toggle. */
  upcoming: Match[];
  standing: Standing | null;
  userId: string | null;
  startCollapsed?: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [collapsed, setCollapsed] = useState(startCollapsed);
  const [picking, setPicking] = useState(false);

  /**
   * The pick just made, held locally until the server catches up.
   *
   * Without this, saving closes the form and nothing changes until
   * router.refresh() returns — a second of the app looking like it
   * ignored the tap.
   */
  const [justPicked, setJustPicked] = useState<[number, number] | null>(null);

  const [showUpcoming, setShowUpcoming] = useState(false);
  const left = useCountdown(next?.kicks_off_at ?? null);

  /**
   * Locking a match has to reach people who already have this open —
   * otherwise the Predict button sits there and gets rejected on tap,
   * which reads as broken rather than as too late.
   */
  /**
   * Any match change — a lock, a result — has to reach people already
   * looking at this. One channel for the whole table rather than one
   * per match: simpler, and the row count here is tiny.
   */
  useEffect(() => {
    const channel = supabase
      .channel("tournament-block")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, router]);

  // Only truly empty — no matches at all — hides the block. Between
  // the last game and the next fixture being added, results hold the
  // space rather than the tournament vanishing from the app.
  if (!result && live.length === 0 && !next && recent.length === 0) {
    return null;
  }

  // Kickoff passing closes picks with no round trip. The server agrees —
  // match_is_open() reads the same clock. Before the first tick `left`
  // is null, so we trust the server's own is_open until then.
  const kickedOff = left !== null && left <= 0;
  const open = Boolean(next?.is_open) && !kickedOff;

  const serverPick =
    next?.my_home !== null && next?.my_home !== undefined
      ? ([next.my_home, next.my_away] as [number, number])
      : null;

  // Local wins until the server agrees, then they're the same value.
  const pick = justPicked ?? serverPick;
  const hasPick = pick !== null;

  const canPost = Boolean(result?.my_tier) && (result?.my_points ?? 0) > 0;

  const bragTitle = result
    ? result.my_tier === "exact"
      ? `Called it: ${result.home_team} ${result.home_score}\u2013${result.away_score} ${result.away_team}`
      : `${result.home_team} ${result.home_score}\u2013${result.away_score} ${result.away_team} — I said ${result.my_home}\u2013${result.my_away}`
    : "";

  function collapse() {
    if (result) {
      document.cookie = `wl_seen_result=${result.id}; path=/; max-age=${
        60 * 60 * 24
      }; SameSite=Lax`;
    }
    setCollapsed(true);
    /**
     * The cookie alone wasn't enough: navigating away and back served
     * this from the router cache — a payload rendered before the cookie
     * existed — so it reopened. Refreshing re-runs the server component,
     * which reads the cookie.
     */
    router.refresh();
  }

  if (collapsed) {
    const summary =
      live.length > 1
        ? `${live.length} matches on now`
        : live.length === 1
        ? `${live[0].home_team} v ${live[0].away_team}`
        : next
        ? `${next.home_team} v ${next.away_team}`
        : result
        ? `${result.home_team} ${result.home_score}\u2013${result.away_score} ${result.away_team}`
        : "";

    return (
      <button
        onClick={() => setCollapsed(false)}
        className="mb-4 flex w-full items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-left"
      >
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-amber-900">
          {live.length > 0 ? "Live" : "Tournament"}
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
            <div className="mt-2 flex items-center gap-2">
              <Link
                href={`/create?type=announcement&q=${encodeURIComponent(
                  result.my_tier === "exact"
                    ? `Called it: ${result.home_team} ${result.home_score}\u2013${result.away_score} ${result.away_team}`
                    : `${result.home_team} ${result.home_score}\u2013${result.away_score} ${result.away_team} \u2014 I said ${result.my_home}\u2013${result.my_away}`
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

      {/* --- being played right now ------------------------------- */}
      {live.length > 0 && (
        <div className="border-b border-amber-200 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
            {live.length > 1 ? `${live.length} playing now` : "Playing now"}
          </p>

          <ul className="mt-1.5 space-y-2">
            {live.map((m) => {
              const myPick =
                m.my_home !== null
                  ? `${m.my_home}\u2013${m.my_away}`
                  : null;

              return (
                <li key={m.id} className="flex items-center gap-2">
                  <Link
                    href={`/matches/${m.id}`}
                    className="min-w-0 flex-1 truncate font-semibold text-stone-900 underline decoration-stone-400 underline-offset-4"
                    dir="auto"
                  >
                    {m.home_team} v {m.away_team}
                  </Link>

                  {myPick && (
                    <span className="shrink-0 rounded-full bg-stone-0 px-2.5 py-0.5 text-sm font-medium tabular-nums text-stone-900">
                      {myPick}
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

      {/* --- next one to pick --------------------------------------
          Shown alongside live matches, not instead of them. Hiding it
          while anything was playing meant the next fixture vanished
          from the block — and because `upcoming` excludes whatever
          `next` is, it fell out of that list too and the card claimed
          nothing was scheduled. */}
      {next && (
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-amber-900">
              Next up
            </span>
            {!kickedOff && left !== null && (
              <span className="text-xs font-medium tabular-nums text-amber-900">
                {formatCountdown(left)}
              </span>
            )}
          </div>

          <Link
            href={`/matches/${next.id}`}
            className="mt-1 block text-lg font-semibold text-stone-900 underline decoration-stone-400 underline-offset-4"
            dir="auto"
          >
            {next.home_team} v {next.away_team}
          </Link>

          {/* Shown only once the number flatters — "2 predictions" reads
              as an empty app, nothing reads as a fresh one. */}
          {next.prediction_count >= 10 && (
            <p className="mt-0.5 text-sm text-stone-700">
              {next.prediction_count} predictions
            </p>
          )}

          {picking && userId ? (
            <div className="mt-3">
              <PredictForm
                match={next}
                onDoneAction={(h, a) => {
                  setJustPicked([h, a]);
                  setPicking(false);
                }}
              />
            </div>
          ) : (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {hasPick && pick && (
                <span className="rounded-full bg-stone-0 px-3 py-1.5 text-sm font-medium text-stone-900">
                  You said {pick[0]}
                  {"\u2013"}
                  {pick[1]}
                </span>
              )}

              {open &&
                (userId ? (
                  <>
                    <button
                      onClick={() => setPicking(true)}
                      className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-stone-0"
                    >
                      {hasPick ? "Change it" : "Predict the score"}
                    </button>

                    {/* Calling a score before kickoff is the one brag
                        that carries risk, which is exactly why people
                        post it. Writes into the feed rather than opening
                        the share sheet — a share leaves the app and
                        leaves nothing behind. */}
                    {hasPick && pick && next && (
                      <Link
                        href={`/create?type=announcement&q=${encodeURIComponent(
                          `Calling it: ${next.home_team} ${pick[0]}\u2013${pick[1]} ${next.away_team}`
                        )}`}
                        className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-on-brand"
                      >
                        Share it
                      </Link>
                    )}
                  </>
                ) : (
                  <Link
                    href="/signup?next=%2F"
                    className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-stone-0"
                  >
                    Sign in to predict
                  </Link>
                ))}

              {!open && !hasPick && (
                <span className="text-sm text-stone-700">Picks closed</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- results, when there's nothing more current ------------- */}
      {live.length === 0 && !next && recent.length > 0 && (
        <div className="border-b border-amber-200 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
            {recent.length > 1 ? "Latest results" : "Latest result"}
          </p>

          <ul className="mt-1.5 space-y-2">
            {recent.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                <Link
                  href={`/matches/${m.id}`}
                  className="min-w-0 flex-1 truncate font-semibold text-stone-900 underline decoration-stone-400 underline-offset-4"
                  dir="auto"
                >
                  {m.home_team} {m.home_score}
                  {"\u2013"}
                  {m.away_score} {m.away_team}
                </Link>

                {(m.my_points ?? 0) > 0 ? (
                  <span className="shrink-0 rounded-full bg-emerald-800 px-2.5 py-0.5 text-sm font-semibold text-stone-0">
                    +{m.my_points}
                  </span>
                ) : m.my_home !== null ? (
                  <span className="shrink-0 rounded-full bg-stone-0 px-2.5 py-0.5 text-sm font-medium tabular-nums text-stone-600">
                    {m.my_home}
                    {"\u2013"}
                    {m.my_away}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* --- the rest, folded away --------------------------------- */}
      <div className="border-t border-amber-200">
        {upcoming.length > 0 ? (
          <>
            <button
              onClick={() => setShowUpcoming((v) => !v)}
              aria-expanded={showUpcoming}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-stone-700"
            >
              <span>
                {upcoming.length} more{" "}
                {upcoming.length === 1 ? "match" : "matches"} to pick
              </span>
              <span className="text-stone-500">
                {showUpcoming ? "Hide" : "Show"}
              </span>
            </button>

            {showUpcoming && (
              <ul className="space-y-2 px-4 pb-3">
                {upcoming.map((m) => (
                  <li key={m.id}>
                    <MatchRow match={m} userId={userId} />
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="px-4 py-2.5 text-sm text-stone-600">
            {next || live.length > 0
              ? "Nothing else scheduled yet."
              : "No more matches scheduled."}
          </p>
        )}
      </div>

      {/*
        The two things worth doing next, given their own row.

        These were scattered through the sections above as text links,
        which made the block read as a pile of options rather than a
        scoreboard. Everything else in here is contextual — a pick, a
        room — and belongs beside the thing it acts on.
      */}
      <div className="border-t border-amber-200 px-4 py-3">
        {standing && standing.played > 0 && (
          <p className="mb-2.5 text-sm text-stone-700">
            {standing.rank === 1
              ? `Top of ${standing.total}`
              : `${standing.rank} of ${standing.total}`}
            {standing.gap_above > 0 && ` · ${standing.gap_above} behind`}
          </p>
        )}

        <div className="flex gap-2">
          {canPost ? (
            <Link
              href={`/create?type=announcement&q=${encodeURIComponent(
                bragTitle
              )}`}
              className="flex-1 rounded-lg bg-amber-400 px-4 py-2.5 text-center text-sm font-semibold text-on-brand"
            >
              {result?.my_tier === "exact" ? "Post it" : "Say something"}
            </Link>
          ) : (
            <Link
              href="/matches"
              className="flex-1 rounded-lg bg-amber-400 px-4 py-2.5 text-center text-sm font-semibold text-on-brand"
            >
              All matches
            </Link>
          )}

          <Link
            href="/leaderboard"
            className="flex-1 rounded-lg bg-amber-400 px-4 py-2.5 text-center text-sm font-semibold text-on-brand"
          >
            Leaderboard
          </Link>
        </div>

        <div className="mt-2 flex items-center justify-center gap-4">
          <Link
            href="/rules"
            className="text-xs text-stone-500 underline underline-offset-4"
          >
            How it works
          </Link>
          <button
            onClick={collapse}
            className="text-xs text-stone-500"
          >
            Hide
          </button>
        </div>
      </div>
    </section>
  );
}