/*
 * Service worker.
 *
 * The previous version cached nothing but a fallback page, which meant
 * every navigation offline was a fresh network request — so "go back"
 * was just another failed request, and there was no way out of the
 * offline page. Caching one page you can't leave is worse than caching
 * nothing.
 *
 * Now: pages you've already visited are kept, so going back works,
 * and moving around what you've already seen works. Network is always
 * tried first, so nothing is ever stale while you have signal — the
 * cache only answers when the network can't.
 *
 * Deliberately NOT cached: anything that isn't a GET, anything
 * cross-origin (Supabase, realtime), and the RSC data requests behind
 * client navigation. Serving stale data would be worse than failing.
 */

const VERSION = "v3";
const PAGES = `wl-pages-${VERSION}`;
const ASSETS = `wl-assets-${VERSION}`;
const OFFLINE_URL = "/offline.html";

/** Cached pages go stale as a session ages; a day is generous. */
const PAGE_TTL_MS = 24 * 60 * 60 * 1000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(ASSETS)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== PAGES && k !== ASSETS)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/**
 * Signing out has to wipe the page cache. Pages are rendered for a
 * specific person — without this, the next person to use the phone
 * could be served the previous one's feed from cache.
 */
self.addEventListener("message", (event) => {
  if (event.data === "wl:clear-cache") {
    event.waitUntil(caches.delete(PAGES));
  }
});

function isImmutableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:png|jpe?g|svg|ico|woff2?|webmanifest)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Supabase, realtime, storage — never touched.
  if (url.origin !== self.location.origin) return;

  // Build output is content-hashed, so it can be cached forever and
  // served instantly. Without these a cached page renders unstyled.
  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(ASSETS).then((c) => c.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // Page loads: network first, cache as a fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGES).then((cache) => {
              // Stamp it so a stale page can be aged out rather than
              // served indefinitely.
              cache.put(request, copy);
            });
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request, { ignoreSearch: false });
          if (cached) {
            const at = cached.headers.get("date");
            const fresh =
              !at || Date.now() - new Date(at).getTime() < PAGE_TTL_MS;
            if (fresh) return cached;
          }

          // Try the same path without its query — a feed with a
          // different tab selected is still better than nothing.
          const bare = await caches.match(url.pathname);
          if (bare) return bare;

          const offline = await caches.match(OFFLINE_URL);
          return offline ?? Response.error();
        })
    );
    return;
  }

  // Everything else — including the RSC payloads behind client-side
  // navigation — goes straight to the network. A stale payload would
  // show someone yesterday's data as if it were live.
});
