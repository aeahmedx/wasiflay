import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import { getMatches } from "@/lib/queries/predictions";
import { MatchRow } from "@/components/matches/match-row";
import { getMyStanding } from "@/lib/queries/predictions";
import { BackLink } from "@/components/back-link";

export const metadata: Metadata = { title: "Matches" };

export default async function MatchesPage() {
  const supabase = await createClient();

  const [matches, profile] = await Promise.all([
    getMatches(supabase, 100),
    getCurrentProfile(),
  ]);

  const standing = profile ? await getMyStanding(supabase) : null;

  /**
   * Three groups, in the order they matter:
   *
   *   playing  — kicked off and not finished
   *   upcoming — still open, soonest first
   *   results  — finished, most recent first
   *
   * A match that kicked off but has no result yet stays under "playing"
   * rather than falling into results, so a forgotten score is visible
   * rather than quietly missing.
   */
  const playing = matches.filter(
    (m) =>
      m.status !== "finished" &&
      new Date(m.kicks_off_at).getTime() <= Date.now()
  );
  const upcoming = matches.filter(
    (m) =>
      m.status !== "finished" &&
      new Date(m.kicks_off_at).getTime() > Date.now()
  );
  const results = matches
    .filter((m) => m.status === "finished")
    .reverse();

  const nothing = matches.length === 0;

  return (
    <main className="min-h-dvh bg-stone-50 px-4 pt-6 pb-safe-page">
      <div className="mx-auto max-w-md">
        {/* router.back() with a fallback, so a shared link still has a
            way out rather than dead-ending. */}
        <BackLink />

        <h1 className="mt-4 mb-4 text-2xl font-semibold tracking-tight text-stone-900">
          Matches
        </h1>

        {/*
          No hero here. This page already lists everything in groups —
          repeating the home screen's card would say the same thing
          twice and push the actual list below the fold.

          What it gets instead is the standing, which the hero only has
          room to hint at.
        */}
        {standing && standing.played > 0 && (
          <Link
            href="/leaderboard"
            className="mb-5 flex items-center gap-4 rounded-lg border border-stone-200 bg-stone-0 px-4 py-3"
          >
            <div>
              <p className="text-xl font-semibold tabular-nums text-stone-900">
                #{standing.rank}
              </p>
              <p className="text-xs text-stone-500">of {standing.total}</p>
            </div>
            <div>
              <p className="text-xl font-semibold tabular-nums text-stone-900">
                {standing.points}
              </p>
              <p className="text-xs text-stone-500">points</p>
            </div>
            {standing.gap_above > 0 && (
              <p className="ml-auto text-right text-sm text-stone-600">
                {standing.gap_above} behind
                <br />
                <span className="text-xs text-stone-500">the place above</span>
              </p>
            )}
          </Link>
        )}

        {nothing ? (
          <div className="rounded-lg border border-stone-200 bg-stone-0 px-4 py-8 text-center">
            <p className="text-stone-600">No matches yet.</p>
            <Link
              href="/"
              className="mt-4 inline-block rounded-lg bg-emerald-800 px-4 py-2.5 font-medium text-stone-0"
            >
              Back to the feed
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {playing.length > 0 && (
              <section>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
                  Playing
                </h2>
                <ul className="space-y-2">
                  {playing.map((m) => (
                    <li key={m.id}>
                      <MatchRow match={m} userId={profile?.id ?? null} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {upcoming.length > 0 && (
              <section>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
                  Coming up
                </h2>
                <ul className="space-y-2">
                  {upcoming.map((m) => (
                    <li key={m.id}>
                      <MatchRow match={m} userId={profile?.id ?? null} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {results.length > 0 && (
              <section>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
                  Results
                </h2>
                <ul className="space-y-2">
                  {results.map((m) => (
                    <li key={m.id}>
                      <MatchRow match={m} userId={profile?.id ?? null} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-center gap-4">
          {profile && (
            <Link
              href={`/profile/${profile.id}?tab=picks`}
              className="text-sm text-emerald-800 underline underline-offset-4"
            >
              My picks
            </Link>
          )}
          <Link
            href="/leaderboard"
            className="text-sm text-emerald-800 underline underline-offset-4"
          >
            Leaderboard
          </Link>
        </div>
      </div>
    </main>
  );
}
