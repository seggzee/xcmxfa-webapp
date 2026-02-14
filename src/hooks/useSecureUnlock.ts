import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Web port of RN useSecureUnlock.js
 *
 * RN uses Expo LocalAuthentication (biometrics/passcode).
 * Web cannot do true device auth without a server-backed WebAuthn challenge.
 *
 * Semantics preserved:
 * - unlocked boolean
 * - unlock(): Promise<boolean>
 * - auto-lock on timeout
 * - auto-lock when tab becomes hidden (background)
 *
 * IMPORTANT:
 * Do NOT lock on window.blur because browser dialogs (confirm/prompt)
 * trigger blur and would immediately re-lock.
 */
export function useSecureUnlock(timeoutMs = 60_000) {
  const [unlocked, setUnlocked] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  const timeoutRef = useRef<number | null>(null);

  const lockNow = useCallback(() => {
    setUnlocked(false);
    setExpiresAt(null);
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const unlock = useCallback(async () => {
    const ok = window.confirm("Unlock secure information");
    if (!ok) return false;

    const expiry = Date.now() + timeoutMs;
    setUnlocked(true);
    setExpiresAt(expiry);
    return true;
  }, [timeoutMs]);

  // Auto-lock when tab is backgrounded (closest web equivalent of RN AppState !== "active")
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") lockNow();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [lockNow]);

  // Auto-lock on timeout (same semantics as RN)
  useEffect(() => {
    if (!expiresAt) return;

    const ms = Math.max(0, expiresAt - Date.now());
    timeoutRef.current = window.setTimeout(() => {
      lockNow();
    }, ms);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [expiresAt, lockNow]);

  return { unlocked, unlock };
}
