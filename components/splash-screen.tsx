"use client";

import { useEffect, useState } from "react";
import { Wordmark } from "@/components/wordmark";

/** Long enough to register, short enough not to be in the way. */
const HOLD_MS = 900;
const FADE_MS = 320;

/**
 * The screen while the app starts.
 *
 * Matters most installed to the home screen, where a cold start shows a
 * blank frame for a beat and reads as the app being broken. On the open
 * web the browser already shows something, so it's only ever a moment.
 *
 * Once per page load, not per navigation — an app that flashes its logo
 * every time you tap a tab is exhausting.
 */
export function SplashScreen() {
  const [phase, setPhase] = useState<"visible" | "fading" | "gone">("visible");

  useEffect(() => {
    const hold = setTimeout(() => setPhase("fading"), HOLD_MS);
    const done = setTimeout(() => setPhase("gone"), HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(hold);
      clearTimeout(done);
    };
  }, []);

  if (phase === "gone") return null;

  return (
      <div
          aria-hidden
          // Brand yellow in light, the app's own near-black in dark. Fully
          // opaque so nothing shows through mid-hydration.
          className={`fixed inset-0 z-[100] flex items-center justify-center px-8 bg-amber-400 transition-opacity duration-300 dark:bg-stone-50 ${
              phase === "fading" ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
          style={{
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
      >
        {/* Whole square, contained — the tagline can't be clipped because
          nothing is cropped. */}
        <Wordmark size="lg" tagline priority className="max-w-full" />
      </div>
  );
}