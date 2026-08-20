"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { NEEDS_CONNECTION } from "@/lib/offline";

/**
 * External state — the browser's own online/offline events. Read through
 * useSyncExternalStore rather than an effect, so there's no second
 * render pass before paint. The third argument is the server snapshot:
 * assume online, since assuming otherwise would flash a false warning
 * during hydration.
 */
function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const TOAST_MS = 2200;

/**
 * How losing signal should feel: like nothing much happened.
 *
 * Navigation is deliberately NOT blocked. The service worker keeps
 * pages you've already opened, so moving around what you've seen works
 * offline — blocking taps would make the app feel more broken than the
 * connection actually is.
 *
 * What's left here is honesty: a line at the top saying why things are
 * slow, and a quiet pill for the actions that genuinely can't work —
 * voting, reacting, refreshing — which would otherwise fail silently or
 * flicker and undo themselves.
 */
export function ConnectionStatus() {
  const router = useRouter();

  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  );

  const [toast, setToast] = useState(false);
  const wasOffline = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(() => {
    setToast(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(false), TOAST_MS);
  }, []);

  // Anything else in the app that can't work offline — a reaction, a
  // vote, a pull-to-refresh — announces itself here rather than failing
  // quietly or growing its own error message.
  useEffect(() => {
    function onNeeds() {
      showToast();
    }
    window.addEventListener(NEEDS_CONNECTION, onNeeds);
    return () => window.removeEventListener(NEEDS_CONNECTION, onNeeds);
  }, [showToast]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    // Back: pull fresh data rather than leaving whatever was on screen
    // when the signal died. A ref, so this doesn't cause a render.
    if (wasOffline.current) {
      wasOffline.current = false;
      router.refresh();
    }
  }, [online, router]);

  if (online && !toast) return null;

  return (
    <>
      {!online && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 top-0 z-50 bg-stone-800 px-4 py-2 text-center text-sm font-medium text-stone-0"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
        >
          No connection — pages you&apos;ve opened still work
        </div>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-6"
        >
          <span className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-stone-0 shadow-lg">
            That needs a connection
          </span>
        </div>
      )}
    </>
  );
}
