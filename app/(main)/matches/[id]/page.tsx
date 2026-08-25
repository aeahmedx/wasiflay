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
import { railClass, TIER_STYLE } from "@/components/matches/tier";
import { LocalTime } from "@/components/matches/local-time";
import { BackLink } from "@/components/back-link";
import { LiveRefresh } from "@/components/live-refresh";
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
  const multiplier = ROUND_MULTIPLIER[match.round];
  const finished = match.status === "finished";

  /**
   * Everyone's picks in one list, including yours, rather than yours in
   * a separate card and everyone else below it. The interesting question
   * on this page is where you came in the room — which you can't see if
   * you've been lifted out of the list.
   */
  const exactCount = predictions.filter((p) => p.tier === "exact").length;
  const scored = predictions.filter((p) => p.points !== null).length;

  return (
    <main className="min-h-dvh bg-stone-50 px-4 pt-6 pb-safe-page">
      <div className="mx-auto max-w-md">
        {/* Locking reveals everyone's picks and a result scores them —
            both land here without a reload. */}
        <LiveRefresh
          watch={[
            { table: "matches", filter: `id=eq.${match.id}` },
            { table: "predictions", filter: `match_id=eq.${match.id}` },
          ]}
        />

        <BackLink />

        <div className="mt-4 mb-3">
          <MatchHeader match={match} userId={profile?.id ?? null} />
        </div>

        {/* Round, weight, kickoff — the context for what the points below
            are worth. */}
        <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone-600">
          <span className="font-medium text-stone-800">
            {ROUND_LABEL[match.round]}
          </span>
          {multiplier > 1 && (
            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-on-brand">
              {multiplier}× points
            </span>
          )}
          <span className="text-stone-400">·</span>
          <LocalTime iso={match.kicks_off_at} />
        </div>

        {/* What you got, and the one moment worth telling people about. */}
        {finished && match.my_tier && (
          <div
            className={`mb-4 overflow-hidden rounded-lg border ${
              (match.my_points ?? 0) > 0
                ? "border-emerald-200 bg-emerald-50"
                : "border-stone-200 bg-stone-0"
            }`}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                  TIER_STYLE[match.my_tier]
                }`}
              >
                {TIER_LABEL[match.my_tier]}
              </span>

              <span className="min-w-0 flex-1 text-sm text-stone-700">
                You called {match.my_home}
                {"\u2013"}
                {match.my_away}
              </span>

              <span
                className={`shrink-0 text-lg font-bold tabular-nums ${
                  (match.my_points ?? 0) > 0
                    ? "text-emerald-800"
                    : "text-stone-400"
                }`}
              >
                {(match.my_points ?? 0) > 0 ? `+${match.my_points}` : "0"}
              </span>
            </div>

            {(match.my_points ?? 0) > 0 && (
              <div className="flex items-center gap-3 border-t border-emerald-200 px-4 py-2.5">
                <Link
                  href={`/create?type=announcement&q=${encodeURIComponent(
                    match.my_tier === "exact"
                      ? `Called it: ${match.home_team} ${match.home_score}\u2013${match.away_score} ${match.away_team}`
                      : `${match.home_team} ${match.home_score}\u2013${match.away_score} ${match.away_team} — I said ${match.my_home}\u2013${match.my_away}`
                  )}`}
                  className="rounded-lg bg-amber-400 px-3.5 py-1.5 text-sm font-semibold text-on-brand"
                >
                  {match.my_tier === "exact" ? "Post it" : "Say something"}
                </Link>

                <ShareButton
                  path={`/matches/${match.id}`}
                  title={`Called it: ${match.home_team} ${match.home_score}-${match.away_score} ${match.away_team}`}
                  label="Share"
                  className="text-sm text-stone-700"
                />
              </div>
            )}
          </div>
        )}

        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="font-semibold text-stone-900">
            {match.is_open ? "Picks so far" : "The calls"}
          </h2>

          {/* Only once the numbers flatter — "2 predictions" reads as an
              empty app, nothing reads as a fresh one. */}
          {predictions.length >= 5 && (
            <p className="text-sm text-stone-500">
              {predictions.length} in
              {finished && exactCount > 0 && (
                <>
                  {" · "}
                  <span className="font-medium text-amber-700">
                    {exactCount} exact
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        {match.is_open ? (
          <div className="rounded-lg border border-dashed border-stone-300 bg-stone-0 px-4 py-8 text-center">
            <p className="text-sm font-medium text-stone-800">
              Hidden until kickoff
            </p>
            <p className="mt-1 text-sm text-stone-600">
              So nobody can copy. Everyone&apos;s shows at once when it
              starts.
            </p>
            {match.my_home !== null && (
              <p className="mt-3 inline-block rounded-full bg-stone-100 px-3 py-1.5 text-sm font-medium tabular-nums text-stone-800">
                You said {match.my_home}
                {"\u2013"}
                {match.my_away}
              </p>
            )}
          </div>
        ) : predictions.length === 0 ? (
          <div className="rounded-lg border border-stone-200 bg-stone-0 px-4 py-8 text-center">
            <p className="text-sm text-stone-600">Nobody called this one.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {predictions.map((p, i) => {
              const isMe = p.user_id === profile?.id;
              const tier = p.tier ?? "none";

              return (
                <li key={p.user_id}>
                  <div
                    className={`flex items-stretch overflow-hidden rounded-lg border ${
                      isMe
                        ? "border-emerald-800 bg-emerald-50"
                        : "border-stone-200 bg-stone-0"
                    }`}
                  >
                    {/* Same colour language as every other list in the
                        app: yellow for an exact call, green for points,
                        grey for a miss. */}
                    <span
                      aria-hidden
                      className={`w-1 shrink-0 ${railClass({
                        finished,
                        tier: p.tier,
                        points: p.points,
                      })}`}
                    />

                    <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5">
                      {finished && (
                        <span className="w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-stone-400">
                          {i + 1}
                        </span>
                      )}

                      <Link
                        href={`/profile/${p.user_id}`}
                        className="min-w-0 flex-1 truncate text-stone-900"
                        dir="auto"
                      >
                        {p.display_name}
                        {isMe && (
                          <span className="ml-1.5 text-xs font-medium text-emerald-800">
                            you
                          </span>
                        )}
                      </Link>

                      {finished && tier === "exact" && (
                        <span className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-on-brand">
                          Exact
                        </span>
                      )}

                      <span className="shrink-0 font-semibold tabular-nums text-stone-900">
                        {p.home_score}
                        {"\u2013"}
                        {p.away_score}
                      </span>

                      {p.points !== null && (
                        <span
                          className={`w-9 shrink-0 text-right text-sm font-bold tabular-nums ${
                            p.points > 0 ? "text-emerald-800" : "text-stone-400"
                          }`}
                        >
                          {p.points > 0 ? `+${p.points}` : "0"}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {finished && scored > 0 && (
          <p className="mt-3 text-center text-xs text-stone-500">
            Sorted by points. Ties go to whoever called it closest.
          </p>
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
