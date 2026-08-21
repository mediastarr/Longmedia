// ViewTube service worker — offline mode for Meta Ray-Ban Display Web Apps,
// per Meta's own Web Apps spec (Service Workers + Cache API, cache-first
// app shell strategy: https://wearables.developer.meta.com/docs/develop/webapps/build).
//
// This precaches ONLY the app shell itself — ViewTube is a single
// self-contained HTML file with everything inline, no separate CSS/JS
// assets to enumerate — so the app loads instantly even with zero
// connectivity, instead of showing a blank/broken page.
//
// Deliberately does NOT cache anything from the YouTube Data API, the
// Worker backend, or video playback — those need a live connection by
// nature, and this project has stayed off anything resembling actual
// offline video throughout, which would raise real ToS/DRM concerns a
// service worker can't and shouldn't paper over. This is offline-resilient
// BROWSING of the app shell, not offline video.

// Bump this on every deploy. The new worker installs alongside the old
// one, precaches the updated shell, and cleans up the outdated cache on
// activation (see "activate" below) — forgetting to bump it just means
// wearers keep seeing the PREVIOUS version's shell until a real network
// fetch happens to get through first.
const CACHE_NAME = "viewtube-shell-v1";

// Both entries point at the same actual file — "./" so a request for the
// directory root resolves, "./index.html" so a direct request for the
// filename also hits the cache. Update "index.html" here if this is ever
// deployed under a different filename than what's actually served.
const APP_SHELL = ["./", "./index.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => { /* first-install precache failed (e.g. installing while offline) — not fatal, the next online load populates it */ })
  );
  // Don't leave an old worker in charge while a wearer waits for a tab
  // close that may never come on this platform.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only intercept navigation requests — loading the app shell page
  // itself. Everything else (YouTube API calls, thumbnails, the Worker,
  // the video iframe) passes straight through to the network untouched;
  // caching those would mean showing genuinely stale video data as if it
  // were current, which the spec explicitly warns against.
  if (req.method !== "GET" || req.mode !== "navigate") return;

  // Cache-first, per the spec: check cache before network so the shell
  // loads instantly even offline, falling back to network only when
  // nothing's cached yet (the very first load, or a previous precache
  // failure).
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
