"use client";

import { useState } from "react";
import Link from "next/link";
import {
  kickoffLabel,
  ROUND_LABEL,
  type Match,
} from "@/lib/queries/predictions";
import { useNow } from "@/lib/hooks/use-now";
import { PredictForm } from "@/components/matches/predict-form";
import { railClass, TIER_LABEL, TIER_STYLE } from "@/components/matches/tier";

/**
 * One match in a list, pickable in place.
 *
 * Same visual language as the pick list on a profile — colour rail, big
 * scoreline, tier badge — because they show the same information and
 * looking like two different products was the tell that they were
 * written separately.
 *
 * Tapping through to a match page to predict and back is three
 * navigations to change two numbers, which is enough friction that
 * people pick one game instead of all of them. The form opens here.
 *
 * The row text is a link and the action is a sibling, never nested: a
 * button inside an anchor is invalid HTML and taps unpredictably on a
 * phone.
 */
export function MatchRow({
  match,
  userId,
}: {
  match: Match;
  userId: string | null;
}) {
  const [picking, setPicking] = useState(false);
  const [justPicked, setJustPicked] = useState<[number, number] | null>(null);

  /**
   * is_open is computed when the page renders, so a Predict chip sat
   * there after kickoff until someone refreshed. The write was refused
   * server-side either way, but a button that fails on tap reads as
   * broken rather than as too late. Null on the server, so the server's
   * own answer stands until the first tick.
   */
  const now = useNow();
  const kickedOff =
    now !== null && new Date(match.kicks_off_at).getTime() <= now;

  const finished = match.status === "finished";
  const open = match.is_open && !kickedOff;
  const live = !finished && !open;

  const serverPick =
    match.my_home !== null
      ? ([match.my_home, match.my_away] as [number, number])
      : null;
  // Shown the moment it saves; the refresh behind it confirms.
  const pick = justPicked ?? serverPick;
  const tier = match.my_tier ?? "none";

  return (
    <div className="overflow-hidden rounded-lg border border-stone-200 bg-stone-0">
      <div className="flex items-stretch">
        <span
          aria-hidden
          className={`w-1 shrink-0 ${railClass({
            finished,
            live,
            open: match.is_open,
            tier: match.my_tier,
            points: match.my_points,
          })}`}
        />

        <div className="min-w-0 flex-1 px-3.5 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <Link
              href={`/matches/${match.id}`}
              className="min-w-0 truncate text-[15px] font-semibold leading-tight text-stone-900"
              dir="auto"
            >
              {match.home_team} <span className="text-stone-400">v</span>{" "}
              {match.away_team}
            </Link>

            {finished ? (
              <span className="shrink-0 text-lg font-bold tabular-nums leading-none text-stone-900">
                {match.home_score}
                {"\u2013"}
                {match.away_score}
              </span>
            ) : live ? (
              <span className="shrink-0 rounded-full bg-emerald-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-0">
                Live
              </span>
            ) : (
              <span className="shrink-0 text-xs font-medium text-stone-500">
                {kickoffLabel(match.kicks_off_at)}
              </span>
            )}
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            {pick ? (
              <span className="text-sm text-stone-600">
                called{" "}
                <span className="font-medium tabular-nums text-stone-800">
                  {pick[0]}
                  {"\u2013"}
                  {pick[1]}
                </span>
              </span>
            ) : (
              <span className="text-sm text-stone-500">
                {match.round !== "group"
                  ? ROUND_LABEL[match.round]
                  : match.prediction_count >= 10
                  ? `${match.prediction_count} picks`
                  : "No pick yet"}
              </span>
            )}

            {finished && pick && (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${TIER_STYLE[tier]}`}
              >
                {TIER_LABEL[tier]}
              </span>
            )}

            {finished && (match.my_points ?? 0) > 0 && (
              <span className="ml-auto shrink-0 text-sm font-bold tabular-nums text-emerald-800">
                +{match.my_points}
              </span>
            )}

            {/* The only action on this row, and only while it's open. */}
            {open &&
              (userId ? (
                <button
                  onClick={() => setPicking((v) => !v)}
                  aria-expanded={picking}
                  className={`ml-auto shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                    pick
                      ? "bg-stone-100 text-stone-700"
                      : "bg-amber-400 text-on-brand"
                  }`}
                >
                  {pick ? "Change" : "Predict"}
                </button>
              ) : (
                <Link
            replace
                  href={`/signup?next=${encodeURIComponent("/matches")}`}
                  className="ml-auto shrink-0 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold uppercase tracking-wide text-on-brand"
                >
                  Predict
                </Link>
              ))}
          </div>
        </div>
      </div>

      {picking && userId && open && (
        <div className="border-t border-stone-200 px-3.5 py-3">
          <PredictForm
            match={match}
            onDoneAction={(h, a) => {
              setJustPicked([h, a]);
              setPicking(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
