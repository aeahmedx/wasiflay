"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { callGoal, getGoalBurst, TooSoonError } from "@/lib/queries/predictions";
import { announceIfOffline } from "@/lib/offline";

/** Matches the window in goal_burst(). */
const WINDOW_MS = 45_000;

/**
 * GOAL.
 *
 * Deliberately not a score. It reports that people reacted — "14 said
 * GOAL" — and claims nothing about what the scoreline is.
 *
 * A crowd-voted score would be gamed by whoever is loudest in the room,
 * would drift once people stopped bothering to tap, and would end up
 * contradicting the official result in front of everyone. This has all
 * the energy and none of the false authority: it cannot be wrong,
 * because it asserts nothing.
 */
export function GoalButton({
  roomId,
  canPost,
}: {
  roomId: string;
  canPost: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [burst, setBurst] = useState(0);
  const [mine, setMine] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fade = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    setBurst(await getGoalBurst(supabase, roomId));
  }, [supabase, roomId]);

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel(`goals:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "goal_calls",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          // A burst is many inserts in a second or two; one refetch is
          // enough and keeps the count honest rather than guessed.
          if (debounce) clearTimeout(debounce);
          debounce = setTimeout(() => void refresh(), 400);
        }
      )
      .subscribe();

    // Deferred rather than called straight from the effect body: an
    // update kicked off during the effect costs an extra render pass
    // before paint, and this number is never urgent enough to warrant
    // one.
    const first = setTimeout(() => void refresh(), 0);

    // The window slides, so the count has to fall on its own once
    // people stop — otherwise a burst from ten minutes ago sits there
    // looking live.
    const tick = setInterval(() => void refresh(), 15_000);

    return () => {
      if (debounce) clearTimeout(debounce);
      clearTimeout(first);
      clearInterval(tick);
      void supabase.removeChannel(channel);
    };
  }, [supabase, roomId, refresh]);

  useEffect(() => {
    return () => {
      if (fade.current) clearTimeout(fade.current);
    };
  }, []);

  async function shout() {
    if (!canPost) return;
    if (announceIfOffline()) return;

    // Optimistic: the tap should land before the round trip.
    setMine(true);
    setBurst((b) => b + 1);
    setNote(null);

    if (fade.current) clearTimeout(fade.current);
    fade.current = setTimeout(() => setMine(false), WINDOW_MS);

    try {
      const count = await callGoal(supabase, roomId);
      setBurst(count);
    } catch (e) {
      setMine(false);
      setBurst((b) => Math.max(0, b - 1));
      setNote(
        e instanceof TooSoonError ? "Already counted you" : "Didn't register"
      );
      setTimeout(() => setNote(null), 2000);
    }
  }

  if (!canPost) {
    // Still worth seeing the room react, even if you can't join in.
    return burst > 1 ? (
      <div className="px-4 pb-2 text-center text-sm font-medium text-amber-900">
        {burst} said GOAL
      </div>
    ) : null;
  }

  return (
    <div className="flex items-center gap-2 px-3 pb-2">
      <button
        type="button"
        onClick={shout}
        aria-label="Shout goal"
        className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold tracking-wide transition ${
          mine
            ? "bg-emerald-800 text-stone-0"
            : "bg-amber-400 text-on-brand active:scale-95"
        }`}
      >
        GOAL
      </button>

      {/* Only once it's a crowd. One person tapping isn't news, and
          showing "1 said GOAL" makes the room look empty. */}
      {burst > 1 && (
        <span className="text-sm font-medium text-amber-900">
          {burst} said GOAL
        </span>
      )}

      {note && <span className="text-sm text-stone-500">{note}</span>}
    </div>
  );
}
