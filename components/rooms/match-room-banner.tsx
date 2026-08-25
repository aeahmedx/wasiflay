"use client";

import Link from "next/link";
import { formatCountdown, useCountdown } from "@/lib/hooks/use-now";
import type { NextFixture, RoomMatch } from "@/lib/queries/room-match";

/**
 * The strip under a match room's header.
 *
 * A room now exists from the moment a fixture is created, which means
 * it can sit empty for days — and an empty room reads as a dead app.
 * This is what stops that: a countdown gives a quiet room a reason to
 * be quiet, and turns waiting into anticipation.
 *
 * Three states, matching the match:
 *
 *   before   time until kickoff
 *   during   playing now
 *   after    the score, and where to go next
 */
export function MatchRoomBanner({
  match,
  nextFixture,
}: {
  match: RoomMatch;
  nextFixture: NextFixture | null;
}) {
  const left = useCountdown(match.kicks_off_at);
  const nextLeft = useCountdown(nextFixture?.kicks_off_at ?? null);

  const finished = match.status === "finished";
  // Null until the first tick, so the server never claims a time.
  const kickedOff = left !== null && left <= 0;

  if (finished) {
    return (
      <div className="border-b border-stone-200 bg-stone-100 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-stone-500">
            Full time
          </span>
          <span
            className="min-w-0 flex-1 truncate text-sm font-semibold text-stone-900"
            dir="auto"
          >
            {match.home_team} {match.home_score}
            {"\u2013"}
            {match.away_score} {match.away_team}
          </span>
        </div>

        {nextFixture ? (
          <p className="mt-1 text-xs text-stone-600">
            Come back for{" "}
            <Link
              href={
                nextFixture.room_slug
                  ? `/rooms/${nextFixture.room_slug}`
                  : `/matches/${nextFixture.id}`
              }
              className="font-medium text-emerald-800 underline underline-offset-2"
              dir="auto"
            >
              {nextFixture.home_team} v {nextFixture.away_team}
            </Link>
            {nextLeft !== null && nextLeft > 0 && (
              <> · {formatCountdown(nextLeft)}</>
            )}
          </p>
        ) : (
          <p className="mt-1 text-xs text-stone-600">
            That&apos;s the last one for now.{" "}
            <Link
              href="/matches"
              className="font-medium text-emerald-800 underline underline-offset-2"
            >
              All matches
            </Link>
          </p>
        )}
      </div>
    );
  }

  if (kickedOff) {
    return (
      <div className="flex items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-4 py-2">
        <span className="shrink-0 rounded-full bg-emerald-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-0">
          Playing now
        </span>
        <Link
          href={`/matches/${match.id}`}
          className="text-xs text-emerald-900 underline underline-offset-2"
        >
          See everyone&apos;s picks
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2">
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-amber-900">
        Kicks off in
      </span>
      <span className="text-xs font-semibold tabular-nums text-amber-900">
        {left !== null ? formatCountdown(left) : ""}
      </span>
      <Link
        href={`/matches/${match.id}`}
        className="ml-auto shrink-0 text-xs font-medium text-amber-900 underline underline-offset-2"
      >
        Predict
      </Link>
    </div>
  );
}
