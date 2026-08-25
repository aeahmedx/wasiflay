import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { LiveRefresh } from "@/components/live-refresh";
import { createClient } from "@/lib/supabase/server";
import { getLeaderboard, getMyStanding } from "@/lib/queries/predictions";
import { LeaderboardView } from "@/components/matches/leaderboard-view";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "Nobody has ever won this. Whoever tops the board is the first name on it.",
  openGraph: {
    title: "Leaderboard · Wasif Lay",
    description:
      "Nobody has ever won this. Whoever tops the board is the first name on it.",
  },
};

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const [rows, standing] = await Promise.all([
    getLeaderboard(supabase, 25),
    getMyStanding(supabase),
  ]);

  return (
    <main className="min-h-dvh bg-stone-50 px-4 pt-6 pb-safe-page">
      <div className="mx-auto max-w-md">
        {/* router.back() with a fallback, so someone arriving from a
            shared link isn't stranded. */}
        {/* The view refetches on its own over realtime; this is the
            backstop for when realtime isn't arriving. */}
        <LiveRefresh watch={[]} />

        <BackLink />

        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
          Leaderboard
        </h1>
        <p className="mt-1 text-stone-600">
          Exact scores are worth the most. Later rounds count for more.
        </p>

        {/* Not buried in a footer: this is where someone asks how the
            scoring works, and where the no-gambling rule has to be
            impossible to miss. */}
        <Link
          href="/rules"
          className="mb-5 mt-3 flex items-center justify-between gap-3 rounded-lg border border-stone-300 bg-stone-0 px-4 py-3"
        >
          <span>
            <span className="block text-sm font-medium text-stone-900">
              How it works
            </span>
            <span className="block text-xs text-stone-600">
              Scoring, ties, and the rules. Free to play, no money involved.
            </span>
          </span>
          <span className="shrink-0 text-stone-400">›</span>
        </Link>

        <LeaderboardView initialRows={rows} initialStanding={standing} />

        <div className="mt-6 flex justify-center gap-4">
          <Link
            href="/matches"
            className="text-sm text-emerald-800 underline underline-offset-4"
          >
            All matches
          </Link>
          <Link
            href="/rules"
            className="text-sm text-emerald-800 underline underline-offset-4"
          >
            Rules
          </Link>
        </div>
      </div>
    </main>
  );
}
