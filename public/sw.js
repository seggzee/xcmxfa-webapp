/* public/sw.js
   Minimal SW for installability + lifecycle hygiene.
   IMPORTANT: No offline caching implemented. */

self.addEventListener("install", (event) => {
  // Activate immediately after install
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Take control of uncontrolled clients ASAP
  event.waitUntil(self.clients.claim());
});

// No fetch handler => browser default network behavior (NO caching).
