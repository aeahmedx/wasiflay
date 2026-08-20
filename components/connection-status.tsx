"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

/**
 * Subscribes to the browser's own online/offline events.
 *
 * useSyncExternalStore rather than an effect that reads navigator and
 * calls setState: this IS external state, and reading it in an effect
 * means a second render pass before paint. The third argument is the
 * server snapshot — assume online, since the server has no opinion and
 * assuming otherwise would flash a false warning during hydration.
 */
function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * A slim bar when the connection drops, rather than replacing the whole
 * screen.
 *
 * The full-page fallback is only right for a cold start with no network
 * — there's genuinely nothing to show. Losing signal mid-session is
 * different: the content already on screen is still worth reading, and
 * blanking it out to announce the problem is worse than the problem.
 *
 * The service worker still covers the cold-start case.
 */
export function ConnectionStatus() {
  const router = useRouter();

  const online = useSyncExternalStore(
      subscribe,
      () => navigator.onLine,
      () => true
  );

  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    // Came back: pull fresh data rather than leaving whatever was on
    // screen when the signal died. A ref, not state, so this doesn't
    // trigger a render of its own.
    if (wasOffline.current) {
      wasOffline.current = false;
      router.refresh();
    }
  }, [online, router]);

  if (online) return null;

  return (
      <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 top-0 z-50 bg-stone-800 px-4 py-2 text-center text-sm font-medium text-stone-0"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
      >
      <span className="inline-flex items-center gap-2">
        No connection
        <button
            onClick={() => router.refresh()}
            className="underline underline-offset-2"
        >
          Retry
        </button>
      </span>
      </div>
  );
}