import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLeaderboard, getMyStanding } from "@/lib/queries/predictions";
import { LeaderboardView } from "@/components/matches/leaderboard-view";

export const metadata: Metadata = { title: "Leaderboard" };

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const [rows, standing] = await Promise.all([
    getLeaderboard(supabase, 25),
    getMyStanding(supabase),
  ]);

  return (
    <main className="min-h-dvh bg-stone-50 px-4 pt-6 pb-safe-page">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Leaderboard
        </h1>
        <p className="mt-1 mb-5 text-stone-600">
          Exact scores are worth the most. Later rounds count double.
        </p>

        <LeaderboardView initialRows={rows} initialStanding={standing} />

        <div className="mt-6 text-center">
          <Link
            href="/matches"
            className="text-sm text-emerald-800 underline underline-offset-4"
          >
            All matches
          </Link>
        </div>
      </div>
    </main>
  );
}
