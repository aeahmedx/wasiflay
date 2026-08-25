"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCountdown, useCountdown } from "@/lib/hooks/use-now";
import type { Room } from "@/lib/queries/messages";
import type { NextFixture } from "@/lib/queries/room-match";

/** How often to keep asking, once the clock has passed kickoff. */
const RECHECK_MS = 4000;

/**
 * What sits where the message box would be, when a match room isn't
 * open for posting.
 *
 * Deliberately in that exact spot rather than as a banner up top. The
 * composer is where a thumb goes and where the eye lands when someone
 * wants to say something — an explanation anywhere else is one they'll
 * never read, and they'll conclude the app is broken instead.
 */
export function RoomGate({
  room,
  nextFixture,
}: {
  room: Room;
  nextFixture: NextFixture | null;
}) {
  const router = useRouter();
  const left = useCountdown(room.match_kicks_off_at);

  /**
   * Kickoff fires no database event — the room opens because time moved,
   * and nothing in any table changes. So nothing is listening, and this
   * has to notice for itself.
   *
   * The first attempt at this depended on the countdown value, which
   * changes every second: each tick re-ran the effect, the cleanup
   * cancelled the pending refresh, and a guard stopped it rescheduling.
   * It never fired once. Hence "Starting…" forever.
   *
   * This depends only on the kickoff time and the state, both stable —
   * so it schedules once. And it keeps rechecking rather than trying
   * once, because the server's clock may reach kickoff a moment after
   * the browser's, and a single early attempt would come back
   * "waiting" and give up.
   */
  useEffect(() => {
    if (room.chat_state !== "waiting" || !room.match_kicks_off_at) return;

    const until = new Date(room.match_kicks_off_at).getTime() - Date.now();
    let interval: ReturnType<typeof setInterval> | null = null;

    // A second of slack so the server has certainly passed kickoff too.
    const first = setTimeout(() => {
      router.refresh();
      interval = setInterval(() => router.refresh(), RECHECK_MS);
    }, Math.max(until + 1000, 0));

    return () => {
      clearTimeout(first);
      if (interval) clearInterval(interval);
    };
    // Stable deps on purpose — see above.
  }, [room.chat_state, room.match_kicks_off_at, router]);

  if (room.chat_state === "waiting") {
    const starting = left !== null && left <= 0;

    return (
      <div
        className="shrink-0 border-t border-stone-200 bg-stone-0 px-4 py-4 text-center"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <p className="text-sm font-semibold text-stone-900">
          {starting ? "Kicking off" : "Chat opens at kickoff"}
        </p>

        <p className="mt-1 text-2xl font-bold tabular-nums text-amber-600">
          {left === null
            ? "\u00a0"
            : starting
            ? "Opening…"
            : formatCountdown(left)}
        </p>

        <p className="mt-1.5 text-sm text-stone-600">
          {starting
            ? "One moment."
            : "Come back when it starts. Get your score in before then."}
        </p>

        {!starting && room.match_id && (
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
      style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
        {room.match_status === "finished" ? "Full time" : "Chat paused"}
      </p>

      {room.match_home_score !== null && room.match_away_score !== null ? (
        <p className="mt-0.5 text-xl font-bold text-stone-900" dir="auto">
          {room.match_home_team} {room.match_home_score}
          {"\u2013"}
          {room.match_away_score} {room.match_away_team}
        </p>
      ) : (
        <p className="mt-0.5 text-lg font-semibold text-stone-900">
          {room.match_status === "finished"
            ? "This one is over"
            : "Paused by a moderator"}
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
