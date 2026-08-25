import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import {
  getMatch,
  getMatchPredictions,
  ROUND_LABEL,
  ROUND_MULTIPLIER,
  TIER_LABEL,
} from "@/lib/queries/predictions";
import { LocalTime } from "@/components/matches/local-time";
import { BackLink } from "@/components/back-link";
import { ShareButton } from "@/components/share-button";
import { MatchHeader } from "@/components/matches/match-header";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const match = await getMatch(supabase, id);

  if (!match) return { title: "Match" };

  // Every share lands in a group chat where nobody has heard of this.
  // The preview has about a second to say what it is.
  const title = `${match.home_team} v ${match.away_team}`;
  const description =
    match.status === "finished"
      ? `Finished ${match.home_score}–${match.away_score}. See who called it.`
      : `Predict the score before kickoff.`;

  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
  };
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [match, profile] = await Promise.all([
    getMatch(supabase, id),
    getCurrentProfile(),
  ]);

  if (!match) notFound();

  const predictions = await getMatchPredictions(supabase, id);
  const others = predictions.filter((p) => p.user_id !== profile?.id);
  const multiplier = ROUND_MULTIPLIER[match.round];

  return (
    <main className="min-h-dvh bg-stone-50 px-4 pt-6 pb-safe-page">
      <div className="mx-auto max-w-md">
        <BackLink />

        <div className="mt-4 mb-4">
          <MatchHeader match={match} userId={profile?.id ?? null} />
        </div>

        <p className="mb-4 text-sm text-stone-600">
          {ROUND_LABEL[match.round]}
          {multiplier > 1 ? ` · worth ${multiplier}×` : ""} ·{" "}
          <LocalTime iso={match.kicks_off_at} />
        </p>

        {match.status === "finished" && match.my_tier && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="font-medium text-emerald-900">
              {match.my_tier === "none"
                ? "No points this time."
                : `${TIER_LABEL[match.my_tier]} — ${match.my_points} points.`}
            </p>
            {(match.my_points ?? 0) > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Link
                  href={`/create?type=announcement&q=${encodeURIComponent(
                    match.my_tier === "exact"
                      ? `Called it: ${match.home_team} ${match.home_score}\u2013${match.away_score} ${match.away_team}`
                      : `${match.home_team} ${match.home_score}\u2013${match.away_score} ${match.away_team} — I said ${match.my_home}\u2013${match.my_away}`
                  )}`}
                  className="rounded-lg bg-emerald-800 px-3 py-1.5 text-sm font-medium text-stone-0"
                >
                  {match.my_tier === "exact" ? "Post it" : "Say something"}
                </Link>
                {match.my_tier === "exact" && (
                  <ShareButton
                    path={`/matches/${match.id}`}
                    title={`Called it: ${match.home_team} ${match.home_score}-${match.away_score} ${match.away_team}`}
                    label="Share"
                    className="text-stone-700"
                  />
                )}
              </div>
            )}
          </div>
        )}

        <h2 className="mb-2 font-medium text-stone-900">
          {match.is_open ? "Picks so far" : "All picks"}
        </h2>

        {match.is_open ? (
          <p className="rounded-lg border border-stone-200 bg-stone-0 px-4 py-6 text-center text-sm text-stone-600">
            Hidden until kickoff, so nobody can copy. They all show at
            once when it starts.
          </p>
        ) : others.length === 0 ? (
          <p className="rounded-lg border border-stone-200 bg-stone-0 px-4 py-6 text-center text-sm text-stone-600">
            Nobody else called this one.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {others.map((p) => (
              <li
                key={p.user_id}
                className="flex items-center gap-3 rounded-lg border border-stone-200 bg-stone-0 px-3 py-2.5"
              >
                <Link
                  href={`/profile/${p.user_id}`}
                  className="min-w-0 flex-1 truncate text-stone-900"
                  dir="auto"
                >
                  {p.display_name}
                </Link>

                <span className="shrink-0 font-medium tabular-nums text-stone-900">
                  {p.home_score}–{p.away_score}
                </span>

                {p.points !== null && (
                  <span
                    className={`w-10 shrink-0 text-right text-sm font-semibold tabular-nums ${
                      p.points > 0 ? "text-emerald-800" : "text-stone-400"
                    }`}
                  >
                    {p.points > 0 ? `+${p.points}` : "0"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex justify-center gap-4">
          <Link
            href="/matches"
            className="text-sm text-emerald-800 underline underline-offset-4"
          >
            All matches
          </Link>
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
