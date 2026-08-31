"use client";

import { useState } from "react";
import { useInstall } from "@/lib/hooks/use-install";

/**
 * Getting Wasif Lay onto the home screen.
 *
 * "Add to home screen" describes the gesture, not the outcome — it
 * sounds like saving a bookmark, which is a thing people ignore. What
 * actually happens is that it becomes an app: full screen, no browser
 * bar, still signed in a week later. Saying that is the whole
 * difference between being read and being scrolled past.
 *
 * Deliberately a pale card rather than another outlined button on
 * yellow. Everything else on this page is amber on amber, so this was
 * invisible until someone had already scrolled past it.
 *
 * Asking now matters too: Saturday at a pitch on patchy signal is the
 * worst moment to install anything, and a week early on a countdown
 * with nothing else to do is the best.
 */
export function GateInstall() {
  const { installed, canPromptNative, isIOSSafari, cannotInstall, promptInstall } =
    useInstall();
  const [showSteps, setShowSteps] = useState(false);

  if (installed || cannotInstall) return null;
  if (!canPromptNative && !isIOSSafari) return null;

  return (
    <div className="mt-5 rounded-lg bg-stone-0 px-4 py-4">
      <p className="text-base font-bold text-stone-900">
        Make Wasif Lay an app
      </p>

      <p className="mt-1 text-sm leading-relaxed text-stone-600">
        Put it on your home screen and it opens like a real app — full
        screen, no browser bar, and you stay signed in. One tap on match
        day instead of hunting for a link.
      </p>

      {canPromptNative ? (
        <button
          type="button"
          onClick={promptInstall}
          className="mt-3 w-full rounded-lg bg-emerald-800 px-4 py-3 text-center font-semibold text-stone-0"
        >
          Install it
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setShowSteps((v) => !v)}
            aria-expanded={showSteps}
            className="mt-3 w-full rounded-lg bg-emerald-800 px-4 py-3 text-center font-semibold text-stone-0"
          >
            {showSteps ? "Hide the steps" : "Show me how"}
          </button>

          {/* iOS offers no install API, so the only honest option is to
              point at the button — including what it looks like, since
              "the share button" means nothing if you've never noticed
              it. */}
          {showSteps && (
            <ol className="mt-3 space-y-3 text-sm text-stone-700">
              <li className="flex items-start gap-2.5">
                <span className="font-bold text-stone-900">1.</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  Tap
                  <ShareIcon />
                  at the bottom of Safari
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-bold text-stone-900">2.</span>
                <span>
                  Scroll down and tap{" "}
                  <strong className="text-stone-900">Add to Home Screen</strong>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-bold text-stone-900">3.</span>
                <span>
                  Tap <strong className="text-stone-900">Add</strong> — done,
                  it&apos;s an app
                </span>
              </li>
            </ol>
          )}
        </>
      )}
    </div>
  );
}

/** Safari's share glyph: a box with an arrow leaving the top. */
function ShareIcon() {
  return (
    <span className="inline-flex items-center justify-center rounded border border-stone-300 bg-stone-50 px-1.5 py-0.5">
      <svg
        width="15"
        height="18"
        viewBox="0 0 15 18"
        fill="none"
        aria-label="share"
        role="img"
        className="text-[#007AFF]"
      >
        <path
          d="M7.5 1.5v9"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M4.6 4.2 7.5 1.3l2.9 2.9"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M3.4 7.4H2.2v8.4h10.6V7.4h-1.2"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
