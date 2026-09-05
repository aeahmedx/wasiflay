"use client";

import { useEffect, useState } from "react";

const COOKIE = "wl_prize";
/** A year: this is a one-time announcement, not a recurring banner. */
const MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The first thing anyone sees, once.
 *
 * Someone who scans a card at the tournament has about two seconds of
 * attention. This spends all of it on the one fact that makes them stay
 * — there is $250 on the board and nobody has ever won it — and then
 * gets out of the way.
 *
 * Shown once ever, tracked by cookie. A returning visitor who clears
 * their cookies sees it again, which is a far better failure than a
 * splash that reappears every morning of the weekend.
 *
 * Rendered on mount rather than during the server pass so it can read
 * the cookie: the gate is a static-ish page and the splash is personal.
 */
export function PrizeSplash() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Deferred so nothing updates state during the mount pass, and so
    // the page behind it paints first — the splash landing on top of a
    // rendered page reads as intentional, on top of a blank one reads
    // as a loading screen.
    const timer = setTimeout(() => {
      const seen = document.cookie
        .split("; ")
        .some((c) => c.startsWith(`${COOKIE}=`));

      if (!seen) setShow(true);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    document.cookie = `${COOKIE}=1; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prize-heading"
      className="fixed inset-0 z-50 flex flex-col justify-end bg-stone-900/60 sm:items-center sm:justify-center"
    >
      <div className="brand-surface w-full max-w-md rounded-t-2xl bg-amber-400 px-6 pt-7 sm:rounded-2xl">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-on-brand opacity-70">
          Tournament weekend
        </p>

        <p className="mt-3 text-center text-[4rem] font-black leading-none tracking-tight text-on-brand">
          $250
        </p>

        <h2
          id="prize-heading"
          className="mt-3 text-center text-xl font-bold leading-snug text-on-brand"
        >
          to whoever calls it best
        </h2>

        <p className="mt-3 text-center text-[15px] leading-relaxed text-on-brand opacity-85">
          Predict the score of every match this weekend. Closest calls
          climb the board. Whoever is top after the final takes the $250
          and goes down as the first name on it.
        </p>

        <p className="mt-3 text-center text-sm leading-relaxed text-on-brand opacity-75">
          Free to enter. Twenty-five years of this tournament and nobody
          has ever won the predictions, because this is the first year
          there are any.
        </p>

        <button
          type="button"
          onClick={dismiss}
          className="mt-6 w-full rounded-lg bg-emerald-800 px-4 py-3.5 text-center text-base font-semibold text-stone-0"
        >
          Enter
        </button>

        <p
          className="pb-5 pt-3 text-center text-xs text-on-brand opacity-60"
          style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
        >
          No entry fee. Full rules in the app.
        </p>
      </div>
    </div>
  );
}
