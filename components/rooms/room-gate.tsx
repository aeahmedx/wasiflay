"use client";

import Link from "next/link";
import { formatCountdown, useCountdown } from "@/lib/hooks/use-now";
import type { Room } from "@/lib/queries/messages";
import type { NextFixture } from "@/lib/queries/room-match";

/**
 * What sits where the message box would be, when a match room isn't
 * open for posting.
 *
 * Deliberately in that exact spot rather than as a banner up top. The
 * composer is where someone's thumb goes and where their eye lands when
 * they want to say something — an explanation anywhere else is an
 * explanation they'll never read, and they'll conclude the app is
 * broken instead.
 *
 * Two cases:
 *
 *   waiting  a countdown to kickoff, and somewhere to go meanwhile
 *   closed   the final score, and the next fixture
 *
 * The database enforces both through the insert policy — this only
 * explains what it's already doing.
 */
export function RoomGate({
  room,
  nextFixture,
}: {
  room: Room;
  nextFixture: NextFixture | null;
}) {
  const left = useCountdown(room.match_kicks_off_at);

  if (room.chat_state === "waiting") {
    return (
      <div
        className="shrink-0 border-t border-stone-200 bg-stone-0 px-4 py-4 text-center"
        style={{
          paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
        }}
      >
        <p className="text-sm font-semibold text-stone-900">
          Chat opens at kickoff
        </p>

        <p className="mt-1 text-2xl font-bold tabular-nums text-amber-600">
          {left !== null ? formatCountdown(left) : "\u00a0"}
        </p>

        <p className="mt-1.5 text-sm text-stone-600">
          Come back when it starts. Get your score in before then.
        </p>

        {room.match_id && (
          <Link
            href={`/matches/${room.match_id}`}
            className="mt-3 inline-block rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-on-brand"
          >
            Predict the score
          </Link>
        )}
      </div>
    );
  }

  // closed — the result goes where the message box was.
  return (
    <div
      className="shrink-0 border-t border-stone-200 bg-stone-100 px-4 py-4 text-center"
      style={{
        paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
      }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
        Full time
      </p>

      {room.match_home_score !== null && room.match_away_score !== null ? (
        <p className="mt-0.5 text-xl font-bold text-stone-900" dir="auto">
          {room.match_home_team} {room.match_home_score}
          {"\u2013"}
          {room.match_away_score} {room.match_away_team}
        </p>
      ) : (
        <p className="mt-0.5 text-lg font-semibold text-stone-900">
          This one is over
        </p>
      )}

      <p className="mt-1.5 text-sm text-stone-600">
        Chat is closed. You can still read everything said.
      </p>

      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {room.match_id && (
          <Link
            href={`/matches/${room.match_id}`}
            className="rounded-lg border border-stone-300 bg-stone-0 px-4 py-2 text-sm font-medium text-stone-800"
          >
            See who called it
          </Link>
        )}

        {nextFixture ? (
          <Link
            href={
              nextFixture.room_slug
                ? `/rooms/${nextFixture.room_slug}`
                : `/matches/${nextFixture.id}`
            }
            className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-on-brand"
            dir="auto"
          >
            Next: {nextFixture.home_team} v {nextFixture.away_team}
          </Link>
        ) : (
          <Link
            href="/matches"
            className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-on-brand"
          >
            All matches
          </Link>
        )}
      </div>
    </div>
  );
}
