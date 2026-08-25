"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCountdown, useCountdown } from "@/lib/hooks/use-now";
import type { GateState } from "@/lib/queries/gate";
import type { Match } from "@/lib/queries/predictions";
import { PredictForm } from "@/components/matches/predict-form";
import { Wordmark } from "@/components/wordmark";

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
  signedIn,
  userId,
}: {
  state: GateState;
  signedIn: boolean;
  userId: string | null;
}) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [justPicked, setJustPicked] = useState<[number, number] | null>(null);

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

  const pick =
    justPicked ??
    (state.my_home !== null
      ? ([state.my_home, state.my_away] as [number, number])
      : null);

  const featured: Match | null =
    state.match_id && state.kicks_off_at
      ? ({
          id: state.match_id,
          home_team: state.home_team ?? "",
          away_team: state.away_team ?? "",
          kicks_off_at: state.kicks_off_at,
          round: "group",
          status: "scheduled",
          home_score: null,
          away_score: null,
          locked_at: null,
          room_id: null,
          room_slug: null,
          is_open: true,
          prediction_count: state.prediction_count,
          my_home: pick?.[0] ?? null,
          my_away: pick?.[1] ?? null,
          my_points: null,
          my_tier: null,
          created_at: state.kicks_off_at,
        } as Match)
      : null;

  const names = state.recent_names ?? [];
  const others = Math.max(state.prediction_count - names.length, 0);

  return (
    <main className="min-h-dvh bg-amber-400">
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
        <p className="mt-0.5 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-on-brand opacity-70">
          presents
        </p>

        <h1 className="mt-3 text-center text-[2rem] font-black leading-[1.05] tracking-tight text-on-brand">
          2026 Tournament
          <br />
          Experience
        </h1>

        <p className="mt-3 text-center text-sm font-medium leading-relaxed text-on-brand opacity-80">
          Call every score. Argue in the rooms. Finish top of a board
          nobody has ever topped.
        </p>

        <Link
          href="/welcome"
          className="mx-auto mt-5 block rounded-lg border-2 border-on-brand px-7 py-2.5 text-sm font-bold text-on-brand"
        >
          Welcome
        </Link>

        {/* --- the first match ------------------------------------- */}
        <section className="mt-7 overflow-hidden rounded-xl bg-stone-0 shadow-sm">
          <div className="px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
              First match
            </p>

            {!featured ? (
              <>
                <p className="mt-1 text-xl font-bold text-stone-900">
                  Announced soon
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  The fixture goes up here the moment the schedule lands.
                </p>
              </>
            ) : !state.teams_announced ? (
              <>
                <p className="mt-1 text-xl font-bold text-stone-900">
                  Teams announced soon
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  Sign in now and you can call the score the moment they
                  drop.
                </p>
              </>
            ) : (
              <>
                <p
                  className="mt-1 text-xl font-bold leading-tight text-stone-900"
                  dir="auto"
                >
                  {state.home_team}{" "}
                  <span className="text-stone-400">v</span>{" "}
                  {state.away_team}
                </p>
                {untilKickoff !== null && untilKickoff > 0 && (
                  <p className="mt-1 text-sm font-medium tabular-nums text-stone-600">
                    Kicks off in {formatCountdown(untilKickoff)}
                  </p>
                )}
              </>
            )}

            {picking && featured && userId ? (
              <div className="mt-3">
                <PredictForm
                  match={featured}
                  onDoneAction={(h: number, a: number) => {
                    setJustPicked([h, a]);
                    setPicking(false);
                  }}
                />
              </div>
            ) : (
              <div className="mt-3">
                {pick && (
                  <p className="mb-2 rounded-full bg-stone-100 px-3 py-1.5 text-center text-sm font-medium tabular-nums text-stone-800">
                    You said {pick[0]}
                    {"\u2013"}
                    {pick[1]}
                  </p>
                )}

                {!signedIn ? (
                  <Link
                    href={`/signup?next=${encodeURIComponent("/gate")}`}
                    className="block rounded-lg bg-emerald-800 px-4 py-3 text-center font-semibold text-stone-0"
                  >
                    {state.teams_announced
                      ? "Make your prediction"
                      : "Get ready"}
                  </Link>
                ) : state.teams_announced && featured ? (
                  <button
                    onClick={() => setPicking(true)}
                    className="w-full rounded-lg bg-emerald-800 px-4 py-3 text-center font-semibold text-stone-0"
                  >
                    {pick ? "Change your pick" : "Make your prediction"}
                  </button>
                ) : (
                  <p className="rounded-lg bg-stone-100 px-4 py-3 text-center text-sm font-medium text-stone-700">
                    You&apos;re in. We&apos;ll be here.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* --- who's already in ---------------------------------
              Names, never scores. Picks stay hidden until kickoff and
              the gate is not an exception — showing what someone called
              a week early would let anyone copy whoever they rate. */}
          {names.length > 0 && (
            <div className="border-t border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-sm leading-relaxed text-stone-700">
                <span className="font-semibold text-stone-900" dir="auto">
                  {names.slice(0, 3).join(", ")}
                </span>
                {others > 0 ? (
                  <> and {others} others have already picked</>
                ) : names.length === 1 ? (
                  <> has already picked</>
                ) : (
                  <> have already picked</>
                )}
              </p>
            </div>
          )}
        </section>

        {/* --- the prize ------------------------------------------- */}
        <div className="mt-5 flex items-start gap-3 rounded-lg border-2 border-on-brand/25 px-4 py-3">
          <span aria-hidden className="text-2xl leading-none">
            🏆
          </span>
          <p className="text-sm leading-relaxed text-on-brand">
            <span className="font-bold">Nobody has ever won this.</span>{" "}
            Whoever tops the board is the first name on it, and that name
            stays on it.
          </p>
        </div>

        <Link
          href="/rules"
          className="mx-auto mt-5 block rounded-lg border-2 border-on-brand px-7 py-2.5 text-sm font-bold text-on-brand"
        >
          Rules
        </Link>

        {/* --- the countdown --------------------------------------- */}
        <div className="mt-8 text-center">
          {opensSoon ? (
            <p className="text-lg font-bold text-on-brand">Opening…</p>
          ) : untilOpen !== null ? (
            <>
              <p className="text-[11px] font-bold uppercase tracking-wider text-on-brand opacity-70">
                Everything opens in
              </p>
              <p className="mt-1 text-[2.5rem] font-black leading-none tabular-nums text-on-brand">
                {formatCountdown(untilOpen)}
              </p>
            </>
          ) : (
            <p className="text-sm font-medium text-on-brand opacity-70">
              Opening soon
            </p>
          )}

          <p className="mt-3 text-xs font-medium text-on-brand opacity-60">
            Live match rooms · predictions · the community feed
          </p>
        </div>
      </div>
    </main>
  );
}
