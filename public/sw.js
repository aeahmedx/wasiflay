/*
 * Minimal service worker.
 *
 * One job: serve a fallback when a page navigation fails with no
 * network. It caches nothing else — a community app where someone posts
 * and then can't see their own post because a cached copy was served is
 * worse than no service worker at all.
 *
 * The fallback is a self-contained HTML file rather than an app route.
 * Caching a framework-rendered page's HTML without its separately-hashed
 * CSS produced an unstyled page, which looked broken rather than
 * offline.
 */
const CACHE = "wasiflay-shell-v2";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
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

  // Page navigations only. API calls, realtime, and images go straight
  // to the network untouched.
  if (request.mode !== "navigate") return;

  event.respondWith(
    fetch(request).catch(() =>
      caches.match(OFFLINE_URL).then((r) => r ?? Response.error())
    )
  );
});
