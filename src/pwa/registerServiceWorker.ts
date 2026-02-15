// src/pwa/registerServiceWorker.ts
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  // Avoid SW in dev by default (Vite dev server).
  if (import.meta.env.DEV) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.error("SW registration failed:", err));
  });
}
