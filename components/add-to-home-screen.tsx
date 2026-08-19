"use client";

import { useState } from "react";
import { useInstall } from "@/lib/hooks/use-install";
import { IOSInstallSteps } from "@/components/ios-install-steps";

/**
 * The way back for anyone who tapped "Not now" and changed their mind.
 * A dismissed prompt is gone for 90 days, and without this there was no
 * route to it at all.
 *
 * Deliberately a plain link rather than a banner — findable when you
 * look for it, invisible when you aren't.
 */
export function AddToHomeScreen() {
  const { installed, canPromptNative, isIOSSafari, cannotInstall, promptInstall } =
    useInstall();
  const [open, setOpen] = useState(false);

  // Nothing useful to say if it's already installed, or if this browser
  // can't install at all.
  if (installed || cannotInstall) return null;
  if (!canPromptNative && !isIOSSafari) return null;

  if (canPromptNative) {
    return (
      <button
        type="button"
        onClick={promptInstall}
        className="text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900"
      >
        Add to home screen
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900"
      >
        Add to home screen
      </button>
      {open && (
        <div className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-0 px-3 py-2.5">
          <IOSInstallSteps />
        </div>
      )}
    </div>
  );
}
