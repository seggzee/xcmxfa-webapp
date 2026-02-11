import { createContext, useContext, useMemo, useState } from "react";

/**
 * Idiot-guide:
 * This is the web equivalent of AppRoot's auth + routing state.
 *
 * RN uses:
 * - screen string (manual router)
 * - auth object (mode, user, tokens)
 * - routeReason (why you got routed here)
 * - onboardingUsername (resume setup)
 * - loginReturnTo (where to go after login)
 *
 * Web uses:
 * - URL routes as the "screen"
 * - This store for everything else (auth, routeReason, onboardingUsername, etc.)
 */

export type AuthMode = "guest" | "member";

export type AuthState = {
  mode: AuthMode;
  user: any | null; // server-returned user object + our staff_identity/staff_number normalization
  accessToken: string | null;
  refreshToken: string | null;
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
};

const AuthCtx = createContext<AuthContextValue | null>(null);

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
  // 3) Derived: psn (identity key)
  // --------------------------------------------
  // Idiot-guide:
  // In RN AppRoot, psn is derived from auth.user.staff_identity or auth.user.username.
  // We mirror that exactly.
  const psn = useMemo(() => {
    return String(auth?.user?.staff_identity || auth?.user?.username || "")
      .trim()
      .toUpperCase();
  }, [auth?.user?.staff_identity, auth?.user?.username]);


// --------------------------------------------
// 4) Derived: authHeader for API calls
// --------------------------------------------
const authHeader: Record<string, string> = auth.accessToken
  ? { Authorization: `Bearer ${auth.accessToken}` }
  : {};

  
  // --------------------------------------------
  // 5) Reset to guest state (matches RN resetToGuestState)
  // --------------------------------------------
  // Idiot-guide:
  // This does NOT perform navigation (URL change) here.
  // The caller will navigate to /home.
  const resetToGuestState = () => {
    setAuth({ mode: "guest", user: null, accessToken: null, refreshToken: null });
    setRouteReason(null);
    setOnboardingUsername("");
    setLoginReturnTo("/home");
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
