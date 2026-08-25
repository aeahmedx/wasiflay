"use client";

import { useSyncExternalStore } from "react";

/**
 * A once-per-second clock, safe to render on the server.
 *
 * Two things it has to get right, and I got the second one wrong first:
 *
 * 1. The server snapshot is null, so the server never renders a time.
 *    Reading Date.now() during render is a hydration mismatch waiting
 *    to happen — the server writes "2m 22s", the client hydrates a
 *    second later and writes "2m 21s", and React throws out the tree.
 *
 * 2. getSnapshot has to return a CACHED value. React calls it on every
 *    render and compares by identity; if it returns a fresh Date.now()
 *    each time, the store looks like it changed every render and the
 *    component re-renders forever. That's the "Maximum update depth
 *    exceeded" loop.
 *
 * So the value is stored in a module-level variable and only updated by
 * the interval. Every subscriber shares one timer, which is also fewer
 * timers than one per countdown.
 */
let cachedNow = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(onChange: () => void) {
  listeners.add(onChange);

  if (timer === null) {
    timer = setInterval(() => {
      cachedNow = Date.now();
      listeners.forEach((listener) => listener());
    }, 1000);
  }

  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Stable between ticks — this is what stops the render loop. */
function getSnapshot() {
  return cachedNow;
}

/** The server has no clock to offer, and shouldn't pretend to. */
function getServerSnapshot(): number | null {
  return null;
}

export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Milliseconds until the given time, or null before the first tick. */
export function useCountdown(iso: string | null): number | null {
  const now = useNow();
  if (!iso || now === null) return null;
  return new Date(iso).getTime() - now;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "any moment";
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
