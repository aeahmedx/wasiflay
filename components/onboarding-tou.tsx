"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useInstall } from "@/lib/hooks/use-install";

const COOKIE = "wl_tour";

/**
 * The first thirty seconds, for people who arrive all at once.
 *
 * Everyone lands within the same hour on Friday, sent by one DM, with
 * no idea what this is beyond "predict the scores". Without something
 * here they open a feed of posts from strangers and close it.
 *
 * Three screens, because three is what someone standing outside a
 * pitch will actually read. The first says what the app is for, the
 * second says what this weekend is, and the third gives one thing to
 * do — a tour that ends without an action is a tour that ends with
 * someone closing the tab.
 *
 * Skippable from the first frame. Anyone who taps Skip has decided,
 * and making them work for it earns nothing.
 */
const SCREENS = [
  {
    art: "💬",
    title: "Where the answers stay",
    body:
      "Ask anything — a mechanic, a lawyer, where to send a package home. Someone who actually knows answers, and it stays put for the next person instead of scrolling away.",
    note: "Ask anonymously if it's about money, papers, or family.",
  },
  {
    art: "⚽",
    title: "This weekend, it's football",
    body:
      "Call the score of every match before kickoff. Points for getting it right, more for the later rounds. Each match gets its own room while it's playing.",
    note: "Nobody has ever won this. Whoever tops the board is the first name on it.",
  },
  {
    art: "🏆",
    title: "Start with one pick",
    body:
      "Predict the next match — it takes ten seconds. Then ask the question you've been meaning to ask someone about.",
    note: null,
  },
];

/**
 * Shown only on iPhone, where there is no install prompt to offer.
 *
 * "Add to home screen" describes the gesture; what actually happens is
 * that it becomes an app, opening full screen and staying signed in.
 * Saying that is the difference between being read and being skipped.
 */
const IOS_SCREEN = {
  art: "\u{1F4F1}",
  title: "Make Wasif Lay an app",
  body:
    "Tap the share button at the bottom of Safari, scroll down, and tap Add to Home Screen. It opens full screen with no browser bar, and you stay signed in.",
  note: "One tap on match day instead of hunting for a link.",
};

export function OnboardingTour() {
  const router = useRouter();
  const pathname = usePathname();
  const { isIOSSafari, installed } = useInstall();
  const [step, setStep] = useState(0);
  const [gone, setGone] = useState(false);

  /**
   * A fourth screen, on iPhone only.
   *
   * Android gets a real install prompt from the browser; iOS has no
   * such API, so the only way onto a home screen there is somebody
   * being shown where the button is. Anyone who has already installed
   * is not shown it again.
   *
   * Built here rather than as a constant because whether it belongs
   * depends on the device, and that is only knowable in the browser.
   */
  const screens = isIOSSafari && !installed ? [...SCREENS, IOS_SCREEN] : SCREENS;

  function finish() {
    // A year: this should never appear twice for the same person on the
    // same device, and there is nothing to gain from asking again.
    document.cookie = `${COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    setGone(true);
    router.refresh();
  }

  if (gone) return null;

  /**
   * The homepage only.
   *
   * This is mounted in the layout, so it used to open on whatever page
   * someone landed on — which for anyone arriving through the prize
   * splash meant the profile form, then this, before they had seen a
   * single thing. Two full-screen interruptions in a row is how a
   * sign-up gets abandoned three taps from the end.
   *
   * Someone who signed up to make a pick goes straight to the picks.
   * The tour waits until they come to the feed, which is the screen it
   * is actually about.
   */
  if (pathname !== "/") return null;

  const screen = screens[step];
  const last = step === screens.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Wasif Lay"
      className="fixed inset-0 z-50 flex flex-col bg-stone-50"
    >
      <div className="flex justify-end px-4 pt-4">
        <button
          onClick={finish}
          className="px-2 py-1 text-sm font-medium text-stone-500"
        >
          Skip
        </button>
      </div>

      <div className="flex flex-1 flex-col justify-center px-8 pb-8">
        <p aria-hidden className="text-center text-6xl leading-none">
          {screen.art}
        </p>

        <h2 className="mt-8 text-center text-2xl font-bold leading-tight tracking-tight text-stone-900">
          {screen.title}
        </h2>

        <p className="mt-4 text-center leading-relaxed text-stone-700">
          {screen.body}
        </p>

        {screen.note && (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-center text-sm leading-relaxed text-stone-700">
            {screen.note}
          </p>
        )}
      </div>

      <div
        className="px-8"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mb-5 flex justify-center gap-2">
          {screens.map((_, i) => (
            <span
              key={i}
              aria-hidden
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-stone-800" : "w-1.5 bg-stone-300"
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => (last ? finish() : setStep((s) => s + 1))}
          className="w-full rounded-lg bg-amber-400 px-4 py-3.5 text-center font-bold text-on-brand"
        >
          {last ? "Let's go" : "Next"}
        </button>
      </div>
    </div>
  );
}
