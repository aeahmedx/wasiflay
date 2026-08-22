"use client";

import { useEffect } from "react";

/** How long after the last activity the app counts as a cold start. */
export const ACTIVE_WINDOW_SECONDS = 10 * 60;

/** Refreshed well inside the window, so it can't lapse mid-session. */
const REFRESH_MS = 2 * 60 * 1000;

export const ACTIVE_COOKIE = "wl_active";

function markActive() {
  document.cookie = `${ACTIVE_COOKIE}=1; path=/; max-age=${ACTIVE_WINDOW_SECONDS}; SameSite=Lax`;
}

/**
 * Marks the session as live so the splash only appears on a genuine
 * cold start.
 *
 * The trick is that there is no arithmetic here. The cookie carries its
 * own expiry — present means "active within the last ten minutes",
 * absent means "cold". Comparing a timestamp written by a phone against
 * the server's clock would work until it met a device with the wrong
 * date, and then it would fail in a way nobody could reproduce.
 *
 * Refreshed on mount, every two minutes while the tab is visible, and
 * whenever it becomes visible again. Deliberately NOT refreshed while
 * hidden: an app left open in the background for an hour should feel
 * like a cold start when you come back to it, because it is one.
 */
export function ActivityPing() {
  useEffect(() => {
    markActive();

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") markActive();
    }, REFRESH_MS);

    function onVisible() {
      if (document.visibilityState === "visible") markActive();
    }

    // pagehide rather than unload: iOS often skips unload entirely, and
    // this is the last reliable moment to record that the session was
    // alive right up to the point they left.
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", markActive);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", markActive);
    };
  }, []);

  return null;
}
