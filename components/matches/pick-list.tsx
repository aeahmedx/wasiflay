import Link from "next/link";
import type { PickSummary, UserPick } from "@/lib/queries/predictions";
import { LocalTime } from "@/components/matches/local-time";
import { railClass, TIER_LABEL, TIER_STYLE } from "@/components/matches/tier";

/**
 * Someone's prediction record.
 *
 * Meant to be looked at by other people — being publicly right is the
 * whole reward here, and this is what a rivalry is built on.
 *
 * What people scan for is: did they call it, and by how much. So the
 * scoreline is the largest thing on each row, the prediction sits
 * directly beneath the result it is judged against, and an exact call
 * gets the brand yellow.
 *
 * Styling comes from components/matches/tier.ts, shared with the
 * matches list — the same information shown two ways is how one product
 * ends up looking like two.
 */
export function PickList({
  picks,
  summary,
  isSelf,
}: {
  picks: UserPick[];
  summary: PickSummary | null;
  isSelf: boolean;
}) {
  if (picks.length === 0) {
    return (
      <div className="rounded-lg border border-stone-200 bg-stone-0 px-4 py-10 text-center">
        <p className="text-stone-600">
          {isSelf ? "You haven't predicted anything yet." : "No picks yet."}
        </p>
        {isSelf && (
          <Link
            href="/matches"
            className="mt-4 inline-block rounded-lg bg-amber-400 px-4 py-2.5 font-semibold text-on-brand"
          >
            Find a match
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      {summary && summary.played > 0 && (
        <div className="mb-4 overflow-hidden rounded-lg border border-stone-200 bg-stone-0">
          <div className="grid grid-cols-3 divide-x divide-stone-200">
            <Stat value={summary.points} label="points" />
            <Stat value={summary.exact_count} label="called exactly" />
            <Stat value={summary.played} label="scored" />
          </div>

          {summary.rank !== null && (
            <Link
              href="/leaderboard"
              className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-4 py-2.5"
            >
              <span className="text-sm text-stone-600">
                {summary.rank === 1 ? "Top of the board" : "On the leaderboard"}
              </span>
              <span className="text-sm font-semibold tabular-nums text-emerald-800">
                #{summary.rank} ›
              </span>
            </Link>
          )}
        </div>
      )}

      <ul className="space-y-2">
        {picks.map((p) => {
          const finished = p.status === "finished";
          const tier = p.tier ?? "none";

          return (
            <li key={p.match_id}>
              <Link
                href={`/matches/${p.match_id}`}
                className="block overflow-hidden rounded-lg border border-stone-200 bg-stone-0 transition hover:border-stone-300"
              >
                <div className="flex items-stretch">
                  {/* A colour rail: readable at a glance while
                      scrolling, without a badge on every row. */}
                  <span
                    aria-hidden
                    className={`w-1 shrink-0 ${railClass({
                      finished,
                      tier: p.tier,
                      points: p.points,
                    })}`}
                  />

                  <div className="min-w-0 flex-1 px-3.5 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p
                        className="min-w-0 truncate text-[15px] font-semibold leading-tight text-stone-900"
                        dir="auto"
                      >
                        {p.home_team}{" "}
                        <span className="text-stone-400">v</span>{" "}
                        {p.away_team}
                      </p>

                      {finished ? (
                        <span className="shrink-0 text-lg font-bold tabular-nums leading-none text-stone-900">
                          {p.home_score}
                          {"\u2013"}
                          {p.away_score}
                        </span>
                      ) : (
                        <LocalTime
                          iso={p.kicks_off_at}
                          className="shrink-0 text-xs font-medium text-stone-500"
                        />
                      )}
                    </div>

                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-sm text-stone-600">
                        called{" "}
                        <span className="font-medium tabular-nums text-stone-800">
                          {p.pick_home}
                          {"\u2013"}
                          {p.pick_away}
                        </span>
                      </span>

                      {finished && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${TIER_STYLE[tier]}`}
                        >
                          {TIER_LABEL[tier]}
                        </span>
                      )}

                      {p.points !== null && p.points > 0 && (
                        <span className="ml-auto shrink-0 text-sm font-bold tabular-nums text-emerald-800">
                          +{p.points}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="px-3 py-3 text-center">
      <p className="text-2xl font-bold tabular-nums leading-none text-stone-900">
        {value}
      </p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-stone-500">
        {label}
      </p>
    </div>
  );
}
