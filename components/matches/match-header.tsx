"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { kickoffLabel, type Match } from "@/lib/queries/predictions";
import { PredictForm } from "@/components/matches/predict-form";

/**
 * The match, on its own page.
 *
 * Deliberately not the tournament block: that one links out to "all
 * picks" and the leaderboard, which on this page would be a link to
 * itself. Same information, none of the navigation that only makes
 * sense from somewhere else.
 */
export function MatchHeader({
  match,
  userId,
}: {
  match: Match;
  userId: string | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [picking, setPicking] = useState(false);
  const [justPicked, setJustPicked] = useState<[number, number] | null>(null);
  // Server snapshot is null, so the server never renders a time — see
  // the note in tournament-block.tsx.
  const now = useSyncExternalStore(
    (onTick) => {
      const timer = setInterval(onTick, 1000);
      return () => clearInterval(timer);
    },
    () => Date.now(),
    () => null
  );

  useEffect(() => {
    const channel = supabase
      .channel(`match-page:${match.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${match.id}`,
        },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, match.id, router]);

  const kickedOff =
    now !== null && new Date(match.kicks_off_at).getTime() - now <= 0;
  const open = match.is_open && !kickedOff;
  const finished = match.status === "finished";
  const serverPick =
    match.my_home !== null
      ? ([match.my_home, match.my_away] as [number, number])
      : null;
  // Shown immediately on save; the refresh behind it confirms.
  const pick = justPicked ?? serverPick;
  const hasPick = pick !== null;

  return (
    <section className="rounded-lg border border-stone-200 bg-stone-0 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
        {finished ? "Full time" : open ? "Kicks off" : "Playing now"}
      </p>

      <p className="mt-1 text-xl font-semibold text-stone-900" dir="auto">
        {match.home_team}
        {finished ? ` ${match.home_score}\u2013${match.away_score} ` : " v "}
        {match.away_team}
      </p>

      <p className="mt-0.5 text-sm text-stone-600">
        {kickoffLabel(match.kicks_off_at)}
        {match.prediction_count >= 10
          ? ` · ${match.prediction_count} predictions`
          : ""}
      </p>

      {picking && userId ? (
        <div className="mt-3">
          <PredictForm
            match={match}
            onDoneAction={(hs, as_) => {
              setJustPicked([hs, as_]);
              setPicking(false);
            }}
          />
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {hasPick && (
            <span className="rounded-full bg-stone-100 px-3 py-1.5 text-sm font-medium text-stone-900">
              You said {pick[0]}
              {"\u2013"}
              {pick[1]}
            </span>
          )}

          {open &&
            (userId ? (
              <button
                onClick={() => setPicking(true)}
                className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-stone-0"
              >
                {hasPick ? "Change it" : "Predict the score"}
              </button>
            ) : (
              <Link
                href={`/signup?next=${encodeURIComponent(
                  `/matches/${match.id}`
                )}`}
                className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-stone-0"
              >
                Sign in to predict
              </Link>
            ))}

          {!open && !hasPick && !finished && (
            <span className="text-sm text-stone-600">Picks closed</span>
          )}

          {match.room_slug && (
            <Link
              href={`/rooms/${match.room_slug}`}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-800"
            >
              Join the room
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
