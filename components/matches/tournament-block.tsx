"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
 * A ticking clock, safe to render on the server.
 *
 * Reading Date.now() during render is a hydration mismatch waiting to
 * happen — the server renders "2m 22s", the client hydrates a second
 * later and renders "2m 21s", and React throws out the tree.
 *
 * useSyncExternalStore is the API for exactly this. The server snapshot
 * is null, so the countdown simply isn't rendered server-side; the
 * client fills it in on the first tick after hydration. Nothing to
 * mismatch, because the server never claims a time.
 */
function subscribeToSeconds(onTick: () => void) {
  const timer = setInterval(onTick, 1000);
  return () => clearInterval(timer);
}

function useNow(): number | null {
  return useSyncExternalStore(
    subscribeToSeconds,
    () => Date.now(),
    () => null
  );
}

function useCountdown(iso: string | null): number | null {
  const now = useNow();
  if (!iso || now === null) return null;
  return new Date(iso).getTime() - now;
}

function formatLeft(ms: number): string {
  if (ms <= 0) return "any moment";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

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
  match,
  standing,
  userId,
  startCollapsed = false,
}: {
  result: Match | null;
  match: Match | null;
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

  const left = useCountdown(match?.kicks_off_at ?? null);

  /**
   * Locking a match has to reach people who already have this open —
   * otherwise the Predict button sits there and gets rejected on tap,
   * which reads as broken rather than as too late.
   */
  useEffect(() => {
    if (!match) return;

    const channel = supabase
      .channel(`match:${match.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${match.id}`,
        },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, match, router]);

  if (!result && !match) return null;

  // Kickoff passing closes picks with no round trip. The server agrees —
  // match_is_open() reads the same clock. Before the first tick `left`
  // is null, so we trust the server's own is_open until then.
  const kickedOff = left !== null && left <= 0;
  const open = Boolean(match?.is_open) && !kickedOff;
  const live = match ? !open && match.status !== "finished" : false;
  const serverPick =
    match?.my_home !== null && match?.my_home !== undefined
      ? ([match.my_home, match.my_away] as [number, number])
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
  }

  if (collapsed) {
    const summary = match
      ? `${match.home_team} v ${match.away_team}`
      : result
      ? `${result.home_team} ${result.home_score}\u2013${result.away_score} ${result.away_team}`
      : "";

    return (
      <button
        onClick={() => setCollapsed(false)}
        className="mb-4 flex w-full items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-left"
      >
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-amber-900">
          {live ? "Live" : "Tournament"}
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
    <>
      <section className="mb-3 overflow-hidden rounded-lg border border-amber-300 bg-amber-50">
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
                  You didn&apos;t predict this one.
                </p>
              )}
            </div>

            {(result.my_points ?? 0) > 0 && (
              <span className="shrink-0 rounded-full bg-emerald-800 px-3 py-1 text-sm font-semibold text-stone-0">
                +{result.my_points}
              </span>
            )}
          </div>

        </div>
      )}

      {/* --- what's on next ---------------------------------------- */}
      {match && (
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-amber-900">
              {live ? "Playing now" : "Next up"}
            </span>
            {!live && !kickedOff && left !== null && (
              <span className="text-xs font-medium tabular-nums text-amber-900">
                {formatLeft(left)}
              </span>
            )}
          </div>

          {/* The fixture is the link, so a separate "details" button
              isn't needed beside it. */}
          <Link
            href={`/matches/${match.id}`}
            className="mt-1 block text-lg font-semibold text-stone-900 underline decoration-stone-400 underline-offset-4"
            dir="auto"
          >
            {match.home_team} v {match.away_team}
          </Link>

          {/* Shown only once the number flatters — "2 predictions" reads
              as an empty app, nothing reads as a fresh one. */}
          {match.prediction_count >= 10 && (
            <p className="mt-0.5 text-sm text-stone-700">
              {match.prediction_count} predictions
            </p>
          )}

          {picking && userId ? (
            <div className="mt-3">
              <PredictForm
                match={match}
                onDoneAction={(h, a) => {
                  setJustPicked([h, a]);
                  setPicking(false);
                }}
              />
            </div>
          ) : (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {hasPick && (
                <span className="rounded-full bg-stone-0 px-3 py-1.5 text-sm font-medium text-stone-900">
                  You said {pick[0]}
                  {"\u2013"}
                  {pick[1]}
                </span>
              )}

              {open &&
                (userId ? (
                  <button
                    onClick={() => setPicking(true)}
                    className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-stone-0"
                  >
                    {hasPick ? "Change it" : "Predict the score"}
                  </button>
                ) : (
                  <Link
                    href="/signup?next=%2F"
                    className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-stone-0"
                  >
                    Sign in to predict
                  </Link>
                ))}

              {!open && !hasPick && match.status !== "finished" && (
                <span className="text-sm text-stone-700">Picks closed</span>
              )}

              {match.room_slug && (
                <Link
                  href={`/rooms/${match.room_slug}`}
                  className="rounded-lg border border-stone-300 bg-stone-0 px-4 py-2 text-sm font-medium text-stone-800"
                >
                  Join the room
                </Link>
              )}

            </div>
          )}
        </div>
      )}

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

        <button
          onClick={collapse}
          className="mt-2 w-full text-center text-xs text-stone-500"
        >
          Hide
        </button>
      </div>
    </section>

      {/*
        The secondary routes, outside the card.

        Inside, they made the block read as a pile of options; removed
        entirely, the picks for a specific match became hard to reach.
        A quiet row underneath keeps them one tap away without competing
        with the two actions that matter.
      */}
      <nav className="mb-5 -mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
        {result && (
          <Link
            href={`/matches/${result.id}`}
            className="text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900"
          >
            See who called it
          </Link>
        )}
        {match && (
          <Link
            href={`/matches/${match.id}`}
            className="text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900"
          >
            {match.is_open ? "Match details" : "See picks"}
          </Link>
        )}
        <Link
          href="/matches"
          className="text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900"
        >
          All matches
        </Link>
      </nav>
    </>
  );
}