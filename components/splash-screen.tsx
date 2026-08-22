"use client";

import { useEffect, useState } from "react";
import { Wordmark } from "@/components/wordmark";

/** Matches the animation in globals.css, plus a little slack. */
const REMOVE_AFTER_MS = 1600;

/**
 * The screen while the app starts.
 *
 * Two deliberate choices, both learned the hard way:
 *
 * 1. Whether to show it at all is decided on the SERVER, from a cookie,
 *    in the root layout. Deciding on the client meant the server
 *    rendered it visible and the client rendered nothing — a hydration
 *    mismatch, and when hydration breaks the timers that dismiss it
 *    never run. The result was a yellow screen with no way out.
 *
 * 2. The fade is a CSS animation, not a JS timer. If hydration fails for
 *    any other reason, the animation still runs and the app is still
 *    usable. The timer below only removes the element afterwards; it
 *    isn't what makes it disappear.
 */
export function SplashScreen() {
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    // Remembered for the session so it doesn't replay on every reload —
    // and reconnecting after losing signal causes a reload.
    document.cookie = "wl_splash_seen=1; path=/; SameSite=Lax";

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
