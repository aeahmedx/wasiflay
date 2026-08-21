/// <reference lib="webworker" />

/*
 * Service worker.
 *
 * Two jobs:
 *   1. Keep pages you've visited, so a reload or a cold start offline
 *      shows real content instead of an error.
 *   2. When there's genuinely nothing cached, answer with a message
 *      rather than the browser's error page.
 *
 * There is no separate offline page anymore. A page needs buttons, and
 * every button on it needs the network — so it was a dead end however
 * it was built. The fallback below is generated here, has nothing to
 * tap, and reloads itself the moment signal returns.
 *
 * In practice it's rarely seen: the app blocks navigation while offline,
 * so you stay on the screen you're already on.
 *
 * Network is always tried first, so nothing is stale while online.
 * Never cached: non-GET requests, anything cross-origin (Supabase,
 * realtime, storage), and the RSC payloads behind client navigation —
 * stale data would be worse than none.
 */

/**
 * A worker's global scope isn't Window, and without saying so every
 * call below reads as undefined to a type checker.
 * @type {ServiceWorkerGlobalScope}
 */
const sw = /** @type {never} */ (globalThis);

/**
 * Bump this on any deploy that changes assets. Everything not matching
 * the new cache names is deleted on activate, which is the escape hatch
 * if a cache ever goes bad — no need to ask anyone to clear their
 * browser.
 */
const VERSION = "v5";
const PAGES = `wl-pages-${VERSION}`;
const ASSETS = `wl-assets-${VERSION}`;

/** Cached pages age out rather than being served indefinitely. */
const PAGE_TTL_MS = 24 * 60 * 60 * 1000;

/** Cheap same-origin file used to test whether the network is back. */
const PING_URL = "/icon.svg";

const FALLBACK = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Offline</title>
<style>
:root{color-scheme:light dark}
html,body{margin:0;height:100%}
body{display:flex;align-items:center;justify-content:center;padding:24px;
background:#fbf8f2;color:#1a140c;text-align:center;
font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
-webkit-font-smoothing:antialiased}
.m{width:52px;height:52px;margin:0 auto 18px;display:flex;align-items:center;
justify-content:center;background:#f5a623;border-radius:13px}
h1{margin:0 0 6px;font-size:19px;font-weight:600;letter-spacing:-.02em}
p{margin:0;font-size:15px;line-height:1.5;color:#5e5242;max-width:280px}
@media(prefers-color-scheme:dark){
body{background:#202124;color:#f9f4e8}p{color:#c4b696}}
</style></head><body><div>
<div class="m"><svg width="32" height="32" viewBox="0 0 64 64">
<g transform="translate(32 32) rotate(12) scale(.9) translate(-32 -32)"
fill="none" stroke="#2b1d07" stroke-width="3.6" stroke-linejoin="round">
<path d="M29.5 8h5v48h-5z"/><path d="M34.5 15h16l6 5.5-6 5.5h-16z"/>
<path d="M29.5 27h-15l-6 5.5 6 5.5h15z"/><path d="M34.5 34h13l6 5.5-6 5.5h-13z"/>
</g></svg></div>
<h1>No connection</h1>
<p>This page will load itself as soon as you're back online.</p>
</div>
<script>
// Nothing to tap on purpose. It watches, and leaves when it can.
let tries = 0;
function check() {
  fetch("${PING_URL}", { method: "HEAD", cache: "no-store" })
    .then(function () { location.reload(); })
    .catch(function () {
      tries++;
      setTimeout(check, Math.min(2000 * Math.pow(1.6, tries), 30000));
    });
}
addEventListener("online", check);
setTimeout(check, 1500);
</script></body></html>`;

function offlineResponse() {
  return new Response(FALLBACK, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * @param {URL} url
 *
 * /_next/image is the one that bit us: next/image doesn't request
 * /logo-full.png, it requests /_next/image?url=%2Flogo-full.png&w=... —
 * no file extension, so an extension test misses it entirely and every
 * image broke offline.
 */
function isImmutableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    /\.(?:png|jpe?g|svg|ico|woff2?|json)$/.test(url.pathname) ||
    url.pathname.endsWith(".webmanifest")
  );
}

sw.addEventListener("install", () => {
  sw.skipWaiting();
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== PAGES && key !== ASSETS)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => sw.clients.claim())
  );
});

/**
 * Signing out wipes cached pages. They were rendered for one person —
 * without this the next person on the phone could be served their feed.
 */
sw.addEventListener("message", (event) => {
  if (event.data === "wl:clear-cache") {
    event.waitUntil(caches.delete(PAGES));
  }
});

sw.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== sw.location.origin) return;

  // Build output and images. Without these a cached page renders
  // unstyled with broken images, which looks far worse than a page that
  // simply didn't load.
  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(ASSETS).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGES).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) {
            const at = cached.headers.get("date");
            if (!at || Date.now() - new Date(at).getTime() < PAGE_TTL_MS) {
              return cached;
            }
          }

          // Same path, different query — a feed on another tab still
          // beats nothing.
          const bare = await caches.match(url.pathname);
          if (bare) return bare;

          return offlineResponse();
        })
    );
  }

  // Everything else, including RSC payloads, goes to the network.
});