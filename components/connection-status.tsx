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
 * The problem this solves is specific. Next falls back to a full page
 * load when a client navigation can't fetch its data — which hits the
 * service worker and replaces the whole app with the offline page. One
 * tap and everything already loaded is gone, with nothing but a Try
 * again button left.
 *
 * So while offline, forward navigation simply doesn't start. The feed
 * you already have stays on screen and stays scrollable, a quiet line
 * says why, and the moment signal returns the tap works again. Back and
 * forward still work, because those come from the browser's cache
 * rather than the network.
 *
 * This is what every social app does. Nothing pauses, nothing is lost,
 * and there is no screen to get stuck on.
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

  // Stop forward navigations before they can turn into a failed page
  // load. Capture phase, so it runs before Next's router picks the
  // click up.
  useEffect(() => {
    if (online) return;

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const link = (e.target as HTMLElement | null)?.closest("a");
      if (!link) return;

      const href = link.getAttribute("href");
      if (!href) return;

      // Leave alone: other sites, downloads, new tabs, in-page anchors,
      // and anything that isn't a normal navigation.
      if (link.target === "_blank" || link.hasAttribute("download")) return;
      if (!href.startsWith("/") || href.startsWith("//")) return;
      if (href.startsWith("#")) return;

      // Already here — nothing to fetch, so let it be.
      if (href === window.location.pathname + window.location.search) return;

      e.preventDefault();
      e.stopPropagation();
      showToast();
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [online, showToast]);

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
          No connection — you can still read what&apos;s loaded
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
