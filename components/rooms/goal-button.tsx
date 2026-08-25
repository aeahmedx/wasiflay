"use client";

import { useEffect, useRef, useState } from "react";
import { announceIfOffline } from "@/lib/offline";

/** Long enough to feel like something happened, short enough not to
 *  sit on top of the conversation. */
const CONFETTI_MS = 1400;

/** Stops a held finger firing ten in a row without policing enthusiasm. */
const COOLDOWN_MS = 2500;

const COLOURS = ["#f5a623", "#46300c", "#0f7b4f", "#e8c98a", "#ffffff"];

/**
 * GOAL.
 *
 * Sends a message. That's the whole design.
 *
 * The first version kept its own table and showed a live count of how
 * many people had tapped, which needed a time window, a rate limit, and
 * a rule for what the number meant — three things to tune and a number
 * that could be wrong in front of everyone.
 *
 * A message inherits everything that already works here: moderation,
 * blocking, rate limiting, realtime delivery, the offline queue,
 * ordering. Nothing new to get right. And it cannot be wrong, because
 * it is not claiming anything about the score — someone said GOAL, and
 * there it is in the conversation with their name on it.
 *
 * The confetti is local and purely for the person who tapped. Everyone
 * else just sees the message, which is the honest version of what
 * happened.
 */
export function GoalButton({
  onGoalAction,
  canPost,
}: {
  /** Sends the message. Reuses the room's own send path, so a failed
   *  send queues and retries exactly like any other message. */
  onGoalAction: (body: string) => void;
  canPost: boolean;
}) {
  const [bursting, setBursting] = useState(false);
  const [cooling, setCooling] = useState(false);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coolTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (burstTimer.current) clearTimeout(burstTimer.current);
      if (coolTimer.current) clearTimeout(coolTimer.current);
    };
  }, []);

  if (!canPost) return null;

  function shout() {
    if (cooling) return;
    if (announceIfOffline()) return;

    onGoalAction("⚽ GOAL");

    setBursting(true);
    setCooling(true);

    if (burstTimer.current) clearTimeout(burstTimer.current);
    burstTimer.current = setTimeout(() => setBursting(false), CONFETTI_MS);

    if (coolTimer.current) clearTimeout(coolTimer.current);
    coolTimer.current = setTimeout(() => setCooling(false), COOLDOWN_MS);
  }

  return (
    <div className="relative px-3 pb-2">
      <button
        type="button"
        onClick={shout}
        disabled={cooling}
        aria-label="Shout goal"
        className={`w-full rounded-lg bg-amber-400 py-2 text-sm font-bold tracking-widest text-on-brand transition active:scale-[0.98] ${
          cooling ? "opacity-50" : ""
        }`}
      >
        ⚽ GOAL
      </button>

      {bursting && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 overflow-hidden"
        >
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="absolute block h-2 w-2 rounded-[1px]"
              style={{
                left: `${(i * 5.5 + 6) % 96}%`,
                bottom: 0,
                background: COLOURS[i % COLOURS.length],
                // Staggered so it reads as a burst rather than a row.
                animation: `wl-confetti ${900 + (i % 5) * 140}ms ease-out ${
                  (i % 6) * 45
                }ms forwards`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
