"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const TRIGGER_PX = 72; // how far you must pull
const MAX_PX = 110; // how far the indicator travels
const RESIST = 0.5; // drag feels weighted rather than sticky

/**
 * Pull down to refresh.
 *
 * Installed as a PWA there is no browser chrome, so the reflex people
 * have — swipe down at the top of a list — does nothing at all. Safari
 * and Chrome have their own native version on the open web, which only
 * fires when the page is already scrolled to the very top; this stays
 * out of its way by doing the same.
 *
 * router.refresh() re-runs the server components and swaps the data in
 * place, so scroll position and any open UI survive — unlike a reload.
 */
/**
 * Screens that scroll inside their own container rather than the window.
 * A chat room is h-dvh with an inner scroll area, so window.scrollY is
 * always 0 — without this, scrolling up through message history would
 * trigger a refresh.
 */
const DISABLED_ON = [/^\/rooms\/[^/]+$/];

export function PullToRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const startY = useRef<number | null>(null);
  const active = useRef(false);
  // A ref, not state, so flipping it doesn't tear down and re-register
  // the listeners mid-gesture.
  const busy = useRef(false);

/** Nearest ancestor that scrolls, if any. */
function scrollableAncestor(node: EventTarget | null): HTMLElement | null {
  let el = node instanceof HTMLElement ? node : null;
  while (el && el !== document.body) {
    const overflow = getComputedStyle(el).overflowY;
    if (
      (overflow === "auto" || overflow === "scroll") &&
      el.scrollHeight > el.clientHeight
    ) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

  const disabled = DISABLED_ON.some((re) => re.test(pathname));

  useEffect(() => {
    if (disabled) return;

    function onStart(e: TouchEvent) {
      // Only from a genuine top-of-page, and never mid-pinch.
      if (window.scrollY > 0 || e.touches.length !== 1) return;

      // Started inside something with its own scroll that isn't at its
      // top — that gesture belongs to the list, not to us.
      const inner = scrollableAncestor(e.target);
      if (inner && inner.scrollTop > 0) return;

      startY.current = e.touches[0].clientY;
      active.current = true;
    }

    function onMove(e: TouchEvent) {
      if (!active.current || startY.current === null || busy.current) return;

      const delta = e.touches[0].clientY - startY.current;

      // Upward drag is a normal scroll — let go of it immediately.
      if (delta <= 0) {
        active.current = false;
        setPull(0);
        return;
      }

      // Scrolled away from the top mid-gesture: abandon.
      if (window.scrollY > 0) {
        active.current = false;
        setPull(0);
        return;
      }

      setPull(Math.min(delta * RESIST, MAX_PX));
    }

    async function onEnd() {
      if (!active.current) return;
      active.current = false;
      startY.current = null;

      setPull((current) => {
        if (current >= TRIGGER_PX) {
          busy.current = true;
          setRefreshing(true);
          router.refresh();
          // The refresh is a server round trip with no completion event
          // we can hook, so hold the indicator briefly rather than
          // flashing it away before anything visibly changes.
          setTimeout(() => {
            busy.current = false;
            setRefreshing(false);
            setPull(0);
          }, 700);
          return TRIGGER_PX;
        }
        return 0;
      });
    }

    // passive: true — this never calls preventDefault, so native scroll
    // and the browser's own pull-to-refresh keep working normally.
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [router, disabled]);

  if (disabled) return null;
  if (pull === 0 && !refreshing) return null;

  const ready = pull >= TRIGGER_PX;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
      style={{ transform: `translateY(${Math.max(pull - 28, 0)}px)` }}
    >
      <div className="mt-2 flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-stone-0 shadow-sm">
        <svg
          viewBox="0 0 24 24"
          className={`h-5 w-5 text-emerald-800 ${
            refreshing ? "animate-spin" : ""
          }`}
          fill="none"
          style={{
            transform: refreshing
              ? undefined
              : `rotate(${Math.min(pull / MAX_PX, 1) * 270}deg)`,
          }}
        >
          <path
            d="M20 12a8 8 0 1 1-2.3-5.6"
            stroke="currentColor"
            strokeWidth={ready || refreshing ? 2.4 : 1.8}
            strokeLinecap="round"
          />
          <path
            d="M18 3v4h-4"
            stroke="currentColor"
            strokeWidth={ready || refreshing ? 2.4 : 1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
