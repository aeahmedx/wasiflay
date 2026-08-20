/*
 * Minimal service worker.
 *
 * Deliberately network-first with no page caching: a community app where
 * someone posts and immediately can't see their own post because a
 * cached copy was served is worse than no service worker at all. The
 * only thing cached is the offline fallback.
 */
const CACHE = "wasiflay-shell-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icon.svg"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only page navigations. Everything else — API calls, realtime,
  // images — goes straight to the network untouched.
  if (request.mode !== "navigate") return;

  event.respondWith(
    fetch(request).catch(() =>
      caches.match(OFFLINE_URL).then((r) => r ?? Response.error())
    )
  );
});
