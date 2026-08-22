/*
 * ViewTube AR OS — offline app-shell service worker.
 *
 * Scope: caches the HTML document itself (the app shell) plus whatever
 * same-origin static assets it loads, so the app can still open without
 * a network connection — no blank white screen, last-known UI is there.
 *
 * Deliberately NOT cached: the YouTube Data API (via the Worker), video
 * playback (YouTube's own iframe/CDN), or anything cross-origin. That
 * data is inherently live — caching it risks serving stale feeds, and
 * video playback simply can't work offline regardless. This service
 * worker's job ends at "the shell opens," not "content plays offline."
 */
const CACHE_NAME = "viewtube-shell-v1";
const SHELL_URLS = [
  "./",
  "./index.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(SHELL_URLS.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => cached || caches.match("./"))
      )
  );
});
