import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import { getMatches } from "@/lib/queries/predictions";
import { MatchRow } from "@/components/matches/match-row";
import { NowBlock } from "@/components/matches/now-block";

export const metadata: Metadata = { title: "Matches" };

export default async function MatchesPage() {
  const supabase = await createClient();

  const [matches, profile] = await Promise.all([
    getMatches(supabase, 100),
    getCurrentProfile(),
  ]);

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
    (m) => !m.is_open && m.status !== "finished"
  );
  const upcoming = matches.filter((m) => m.is_open);
  const results = matches
    .filter((m) => m.status === "finished")
    .reverse();

  const nothing = matches.length === 0;

  return (
    <main className="min-h-dvh bg-stone-50 px-4 pt-6 pb-safe-page">
      <div className="mx-auto max-w-md">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight text-stone-900">
          Matches
        </h1>

        {/* The same block as the home screen, so what's on now is in the
            same place wherever you are. */}
        <NowBlock userId={profile?.id ?? null} />

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

        <div className="mt-6 text-center">
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
