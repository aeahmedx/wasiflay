"use client";

import { useState } from "react";
import Link from "next/link";
import {
  kickoffLabel,
  ROUND_LABEL,
  type Match,
} from "@/lib/queries/predictions";
import { PredictForm } from "@/components/matches/predict-form";

/**
 * One match in a list, pickable in place.
 *
 * Tapping through to the match page to predict and then coming back is
 * three navigations to change two numbers — enough friction that people
 * pick one match instead of all of them. The form opens here instead.
 *
 * The row text stays a link, but the action is a sibling rather than
 * nested inside it: a button inside an anchor is invalid HTML and taps
 * unpredictably on a phone.
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

  const finished = match.status === "finished";
  const serverPick =
    match.my_home !== null
      ? ([match.my_home, match.my_away] as [number, number])
      : null;
  // Shown the moment it saves; the refresh behind it confirms.
  const pick = justPicked ?? serverPick;
  const points = match.my_points;

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-0">
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <Link href={`/matches/${match.id}`} className="min-w-0 flex-1">
          <p className="font-medium text-stone-900" dir="auto">
            {match.home_team}
            {finished
              ? ` ${match.home_score}\u2013${match.away_score} `
              : " v "}
            {match.away_team}
          </p>
          <p className="mt-0.5 text-sm text-stone-600">
            {kickoffLabel(match.kicks_off_at)}
            {match.round !== "group" ? ` · ${ROUND_LABEL[match.round]}` : ""}
            {match.prediction_count >= 10
              ? ` · ${match.prediction_count} picks`
              : ""}
          </p>
        </Link>

        {finished && pick && points !== null ? (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums ${
              points > 0
                ? "bg-emerald-800 text-stone-0"
                : "bg-stone-100 text-stone-500"
            }`}
          >
            {points > 0 ? `+${points}` : "0"}
          </span>
        ) : match.is_open && userId ? (
          <button
            onClick={() => setPicking((v) => !v)}
            aria-expanded={picking}
            className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-medium ${
              pick
                ? "bg-stone-100 text-stone-800"
                : "bg-amber-400 text-on-brand"
            }`}
          >
            {pick ? `${pick[0]}\u2013${pick[1]}` : "Predict"}
          </button>
        ) : pick ? (
          <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-sm font-medium tabular-nums text-stone-800">
            {pick[0]}
            {"\u2013"}
            {pick[1]}
          </span>
        ) : match.is_open ? (
          <Link
            href={`/signup?next=${encodeURIComponent("/matches")}`}
            className="shrink-0 rounded-full bg-amber-400 px-2.5 py-1 text-sm font-medium text-on-brand"
          >
            Predict
          </Link>
        ) : null}
      </div>

      {picking && userId && (
        <div className="border-t border-stone-200 px-4 py-3">
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
