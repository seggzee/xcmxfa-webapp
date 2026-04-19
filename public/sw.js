/* public/sw.js
   Phase 0 — Offline App Shell Support

   PURPOSE
   - Make the app boot offline (PWA shell)
   - Cache only static app shell assets
   - Support SPA navigation fallback

   IMPORTANT
   - NO API response caching
   - NO dynamic data persistence
   - This is shell-only offline support

   VERSIONING
   - Bump CACHE_NAME when deploying breaking changes
*/

const CACHE_NAME = "xcmxfa-shell-v1";

/**
 * Core shell files to cache.
 * Keep this minimal and stable.
 */
const CORE_ASSETS = [
  "/",                // entry
  "/index.html",      // main HTML
  "/manifest.json",   // PWA manifest
];

/**
 * INSTALL
 * - Pre-cache core shell
 * - Activate immediately
 */
self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    })
  );
});

/**
 * ACTIVATE
 * - Clean old caches
 * - Take control immediately
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );

  self.clients.claim();
});

/**
 * FETCH
 * Strategy:
 * - Navigation requests → network first, fallback to cached shell
 * - Static assets → cache-first
 * - API calls → network only (no caching)
 */
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  /**
   * 1. API calls — DO NOT CACHE
   */
  if (url.pathname.startsWith("/api/")) {
    return; // let browser handle normally
  }

  /**
   * 2. Navigation requests (SPA routes)
   */
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((response) => {
          // Update cached index.html in background
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put("/index.html", copy);
          });
          return response;
        })
        .catch(() => {
          // Offline fallback → serve cached shell
          return caches.match("/index.html");
        })
    );
    return;
  }

  /**
   * 3. Static assets (JS/CSS/images)
   * Cache-first strategy
   */
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((response) => {
          // Cache a copy for future offline use
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, copy);
          });
          return response;
        })
        .catch(() => {
          // fail silently
          return;
        });
    })
  );
});