import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import "./styles/index.css";
import App from "./App.tsx";

/**
 * ROOT APP SHELL
 *
 * PURPOSE
 * - Keep Vite PWA registration at entry level
 * - Use PROMPT update flow:
 *    * detect when a new app version is ready
 *    * show app-shell prompt
 *    * reload only when user confirms
 *
 * IMPORTANT
 * - This is NOT autoUpdate
 * - No forced refresh while user is busy
 * - updateSW() is only called when the user taps Reload
 */
function RootApp() {
  const [showPwaUpdatePrompt, setShowPwaUpdatePrompt] = useState(false);
  const [showOfflineReadyPrompt, setShowOfflineReadyPrompt] = useState(false);

  const updateServiceWorkerRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const updateSW = registerSW({
      immediate: true,

      onNeedRefresh() {
        setShowPwaUpdatePrompt(true);
      },

      onOfflineReady() {
        setShowOfflineReadyPrompt(true);
      },
    });

    updateServiceWorkerRef.current = async () => {
      await updateSW();
    };
  }, []);

  const handleConfirmReload = useCallback(async () => {
    setShowPwaUpdatePrompt(false);

    try {
      await updateServiceWorkerRef.current?.();
    } catch (err) {
      console.error("[PWA] updateSW failed", err);
    }
  }, []);

  const handleDismissReloadPrompt = useCallback(() => {
    setShowPwaUpdatePrompt(false);
  }, []);

  const handleDismissOfflineReady = useCallback(() => {
    setShowOfflineReadyPrompt(false);
  }, []);

  return (
    <App
      showPwaUpdatePrompt={showPwaUpdatePrompt}
      onConfirmReload={handleConfirmReload}
      onDismissReloadPrompt={handleDismissReloadPrompt}
      showOfflineReadyPrompt={showOfflineReadyPrompt}
      onDismissOfflineReady={handleDismissOfflineReady}
    />
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
);