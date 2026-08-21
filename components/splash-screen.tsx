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
  /**
   * Once per browsing session, not once per page load.
   *
   * Reconnecting after losing signal triggers a reload, and so does
   * cold-starting the installed app — without this, the logo animation
   * played every single time, which is exhausting rather than branded.
   *
   * A session cookie: it clears itself when the browser closes, so the
   * next real visit sees it again. Read lazily rather than in an effect,
   * so it never flashes before being suppressed.
   */
  const [phase, setPhase] = useState<"visible" | "fading" | "gone">(() =>
    typeof document !== "undefined" &&
    document.cookie.includes("wl_splash_seen=1")
      ? "gone"
      : "visible"
  );

  useEffect(() => {
    if (phase === "gone") return;
    document.cookie = "wl_splash_seen=1; path=/; SameSite=Lax";

    const hold = setTimeout(() => setPhase("fading"), HOLD_MS);
    const done = setTimeout(() => setPhase("gone"), HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(hold);
      clearTimeout(done);
    };
    // Runs once; phase changes are driven by the timers above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      aria-hidden
      // Brand yellow in light, the app's own near-black in dark. Fully
      // opaque so nothing shows through mid-hydration.
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-amber-400 transition-opacity duration-300 dark:bg-stone-50 ${
        phase === "fading" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <Wordmark size="lg" tagline priority />
    </div>
  );
}
