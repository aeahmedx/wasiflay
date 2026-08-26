"use client";

import { useState } from "react";
import { useInstall } from "@/lib/hooks/use-install";

/**
 * Getting the app onto the home screen before the weekend, not during
 * it.
 *
 * Saturday afternoon at a pitch is the worst possible moment to ask
 * someone to install anything — they're watching football on patchy
 * signal. A week early, sitting on a countdown with nothing else to do,
 * is the best one.
 *
 * It also matters more than it looks: installed, the app opens without
 * browser chrome, keeps its session, and sits on a home screen where it
 * gets seen. A tab gets closed and forgotten.
 */
export function GateInstall() {
  const { installed, canPromptNative, isIOSSafari, cannotInstall, promptInstall } =
    useInstall();
  const [showSteps, setShowSteps] = useState(false);

  // Already installed, or a browser that cannot — nothing worth saying.
  if (installed || cannotInstall) return null;
  if (!canPromptNative && !isIOSSafari) return null;

  if (canPromptNative) {
    return (
      <button
        type="button"
        onClick={promptInstall}
        className="mt-5 w-full rounded-lg border-2 on-brand-border bg-on-brand/5 px-4 py-3 text-center text-sm font-bold text-on-brand"
      >
        Add to home screen
      </button>
    );
  }

  // iOS gives no install API, so the only honest option is to say where
  // the button is.
  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => setShowSteps((v) => !v)}
        aria-expanded={showSteps}
        className="w-full rounded-lg border-2 on-brand-border px-4 py-3 text-center text-sm font-bold text-on-brand"
      >
        Add to home screen
      </button>

      {showSteps && (
        <ol className="mt-2 space-y-1.5 rounded-lg bg-stone-0 px-4 py-3 text-sm text-stone-700">
          <li>
            <span className="font-semibold text-stone-900">1.</span> Tap the
            share button at the bottom of Safari
          </li>
          <li>
            <span className="font-semibold text-stone-900">2.</span> Scroll
            down and tap <strong>Add to Home Screen</strong>
          </li>
          <li>
            <span className="font-semibold text-stone-900">3.</span> Tap{" "}
            <strong>Add</strong>
          </li>
        </ol>
      )}
    </div>
  );
}
