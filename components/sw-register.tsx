"use client";

import { useEffect } from "react";

/**
 * Registers the service worker, which exists for one reason: serving the
 * offline page when a navigation fails. It caches nothing else, so there
 * is no stale-content risk.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const timer = setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Not being able to register is not worth telling anyone about.
      });
    }, 2000); // after the page has settled

    return () => clearTimeout(timer);
  }, []);

  return null;
}
