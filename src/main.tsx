import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import "./styles/index.css";
import App from "./App.tsx";

/**
 * Phase 0 PWA registration
 * ------------------------
 * - Vite PWA plugin owns the service worker lifecycle
 * - autoUpdate mode keeps the shell current
 * - immediate registration ensures the app can become ready for offline shell use
 */
registerSW({
  immediate: true,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);