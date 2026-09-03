"use client";

import { useEffect, useState } from "react";
import { useInstall } from "@/lib/hooks/use-install";
import { IOSInstallSteps } from "@/components/ios-install-steps";

const DISMISS_DAYS = 90;

/**
 * The automatic, once-per-quarter ask.
 *
 * Sits over the tab bar deliberately: it has to be acknowledged rather
 * than scrolled past, and it's dismissed in one tap.
 *
 * Anyone who says "not now" and changes their mind can find it again on
 * their profile — see AddToHomeScreen.
 */
export function InstallPrompt() {
  const { installed, canPromptNative, isIOSSafari, promptInstall } =
    useInstall();
  /**
   * Read once at init rather than in an effect — setState inside an
   * effect forces a second render before paint.
   *
   * No hydration risk: the server has no cookie and renders true, and
   * the first client render still returns null because `mode` is "none"
   * until a browser event or the iOS timer says otherwise. Both passes
   * produce nothing.
   */
  const [dismissed, setDismissed] = useState(() =>
    typeof document === "undefined"
      ? true
      : document.cookie.includes("wl_install_dismissed=1")
  );
  const [iosReady, setIosReady] = useState(false);

  // Give people a moment with whatever they came for first.
  useEffect(() => {
    if (!isIOSSafari) return;
    const timer = setTimeout(() => setIosReady(true), 10000);
    return () => clearTimeout(timer);
  }, [isIOSSafari]);

  function dismiss() {
    document.cookie = `wl_install_dismissed=1; path=/; max-age=${
      60 * 60 * 24 * DISMISS_DAYS
    }`;
    setDismissed(true);
  }

  if (installed || dismissed) return null;

  const showIOS = isIOSSafari && iosReady;
  if (!showIOS && !canPromptNative) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 rounded-lg border border-stone-300 bg-stone-0 px-4 py-3.5 shadow-lg">
      {showIOS ? (
        <>
          <p className="font-medium text-stone-900">Make Wasif Lay an app</p>
          <IOSInstallSteps />
          <button
            onClick={dismiss}
            className="mt-3 rounded-lg border border-stone-300 px-3.5 py-2 text-sm text-stone-700"
          >
            Got it
          </button>
        </>
      ) : (
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-stone-900">
              Add to your home screen
            </p>
            <p className="mt-0.5 text-sm text-stone-600">
              Opens like an app. No store, no download.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={promptInstall}
              className="rounded-lg bg-emerald-800 px-3.5 py-2 text-sm font-medium text-stone-0"
            >
              Add
            </button>
            <button
              onClick={dismiss}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-600"
            >
              Not now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
