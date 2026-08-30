"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCountdown, useCountdown } from "@/lib/hooks/use-now";
import type { GateState } from "@/lib/queries/gate";
import { Wordmark } from "@/components/wordmark";
import { GateShare } from "@/components/gate/gate-share";
import { GateInstall } from "@/components/gate/gate-install";
import { GateMatchList } from "@/components/gate/gate-match-list";
import type { GateMatch } from "@/lib/queries/gate";

/** How often to recheck once the clock has passed opening time. */
const RECHECK_MS = 5000;

/**
 * What everyone sees for the week before the tournament.
 *
 * Deliberately not a wall. Signing in works and predicting the first
 * match works, because a countdown with nothing to do is a page nobody
 * returns to — and returning is the whole job of this page.
 *
 * Two things carry it. The footage, because a community recognises
 * itself faster than it reads anything. And the names of people who
 * have already picked, because nothing persuades like knowing someone
 * you know is already in.
 */
export function GateView({
  state,
  matches,
  signedIn,
  userId,
}: {
  state: GateState;
  /** The fixtures revealed so far. Grows as the week goes. */
  matches: GateMatch[];
  signedIn: boolean;
  userId: string | null;
}) {
  const router = useRouter();

  const untilOpen = useCountdown(state.opens_at);
  const untilKickoff = useCountdown(state.kicks_off_at);

  /**
   * Opening fires no database event — the app unlocks because a time
   * passed. So this notices for itself, and keeps asking rather than
   * trying once: the server's clock may reach midnight a moment after
   * the browser's, and a single early attempt would be told the gate is
   * still shut and give up.
   *
   * Deps are the opening time only — not the ticking countdown, which
   * would rebuild the timer every second and cancel it before it fired.
   */
  useEffect(() => {
    if (!state.opens_at) return;

    const wait = new Date(state.opens_at).getTime() - Date.now();
    let interval: ReturnType<typeof setInterval> | null = null;

    const first = setTimeout(() => {
      router.refresh();
      interval = setInterval(() => router.refresh(), RECHECK_MS);
    }, Math.max(wait + 1000, 0));

    return () => {
      clearTimeout(first);
      if (interval) clearInterval(interval);
    };
  }, [state.opens_at, router]);

  const opensSoon = untilOpen !== null && untilOpen <= 0;

  /**
   * The one second this page exists for.
   *
   * Between the clock hitting zero and the server agreeing there is a
   * gap of a second or two, and a blank "Opening…" through it wastes
   * the only genuinely dramatic moment the app will ever have. So the
   * gap gets used.
   */
  if (opensSoon) {
    return (
      <main className="gate-surface flex min-h-dvh flex-col items-center justify-center bg-amber-400 px-8 text-center">
        <div className="animate-pulse">
          <Wordmark size="lg" priority />
        </div>
        <p className="mt-8 text-3xl font-black leading-tight tracking-tight text-on-brand">
          Let the games
          <br />
          begin
        </p>
        <p className="mt-4 text-sm font-medium text-on-brand opacity-70">
          Opening everything…
        </p>
      </main>
    );
  }

  const names = state.recent_names ?? [];
  const others = Math.max(state.prediction_count - names.length, 0);

  return (
    <main className="gate-surface min-h-dvh bg-amber-400">
      {/* --- the footage ------------------------------------------- */}
      {/* The dark backing shows for the fraction of a second before the
          first frame decodes. A poster image did that job before, but a
          compressed still of night footage looked worse than the video
          it was standing in for — better a clean dark field than a bad
          photograph. */}
      {/*
        Height follows the footage rather than the viewport. The clip is
        cropped to a banner now, so a fixed height would crop it a
        second time and throw away the framing that was just chosen.

        Capped anyway, so a very wide screen doesn't hand the whole
        first view to a video.
      */}
      <div className="relative aspect-[800/336] max-h-[380px] w-full overflow-hidden bg-stone-900">
        <video
          className="h-full w-full object-cover"
          src="/tournament.mp4"
          autoPlay
          loop
          muted
          playsInline
          // Decorative: it carries feeling, not information, so a
          // screen reader has nothing useful to say about it.
          aria-hidden
        />

        {/* Fades into the page so the video ends rather than stops. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-24"
          style={{
            background:
              "linear-gradient(to bottom, rgba(245,166,35,0) 0%, rgba(245,166,35,0.6) 50%, rgba(245,166,35,0.94) 80%, #f5a623 100%)",
          }}
        />
      </div>

      <div
        className="mx-auto -mt-6 flex w-full max-w-sm flex-col px-6"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex justify-center">
          <Wordmark size="md" priority />
        </div>

        {/* Below the wordmark: it reads as a credit line, and a credit
            line goes under the name it credits. */}
        <p className="mt-0.5 text-center text-sm italic text-on-brand opacity-60">
          presents
        </p>

        <h1 className="mt-3 text-center text-[2.6rem] font-black leading-[0.95] tracking-[-0.02em] text-on-brand">
          Call every
          <br />
          score.
        </h1>

        <p className="mt-4 text-center text-[15px] leading-relaxed text-on-brand opacity-75">
          Twenty-five years of this tournament and nobody has ever won
          the picks. Two days, thirty-one matches, one board.
        </p>

        <Link
          href="/welcome"
          className="mx-auto mt-5 block rounded-lg border-2 on-brand-border px-7 py-2.5 text-sm font-bold text-on-brand"
        >
          Welcome
        </Link>

        {/* --- the schedule sheet ---------------------------------- */}
        <section className="mt-8 rounded-lg bg-stone-0 px-4 pb-4 pt-3.5">
          <div className="flex items-baseline justify-between gap-3 border-b-2 border-stone-900/15 pb-2.5">
            <h2 className="text-base font-bold text-stone-900">
              {matches.length > 1
                ? `First ${matches.length} matches`
                : "First match"}
            </h2>

            {state.prediction_count >= 10 && (
              <p className="text-[13px] text-stone-500">
                {state.prediction_count} picks in
              </p>
            )}
          </div>

          {matches.length === 0 ? (
            <p className="py-6 text-center text-[15px] text-stone-500">
              Fixtures go up here as soon as the schedule lands.
            </p>
          ) : (
            <>
              <GateMatchList matches={matches} signedIn={signedIn} />

              {/*
                The blocker isn't missing information, it's feeling
                unqualified to answer. Saying nobody knows anything
                removes that — and it's true, which is what makes the
                whole thing fair.
              */}
              <p className="mt-3 border-t border-stone-900/10 pt-3 text-[13px] leading-relaxed text-stone-500">
                Nobody knows anything yet. That&apos;s the fun of it —
                change your picks any time before kickoff, and more
                matches open through the week.
              </p>
            </>
          )}

          {!signedIn && matches.length > 0 && (
            <Link
              href={`/signup?next=${encodeURIComponent("/gate")}`}
              className="mt-3 block rounded-lg bg-emerald-800 px-4 py-3 text-center font-semibold text-stone-0"
            >
              Sign in to save your picks
            </Link>
          )}

          {names.length > 0 && (
            <p className="mt-3 border-t border-stone-900/10 pt-3 text-[13px] leading-relaxed text-stone-600">
              <span className="font-semibold text-stone-900" dir="auto">
                {names.slice(0, 3).join(", ")}
              </span>
              {others > 0 ? (
                <> and {others} others have picked already</>
              ) : names.length === 1 ? (
                <> has picked already</>
              ) : (
                <> have picked already</>
              )}
            </p>
          )}
        </section>

        {/* Pointing at the official app costs nothing and makes this
            look like a good citizen of the weekend rather than a rival
            — they run the tournament, this runs the picks. */}
        <div className="mt-5 rounded-lg bg-stone-0/90 px-4 py-3">
          <p className="text-sm font-semibold text-stone-900">
            Fixtures, brackets and results
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-stone-600">
            SASF runs the tournament on the Dawrat app. Get it for the
            official schedule — then come back here to call the scores.
          </p>
          <div className="mt-2.5 flex gap-2">
            <a
              href="https://apps.apple.com/us/app/aldawrat/id6477748398"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-center text-sm font-medium text-stone-800"
            >
              App Store
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.ahmed.dawrat"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-center text-sm font-medium text-stone-800"
            >
              Google Play
            </a>
          </div>
        </div>

        {/* --- the prize ------------------------------------------- */}
        <div className="mt-5 flex items-start gap-3 rounded-lg border-2 on-brand-border-soft px-4 py-3">
          <span aria-hidden className="text-2xl leading-none">
            🏆
          </span>
          <p className="text-sm leading-relaxed text-on-brand">
            <span className="font-bold">Nobody has ever won this.</span>{" "}
            Whoever tops the board is the first name on it, and that name
            stays on it.
          </p>
        </div>

        {/* Rules and Share sit together: one explains it, the other
            passes it on, and both are things you do once you've read
            far enough to care. */}
        <div className="mt-5 flex items-center justify-center gap-3">
          <Link
            href="/rules"
            className="block rounded-lg border-2 on-brand-border px-7 py-2.5 text-sm font-bold text-on-brand"
          >
            Rules
          </Link>
          <GateShare />
        </div>

        <GateInstall />

        {/* --- the countdown --------------------------------------- */}
        <div className="mt-8 text-center">
          {opensSoon ? (
            <p className="text-lg font-bold text-on-brand">Opening…</p>
          ) : untilOpen !== null ? (
            <>
              <p className="text-[2.5rem] font-black leading-none tabular-nums text-on-brand">
                {formatCountdown(untilOpen)}
              </p>
              <p className="mt-1.5 text-sm text-on-brand opacity-70">
                until everything opens
              </p>
            </>
          ) : (
            <p className="text-sm font-medium text-on-brand opacity-70">
              Opening soon
            </p>
          )}

          <p className="mt-3 text-[13px] leading-relaxed text-on-brand opacity-60">
            Then the rooms open, the board goes live, and the rest of the
            app comes with it.
          </p>
        </div>
      </div>
    </main>
  );
}
