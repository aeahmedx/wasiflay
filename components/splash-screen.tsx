"use client";

import { useEffect, useState } from "react";
import { Wordmark } from "@/components/wordmark";

/** Matches the animation in globals.css, plus a little slack. */
const REMOVE_AFTER_MS = 1600;

/**
 * The screen while the app starts.
 *
 * Only rendered on a cold start — the root layout decides, from a
 * cookie that expires ten minutes after the last activity. Reloading,
 * reconnecting after losing signal, or coming back a minute later all
 * skip it; opening the app fresh in the morning shows it.
 *
 * Two things learned the hard way:
 *
 * 1. Whether it renders is decided on the SERVER. Deciding on the
 *    client meant the server rendered it visible and the client
 *    rendered nothing — a hydration mismatch, and a broken hydration
 *    meant the timers that dismissed it never ran. People were left
 *    staring at a yellow screen with no way out.
 *
 * 2. The fade is a CSS animation, not a JS timer. If hydration fails
 *    for any other reason, the animation still runs and the app is
 *    still usable. The timer below only removes the element afterwards;
 *    it is not what makes it disappear.
 */
export function SplashScreen() {
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(false), REMOVE_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  return (
    <div
      aria-hidden
      className="wl-splash pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-amber-400 px-8 dark:bg-stone-50"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <Wordmark size="lg" tagline priority />
    </div>
  );
}
