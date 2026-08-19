"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Prompts people to add Wasif Lay to their home screen.
 *
 * Android and desktop Chrome fire beforeinstallprompt and we can trigger
 * the real installer. iOS Safari has no such API, so it gets written
 * instructions instead — which is fine, because the main use is pointing
 * at someone's phone at a booth and walking them through it.
 *
 * Dismissal is remembered in a cookie rather than localStorage, which is
 * not available in this environment.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Already installed — nothing to offer.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS reports it here instead
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;
    if (standalone) return;

    if (document.cookie.includes("wl_install_dismissed=1")) return;

    const ua = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua);
    setIsIOS(ios);

    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as InstallEvent);
      setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS never fires the event, so show the instructions after a beat —
    // long enough that it doesn't interrupt the first thing they came for.
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (ios) timer = setTimeout(() => setVisible(true), 8000);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (timer) clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    // 30 days
    document.cookie = `wl_install_dismissed=1; path=/; max-age=${60 * 60 * 24 * 30}`;
    setVisible(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 rounded-lg border border-stone-300 bg-stone-0 px-4 py-3 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-stone-900">Add to your home screen</p>
          {isIOS ? (
            <p className="mt-0.5 text-sm text-stone-600">
              Tap Share, then <span className="font-medium">Add to Home
              Screen</span>.
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-stone-600">
              Opens like an app, no store needed.
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!isIOS && (
            <button
              onClick={install}
              className="rounded-lg bg-emerald-800 px-3.5 py-2 text-sm font-medium text-stone-0"
            >
              Add
            </button>
          )}
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-600"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
