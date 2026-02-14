// src/app/authStore.tsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AUTH_REFRESH_URL, postJson } from "./api";

/**
 * =============================================================================
 * AUTH STORE (WEB) — V4 SEMANTICS (VERIFIED AGAINST refresh.php)
 * =============================================================================
 *
 * Idiot-guide (read this first):
 *
 * 1) What we persist (and why)
 *    - We persist ONLY the refreshToken in localStorage, and ONLY when the user
 *      logs in with rememberDevice=true (that write happens in your login handler).
 *    - We do NOT persist accessToken. It is short-lived and will be obtained via refresh.
 *
 * 2) What happens on a browser hard refresh / page load
 *    - App boots as guest.
 *    - If localStorage has a refreshToken, we POST { refreshToken } to AUTH_REFRESH_URL.
 *    - refresh.php returns:
 *        { ok: true, accessToken, refreshToken (ROTATED), user, ... }
 *    - We MUST overwrite localStorage with the rotated refreshToken.
 *
 * 3) Why we cannot use a simple boolean guard in dev
 *    - React 18 StrictMode (dev) mounts, runs effects, unmounts, then mounts again.
 *    - refresh.php ROTATES refreshToken on success.
 *    - If we call refresh.php twice with the same token, the second call will fail with
 *      INVALID_REFRESH_TOKEN and kick you back to guest.
 *
 * 4) The correct fix
 *    - Deduplicate the boot refresh network call by sharing ONE module-scope Promise.
 *    - Both StrictMode mounts await the same Promise, so refresh.php is called once.
 *
 * 5) Failure behaviour (must stay strict)
 *    - If refresh fails for any reason: clear localStorage refresh token and remain guest.
 *    - No fallbacks, no retries, no “helpful” behaviour.
 * =============================================================================
 */

export type AuthMode = "guest" | "member";

export type AuthState = {
  mode: AuthMode;
  user: any | null;
  accessToken: string | null;
  refreshToken: string | null; // kept in memory for convenience; source of truth is localStorage
};

export type RouteReason =
  | null
  | "password_required"
  | "profile_incomplete"
  | "details_saved";

type AuthContextValue = {
  // Auth state
  auth: AuthState;
  setAuth: React.Dispatch<React.SetStateAction<AuthState>>;

  // Why did we route you here?
  routeReason: RouteReason;
  setRouteReason: React.Dispatch<React.SetStateAction<RouteReason>>;

  // Used during onboarding/resume onboarding
  onboardingUsername: string;
  setOnboardingUsername: React.Dispatch<React.SetStateAction<string>>;

  // If user is a guest and tries to access a member-only page,
  // we route them to /login and remember where to return to after login.
  loginReturnTo: string;
  setLoginReturnTo: React.Dispatch<React.SetStateAction<string>>;

  // Derived identity key (PSN / staff identity)
  psn: string;

  // A memoized auth header for API requests
  authHeader: Record<string, string>;

  // Big reset button (logout + clear onboarding + clear routeReason)
  resetToGuestState(): void;

  // V4: refresh token persistence helpers (single source of truth)
  persistRefreshToken(refreshToken: string): void;
  clearPersistedRefreshToken(): void;
};

const AuthCtx = createContext<AuthContextValue | null>(null);

// NOTE: this key must match what you inspect in DevTools Application tab
const REFRESH_TOKEN_STORAGE_KEY = "xcmxfa:refreshToken";

type RefreshResponse = {
  ok: boolean;
  accessToken?: string | null;
  accessTokenExpiresAt?: string | null;
  refreshToken?: string | null; // rotated on success (per refresh.php)
  refreshTokenExpiresAt?: string | null;
  user?: any;
  error?: string;
  message?: string;
};

// -----------------------------------------------------------------------------
// Boot refresh dedupe (React 18 StrictMode dev double-mount safe)
// -----------------------------------------------------------------------------
let __bootRefreshPromise: Promise<RefreshResponse | null> | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // --------------------------------------------
  // 1) Auth state (AppRoot is boss)
  // --------------------------------------------
  const [auth, setAuth] = useState<AuthState>({
    mode: "guest",
    user: null,
    accessToken: null,
    refreshToken: null,
  });

  // --------------------------------------------
  // 2) Global routing helper states
  // --------------------------------------------
  const [routeReason, setRouteReason] = useState<RouteReason>(null);
  const [onboardingUsername, setOnboardingUsername] = useState("");
  const [loginReturnTo, setLoginReturnTo] = useState("/home");

  // --------------------------------------------
  // 3) V4: refresh token persistence helpers
  // --------------------------------------------
  const persistRefreshToken = (refreshToken: string) => {
    const v = String(refreshToken || "").trim();
    if (!v) return;
    try {
      localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, v);
    } catch (e) {
      console.error("[authStore] persistRefreshToken failed", e);
    }
  };

  const clearPersistedRefreshToken = () => {
    try {
      localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    } catch (e) {
      console.error("[authStore] clearPersistedRefreshToken failed", e);
    }
  };

  // --------------------------------------------
  // 4) V4: boot rehydrate (refresh on app start)
  // --------------------------------------------
  useEffect(() => {
    let alive = true;

    (async () => {
      // If already logged in (e.g. hot reload), do nothing.
      if (auth?.mode === "member") return;

      let stored = "";
      try {
        stored = String(localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) || "").trim();
      } catch {
        stored = "";
      }

      // No stored token -> remain guest
      if (!stored) return;

      // React 18 StrictMode dev will run this effect twice.
      // refresh.php rotates tokens, so we must ensure ONLY ONE network call.
      if (!__bootRefreshPromise) {
        __bootRefreshPromise = (async () => {
          try {
            return await postJson<RefreshResponse>(AUTH_REFRESH_URL, {
              refreshToken: stored,
            });
          } catch {
            return null;
          }
        })();
      }

      const r = await __bootRefreshPromise;

      if (!alive) return;

      // Any failure -> clear storage and remain guest
      if (!r || r.ok !== true) {
        clearPersistedRefreshToken();
        return;
      }

      const accessToken = String(r.accessToken || "").trim();
      const rotatedRefreshToken = String(r.refreshToken || "").trim();

      // refresh.php contract: both must exist on success
      if (!accessToken || !rotatedRefreshToken) {
        clearPersistedRefreshToken();
        return;
      }

      // IMPORTANT: overwrite stored token with rotated token
      persistRefreshToken(rotatedRefreshToken);

      setAuth({
        mode: "member",
        user: r.user ?? null,
        accessToken,
        refreshToken: rotatedRefreshToken,
      });
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------------------------------
  // 5) Derived: psn (identity key)
  // --------------------------------------------
  const psn = useMemo(() => {
    return String(auth?.user?.staff_identity || auth?.user?.username || "")
      .trim()
      .toUpperCase();
  }, [auth?.user?.staff_identity, auth?.user?.username]);

  // --------------------------------------------
  // 6) Derived: authHeader for API calls
  // --------------------------------------------
  const authHeader: Record<string, string> = auth.accessToken
    ? { Authorization: `Bearer ${auth.accessToken}` }
    : {};

  // --------------------------------------------
  // 7) Reset to guest state (matches RN resetToGuestState)
  // --------------------------------------------
  const resetToGuestState = () => {
    setAuth({ mode: "guest", user: null, accessToken: null, refreshToken: null });
    setRouteReason(null);
    setOnboardingUsername("");
    setLoginReturnTo("/home");
    clearPersistedRefreshToken();

    // Idiot-guide:
    // If the user logs out, we must allow a future boot refresh attempt to run again.
    // This clears the dedupe so next page load can refresh with a newly stored token.
    __bootRefreshPromise = null;
  };

  return (
    <AuthCtx.Provider
      value={{
        auth,
        setAuth,
        routeReason,
        setRouteReason,
        onboardingUsername,
        setOnboardingUsername,
        loginReturnTo,
        setLoginReturnTo,
        psn,
        authHeader,
        resetToGuestState,
        persistRefreshToken,
        clearPersistedRefreshToken,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
