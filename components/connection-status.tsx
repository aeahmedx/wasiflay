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

const TOAST_MS = 2000;

/**
 * How losing signal should feel: like almost nothing happened.
 *
 * While offline, nothing is allowed to start loading a new screen. The
 * page you're on stays put and stays scrollable, a line at the top says
 * why, and a tap gets a quiet pill instead of a broken page.
 *
 * That's deliberate rather than lazy. Any navigation offline either
 * fails outright or lands on a fallback screen — and a fallback screen
 * needs buttons, and every button on it needs the network. It's a dead
 * end however it's built. Not going there is the only clean answer.
 *
 * The moment signal returns, taps work again and the page refreshes
 * itself. No pause, nothing lost, nothing to get stuck on.
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

  // Actions elsewhere that can't work offline — a vote, a reaction, a
  // pull-to-refresh — announce themselves here rather than failing
  // quietly or growing their own error UI.
  useEffect(() => {
    window.addEventListener(NEEDS_CONNECTION, showToast);
    return () => window.removeEventListener(NEEDS_CONNECTION, showToast);
  }, [showToast]);

  // Stop anything that would load a new screen. Capture phase, so it
  // runs before Next's router sees the click.
  useEffect(() => {
    if (online) return;

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const link = (e.target as HTMLElement | null)?.closest("a");
      if (!link) return;

      const href = link.getAttribute("href");
      if (!href) return;

      // Left alone: other sites, downloads, new tabs, in-page anchors.
      // None of these navigate the app away from what's on screen.
      if (link.target === "_blank" || link.hasAttribute("download")) return;
      if (!href.startsWith("/") || href.startsWith("//")) return;
      if (href.startsWith("#")) return;

      // Already here — nothing to load.
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
    // when the signal died. A ref, so this causes no render of its own.
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
          No connection — keep reading, this page still works
        </div>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-6"
        >
          <span className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-stone-0 shadow-lg">
            {online ? "That needs a connection" : "Wait for the connection"}
          </span>
        </div>
      )}
    </>
  );
}
