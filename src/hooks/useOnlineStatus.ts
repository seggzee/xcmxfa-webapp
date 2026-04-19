import { useEffect, useState } from "react";

/**
 * Idiot-guide:
 * src/hooks/useOnlineStatus.ts
 * Single source of truth for browser online/offline state.
 *
 * IMPORTANT
 * - This is ONLY a connectivity signal.
 * - It does NOT mean APIs are healthy.
 * - It does NOT provide offline data.
 *
 * Product use in Phase 0:
 * - global offline banner
 * - page-level "live data unavailable" states
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

export default useOnlineStatus;