// FILE: src/app/routes.tsx
//
// =====================================================================================
// GLOBAL APP ROUTES
// =====================================================================================
//
// RN parity:
// - AppHeader lives ONCE globally, above the route table.
// - Guest avatar opens LoginModal.
// - LoginModal runs the SAME two-phase flow as /login.
//
// MESSAGE SUMMARY CONTRACT:
// - AppRoutes fetches message summary at global layout level.
// - AppHeader receives:
//     * unreadMessageCount
//     * hasAnyMessages
// - Bell is shown only when unread_count > 0
// - Badge is shown only when unread_count > 0
//
// IMPORTANT:
// - MEMBER MESSAGE SUMMARY USES psn IN POST BODY
// - NO JWT / NO BEARER TOKEN FOR THIS ENDPOINT
//
// THIS CHANGE ONLY:
// - Global push-device sync remains at AppRoutes level.
// - BUT it is now SILENT SYNC ONLY.
// - AppRoutes must NOT trigger a browser permission prompt.
// - Silent sync runs only when authenticated member identity becomes available.
// - This covers BOTH:
//     * normal login
//     * auth rehydrate / remembered-device refresh flow
// - Add global foreground Firebase push listener
// - Add global app focus / visibility refresh listeners
// - Add foreground in-app banner for app-open push receipt
// - Add passkey sign-in flow through dedicated passkeys API + backend exchange
// - Add immediate post-password-login passkey enrollment prompt
// - Add local per-device prompt suppression for passkey setup
// - No other behaviour changes.
// =====================================================================================

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { onMessage } from "firebase/messaging";

import AppHeader from "../components/AppHeader";
import AppBootSplash from "../components/AppBootSplash";

import { RequireMember } from "./guards";
import { useAuth } from "./authStore";
import { useCrew } from "./crewStore";
import { AUTH_LOGIN_URL, postJson } from "./api";
import { syncPushDeviceIfPermitted } from "../api/pushApi";
import {
  beginPasskeyAuthentication,
  finishPasskeyAuthentication,
  exchangeVerifiedPasskeyForAppLogin,
  beginPasskeyRegistration,
  finishPasskeyRegistration,
} from "../api/passkeysApi";
import {
  createPasskeyFromOptions,
  getPasskeyAssertionFromOptions,
  isPasskeySupported,
} from "../utils/passkeys";
import { messaging } from "./firebase";

// Pages
import Debug from "../pages/Debug";

import Register from "../pages/Register";
import RegisterVerify from "../pages/RegisterVerify";
import SetPassword from "../pages/SetPassword";
import ProfileWizard from "../pages/ProfileWizard";
import SelectAirports from "../pages/SelectAirports";
import Home from "../pages/Home";
import Profile from "../pages/Profile";
import Passport from "../pages/Passport";
import Esta from "../pages/Esta";
import MyFlights from "../pages/MyFlights";
import Week from "../pages/Week";
import Day from "../pages/Day";
import Messages from "../pages/Messages";
import CrewLockers from "../pages/CrewLockers";
import Faq from "../pages/Faq";
import Donate from "../pages/Donate";
import DonateReturn from "../pages/DonateReturn";
import ForgotPassword from "../pages/ForgotPassword";
import ResetPassword from "../pages/ResetPassword";
import Legal from "../pages/Legal";
import Contact from "../pages/Contact";
import Hotels from "../pages/Hotels";
import StandbyRooms from "../pages/StandbyRooms";
import TravelHistory from "../pages/TravelHistory";
import TravelHistoryRecent from "../pages/TravelHistoryRecent";

import { UI_ICONS } from "../assets";

/**
 * Idiot-guide:
 * This is the web routing table.
 * In RN, AppRoot uses `screen === "login"` etc.
 * On web, the URL path IS the screen.
 *
 * RN parity change:
 * - AppHeader lives ONCE (like RN AppRoot header area)
 * - Guest avatar opens LoginModal
 * - LoginModal runs the SAME two-phase flow as /login (Login.tsx)
 */

/**
 * Idiot-guide: extractStaffIdentity()
 * -----------------------------------
 * Copied EXACTLY from pages/Login.tsx
 */
function extractStaffIdentity(username: string) {
  const staffIdentity = String(username || "").trim().toUpperCase();
  const m = staffIdentity.match(/(\d+)$/);

  if (!m) {
    throw new Error("Invariant violation: username does not contain a PSN");
  }

  const staffNumber = m[1];
  return { staffIdentity, staffNumber };
}

function getPasskeyPromptSuppressionKey(username: string) {
  return `passkey_prompt_suppressed_v1:${String(username || "").trim().toUpperCase()}`;
}

function isPasskeyPromptSuppressed(username: string): boolean {
  if (typeof window === "undefined") return false;

  const normalized = String(username || "").trim().toUpperCase();
  if (!normalized) return false;

  try {
    return window.localStorage.getItem(getPasskeyPromptSuppressionKey(normalized)) === "1";
  } catch {
    return false;
  }
}

function suppressPasskeyPromptForUser(username: string): void {
  if (typeof window === "undefined") return;

  const normalized = String(username || "").trim().toUpperCase();
  if (!normalized) return;

  try {
    window.localStorage.setItem(getPasskeyPromptSuppressionKey(normalized), "1");
  } catch {
    // silent by design
  }
}

function normalizePasskeyPromptError(error: unknown): {
  message: string;
  treatAsReady: boolean;
} {
  const raw = String((error as any)?.message || error || "PASSKEY_REGISTRATION_FAILED");
  const lower = raw.toLowerCase();

  if (
    lower.includes("duplicate_credential") ||
    lower.includes("already set up") ||
    lower.includes("already exists") ||
    lower.includes("already ready") ||
    lower.includes("invalidstateerror")
  ) {
    return {
      message: "This device is already ready for passkey sign-in.",
      treatAsReady: true,
    };
  }

  if (
    lower.includes("passkey_creation_cancelled") ||
    lower.includes("notallowederror") ||
    lower.includes("cancelled")
  ) {
    return {
      message: "Passkey setup was cancelled.",
      treatAsReady: false,
    };
  }

  return {
    message: raw,
    treatAsReady: false,
  };
}

/**
 * Idiot-guide: what does auth/login return?
 * -----------------------------------------
 * Copied from pages/Login.tsx and expanded for passkey registration token support.
 */
type LoginResponse = {
  ok?: boolean;
  accessToken?: string | null;
  accessTokenExpiresAt?: string | null;
  refreshToken?: string | null;
  refreshTokenExpiresAt?: string | null;
  passkeyRegistrationToken?: string | null;
  passkeyRegistrationExpiresIn?: number | null;
  user?: any;
  deviceId?: string;
  error?: string;
  message?: string;
};

/**
 * Global message summary shape for AppHeader bell/badge control.
 *
 * Expected backend shape:
 * {
 *   ok: true,
 *   unread_count: number,
 *   total_count: number
 * }
 */
type MessageSummary = {
  ok?: boolean;
  unread_count?: number;
  total_count?: number;
};

type ForegroundBanner = {
  title: string;
  body: string;
  url: string;
} | null;

type PasskeyEnrollmentPrompt = {
  username: string;
  token: string;
  expiresIn: number;
  status: "idle" | "working" | "done" | "error";
  error?: string;
} | null;

// RN parity: Week needs airport passed from Home via nav("/week", { state: { airport } })
// No silent fallback.
function WeekRoute(props: {
  resetToGuestState: () => void;
}) {
  const nav = useNavigate();
  const loc = useLocation();

  const airport = (loc.state as any)?.airport;
  if (!airport) {
    throw new Error("WeekRoute: missing airport in navigation state");
  }

  return (
    <Week
      airportCode={String(airport).toUpperCase()}
      onBack={() => nav(-1)}
      onOpenDayArrivals={(item) =>
        nav(`/day/${item.dateKey}?tab=arrivals`, { state: { airport } })
      }
      onOpenDayDepartures={(item) =>
        nav(`/day/${item.dateKey}?tab=departures`, { state: { airport } })
      }
    />
  );
}

export default function AppRoutes() {
  const nav = useNavigate();
  const location = useLocation();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

const {
  auth,
  authReady,
  setAuth,
  setRouteReason,
  setOnboardingUsername,
  loginReturnTo,
  resetToGuestState,
  persistRefreshToken,
  clearPersistedRefreshToken,
} = useAuth();

  const { loadCrew } = useCrew();

  // Global message summary used by the header bell.
  // Defaults to "no unread / no messages".
  const [messageSummary, setMessageSummary] = useState<MessageSummary>({
    unread_count: 0,
    total_count: 0,
  });

  // Foreground in-app banner for app-open push receipt.
  const [foregroundBanner, setForegroundBanner] = useState<ForegroundBanner>(null);

  // Immediate post-password-login passkey enrollment prompt.
  const [passkeyEnrollmentPrompt, setPasskeyEnrollmentPrompt] =
    useState<PasskeyEnrollmentPrompt>(null);

  const bannerTimeoutRef = useRef<number | null>(null);

  // Track previous unread count so sound only plays on a true increase,
  // not on initial load, route change, or count decreases.
  const prevUnreadRef = useRef<number | null>(null);

  // Audio is prepared once at app-shell level. If the file is missing or
  // browser playback is blocked, failures are silent by design.
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const audio = new Audio("/sounds/notification.mp3");
    audio.preload = "auto";
    notificationAudioRef.current = audio;

    return () => {
      notificationAudioRef.current = null;
    };
  }, []);

  const showForegroundBanner = useCallback((title: string, body: string, url: string) => {
    setForegroundBanner({
      title: title || "Notification",
      body: body || "",
      url: url || "/messages",
    });

    if (bannerTimeoutRef.current !== null) {
      window.clearTimeout(bannerTimeoutRef.current);
    }

    bannerTimeoutRef.current = window.setTimeout(() => {
      setForegroundBanner(null);
      bannerTimeoutRef.current = null;
    }, 6000);
  }, []);

  useEffect(() => {
    return () => {
      if (bannerTimeoutRef.current !== null) {
        window.clearTimeout(bannerTimeoutRef.current);
      }
    };
  }, []);

  // Keep installed app icon badge aligned with unread count.
  // If the browser/platform does not support badges, fail silently.
  const syncAppBadge = useCallback((unreadCount: number) => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return;
    }

    const navAny = navigator as any;

    try {
      if (unreadCount > 0 && typeof navAny.setAppBadge === "function") {
        void navAny.setAppBadge(unreadCount);
        return;
      }

      if (unreadCount <= 0 && typeof navAny.clearAppBadge === "function") {
        void navAny.clearAppBadge();
      }
    } catch {
      // silent by design
    }
  }, []);

  // Play sound only when unread count increases after the initial summary baseline
  // has already been established. This avoids sound on first page load.
  const maybePlayUnreadIncreaseSound = useCallback((unreadCount: number) => {
    const prevUnread = prevUnreadRef.current;

    if (prevUnread === null) {
      prevUnreadRef.current = unreadCount;
      return;
    }

    if (unreadCount > prevUnread) {
      try {
        const audio = notificationAudioRef.current;
        if (audio) {
          audio.currentTime = 0;
          void audio.play();
        }
      } catch {
        // silent by design
      }
    }

    prevUnreadRef.current = unreadCount;
  }, []);

  // Centralized summary refresh so it can be called from:
  // - route-change effect
  // - global event listener ("messages:summary-refresh")
  // - global foreground push listener
  // - global app focus / visibility resume listeners
  const refreshMessageSummary = useCallback(async () => {
    // LOCKED CONTRACT: canonical PSN is auth.user.username ONLY.
    const psn = String(auth?.user?.username || "").trim().toUpperCase();

    if (auth?.mode !== "member" || !psn) {
      setMessageSummary({
        unread_count: 0,
        total_count: 0,
      });

      syncAppBadge(0);
      prevUnreadRef.current = 0;
      return;
    }

    try {
      const { MESSAGES_SUMMARY_URL } = await import("./api");

      const resp = await postJson<MessageSummary>(MESSAGES_SUMMARY_URL, { psn });

      const unreadCount = Number(resp?.unread_count || 0);
      const totalCount = Number(resp?.total_count || 0);

      setMessageSummary({
        unread_count: unreadCount,
        total_count: totalCount,
      });

      // Sync OS/app-level badge and optionally play sound for newly arrived unread.
      syncAppBadge(unreadCount);
      maybePlayUnreadIncreaseSound(unreadCount);
    } catch {
      // Fail safe: hide bell/badge rather than showing stale garbage.
      setMessageSummary({
        unread_count: 0,
        total_count: 0,
      });

      syncAppBadge(0);
      prevUnreadRef.current = 0;
    }
  }, [
    auth?.mode,
    auth?.user?.username,
    maybePlayUnreadIncreaseSound,
    syncAppBadge,
  ]);

  // Safe fallback refresh on route change / identity change.
  useEffect(() => {
    void refreshMessageSummary();
  }, [refreshMessageSummary, location.pathname]);

  // Immediate refresh when message-related UI dispatches the global event.
  // This is what makes the bell/badge update as messages are read/dismissed.
  useEffect(() => {
    const handler = () => {
      void refreshMessageSummary();
    };

    window.addEventListener("messages:summary-refresh", handler);

    return () => {
      window.removeEventListener("messages:summary-refresh", handler);
    };
  }, [refreshMessageSummary]);

  // Global foreground Firebase push listener.
  // App open + push arrives => refresh unread summary immediately
  // and show a visible in-app banner.
  useEffect(() => {
    const unsubscribe = onMessage(messaging, (payload) => {
      void refreshMessageSummary();

      const title = String(payload?.data?.title || payload?.notification?.title || "Notification");
      const body = String(payload?.data?.body || payload?.notification?.body || "");
      const url = String(payload?.data?.url || "/messages");

      showForegroundBanner(title, body, url);
    });

    return () => {
      unsubscribe();
    };
  }, [refreshMessageSummary, showForegroundBanner]);

  // Global app resume/focus listeners.
  // User returns to app/tab => refresh unread summary immediately.
  useEffect(() => {
    const onFocus = () => {
      void refreshMessageSummary();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshMessageSummary();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshMessageSummary]);

  // Global push-device sync at AppRoutes level.
  //
  // IMPORTANT:
  // - This must be SILENT SYNC ONLY.
  // - It must NOT trigger Notification.requestPermission().
  // - It should only sync a device when permission is already granted.
  //
  // Why here?
  // - AppRoutes is the global authenticated app shell.
  // - It sees BOTH:
  //     * fresh login
  //     * remembered-device auth rehydrate
  //
  // Behaviour:
  // - If not member, do nothing.
  // - If member PSN missing, do nothing.
  // - If permission not granted / token unavailable / backend fails, fail silently.
  //   Push sync must never break routing or app boot.
  useEffect(() => {
    // LOCKED CONTRACT: canonical PSN is auth.user.username ONLY.
    const psn = String(auth?.user?.username || "").trim().toUpperCase();

    if (auth?.mode !== "member" || !psn) {
      return;
    }

    void syncPushDeviceIfPermitted(psn).catch(() => {
      // silent by design
    });
  }, [auth?.mode, auth?.user?.username]);

  /**
   * If normal password login returned a short-lived passkey registration token,
   * prime the immediate post-login enrollment prompt.
   *
   * IMPORTANT
   * - Prompt is suppressed locally per-device and per-username after:
   *   * explicit dismiss ("Not now")
   *   * successful passkey creation
   *   * graceful already-ready handling
   */
  const primePasskeyEnrollmentPrompt = useCallback(
    (resp: LoginResponse, usernameForSuppression: string) => {
      const token = String(resp?.passkeyRegistrationToken || "").trim();
      const expiresIn = Number(resp?.passkeyRegistrationExpiresIn || 0);
      const normalizedUsername = String(usernameForSuppression || "").trim().toUpperCase();

      if (!isPasskeySupported() || !token || expiresIn <= 0 || !normalizedUsername) {
        setPasskeyEnrollmentPrompt(null);
        return;
      }

      if (isPasskeyPromptSuppressed(normalizedUsername)) {
        setPasskeyEnrollmentPrompt(null);
        return;
      }

      setPasskeyEnrollmentPrompt({
        username: normalizedUsername,
        token,
        expiresIn,
        status: "idle",
      });
    },
    []
  );

  /**
   * Shared member-login completion path.
   *
   * WHY THIS EXISTS
   * - Password login and passkey login must both end in the SAME auth-store shape
   *   and the SAME post-login routing logic.
   * - This keeps the password flow as source of truth and avoids a parallel branch.
   */
  const completeMemberLogin = useCallback(
    async (
      resp: LoginResponse,
      opts?: {
        submittedUsername?: string;
        rememberDevice?: boolean;
        deviceId?: string;
      }
    ) => {
      const rememberDevice = !!opts?.rememberDevice;
      const submittedUsername = String(opts?.submittedUsername || "").trim();

      const identitySource =
        submittedUsername ||
        String(resp?.user?.username || "").trim().toUpperCase();

      if (!identitySource) {
        throw new Error("LOGIN_NO_IDENTITY");
      }

      const { staffIdentity, staffNumber } = extractStaffIdentity(identitySource);

      setAuth({
        mode: "member",
        user: {
          ...(resp?.user || {}),
          staff_identity: staffIdentity,
          staff_number: staffNumber,
          username: staffIdentity,
        },
        accessToken: resp?.accessToken || null,
        refreshToken: resp?.refreshToken || null,
      });

      if (rememberDevice && resp?.refreshToken) {
        persistRefreshToken(String(resp.refreshToken));
      } else {
        clearPersistedRefreshToken();
      }

      // After normal password login, this may prime optional passkey enrollment.
      // After passkey login exchange, these fields will typically be absent.
      primePasskeyEnrollmentPrompt(resp, staffIdentity);

      const token = resp?.accessToken || "";
      if (!token) {
        throw new Error("LOGIN_NO_ACCESS_TOKEN");
      }

      const bearer: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      try {
        const { CREW_EXISTS_URL, MEMBERS_STATUS_URL } = await import("./api");

        const existsResp = await postJson<any>(
          CREW_EXISTS_URL,
          { psn: staffIdentity },
          bearer
        );

        const exists = Boolean(existsResp?.exists);

        if (exists) {
          const statusResp = await postJson<any>(
            MEMBERS_STATUS_URL,
            { psn: staffIdentity },
            bearer
          );

          const next = String(statusResp?.next_step || "").trim().toLowerCase();

          if (next === "set_password") {
            await loadCrew(staffIdentity);
            setOnboardingUsername(staffIdentity);
            setRouteReason("password_required");
            nav("/register/set-password", { replace: true });
            return;
          }

          if (next === "details") {
            await loadCrew(staffIdentity);
            setOnboardingUsername(staffIdentity);
            setRouteReason("profile_incomplete");
            nav("/profile", { replace: true });
            return;
          }

          await loadCrew(staffIdentity);
          nav("/home", { replace: true });
          return;
        }

        // exists === false -> ProfileWizard
        await loadCrew(staffIdentity);
        setOnboardingUsername(staffIdentity);
        nav("/profile-wizard", { replace: true });
        return;
      } catch {
        throw new Error(
          "Login succeeded, but the post-login checks failed (network/server). Please try again."
        );
      }
    },
    [
      clearPersistedRefreshToken,
      loadCrew,
      nav,
      persistRefreshToken,
      primePasskeyEnrollmentPrompt,
      setAuth,
      setOnboardingUsername,
      setRouteReason,
    ]
  );

  /**
   * Immediate post-login passkey enrollment flow.
   *
   * INPUT
   * - short-lived passkeyRegistrationToken from normal password login response
   *
   * FLOW
   * - apps-backend login.php issues registration token
   * - passkeys API register/begin verifies token and returns creation options
   * - browser creates passkey
   * - passkeys API register/finish verifies token and stores credential
   */
  const handleCreatePasskeyNow = useCallback(async () => {
    if (!passkeyEnrollmentPrompt?.token || !passkeyEnrollmentPrompt?.username) {
      return;
    }

    setPasskeyEnrollmentPrompt((prev) =>
      prev ? { ...prev, status: "working", error: undefined } : prev
    );

    try {
      const beginResp = await beginPasskeyRegistration(passkeyEnrollmentPrompt.token);
      const credential = await createPasskeyFromOptions(beginResp.options);
      await finishPasskeyRegistration(passkeyEnrollmentPrompt.token, credential);

      suppressPasskeyPromptForUser(passkeyEnrollmentPrompt.username);

      setPasskeyEnrollmentPrompt((prev) =>
        prev ? { ...prev, status: "done", error: undefined } : prev
      );
    } catch (err) {
      const normalized = normalizePasskeyPromptError(err);

      if (normalized.treatAsReady) {
        suppressPasskeyPromptForUser(passkeyEnrollmentPrompt.username);

        setPasskeyEnrollmentPrompt((prev) =>
          prev ? { ...prev, status: "done", error: undefined } : prev
        );
        return;
      }

      setPasskeyEnrollmentPrompt((prev) =>
        prev
          ? {
              ...prev,
              status: "error",
              error: normalized.message,
            }
          : prev
      );
    }
  }, [passkeyEnrollmentPrompt]);

  const handleDismissPasskeyPrompt = useCallback(() => {
    if (passkeyEnrollmentPrompt?.username) {
      suppressPasskeyPromptForUser(passkeyEnrollmentPrompt.username);
    }
    setPasskeyEnrollmentPrompt(null);
  }, [passkeyEnrollmentPrompt]);
  
  if (!authReady) {
	  return <AppBootSplash />;
  }

  return (
    <>
      {/* ONE global header (RN AppRoot parity) */}
      <AppHeader
        auth={auth}
        onGoHome={() => nav("/home")}
        onGoProfile={() => nav("/profile")}
        onGoMessages={() => nav("/messages")}
        unreadMessageCount={Number(messageSummary.unread_count || 0)}
        /* unreadMessageCount={0}  / DEBUG USE ONLY */

        // Product rule:
        // - bell exists only while unread messages exist
        // - when unread_count hits 0, bell disappears
        hasAnyMessages={Number(messageSummary.unread_count || 0) > 0}
        /* hasAnyMessages={false}  / DEBUG USE ONLY */

        onForgotPassword={() => {
          nav("/forgot-password");
        }}

        onLogout={() => {
          // Web: local reset (server logout can be added later if/when you have it)
          resetToGuestState();
          setPasskeyEnrollmentPrompt(null);
          nav("/home", { replace: true });
        }}

        onCancelLogin={() => {
          // RN parity: return to loginReturnTo (or /home)
          nav(loginReturnTo || "/home", { replace: true });
        }}

        onCreateAccount={() => {
          nav("/register");
        }}

        onLoginSubmit={async ({ username, password, rememberDevice }) => {
          // === PASSWORD LOGIN -> SHARED COMPLETE LOGIN PATH ===

          if (!String(username).trim()) {
            throw new Error("Please enter your username / staff identity.");
          }
          if (!String(password).trim()) {
            throw new Error("Please enter your password.");
          }

          const { staffIdentity } = extractStaffIdentity(username);

          const resp = await postJson<LoginResponse>(AUTH_LOGIN_URL, {
            username: staffIdentity,
            password,
            rememberDevice: !!rememberDevice,
          });

          await completeMemberLogin(resp, {
            submittedUsername: staffIdentity,
            rememberDevice: !!rememberDevice,
          });
        }}

        onPasskeyLogin={async ({
          usernameHint,
          rememberDevice,
          deviceId,
        }: {
          usernameHint?: string;
          rememberDevice?: boolean;
          deviceId?: string;
        }) => {
          // === PASSKEY LOGIN FLOW ===
          // 1. passkeys API begin
          // 2. browser get()
          // 3. passkeys API finish -> short-lived exchange token
          // 4. main backend exchange -> SAME login response shape as password login
          // 5. shared complete login path

          const beginResp = await beginPasskeyAuthentication(usernameHint);
          const credential = await getPasskeyAssertionFromOptions(beginResp.options);
          const finishResp = await finishPasskeyAuthentication(credential);

          const exchangeResp = await exchangeVerifiedPasskeyForAppLogin(
            finishResp.exchange.token,
            rememberDevice ?? true,
            deviceId
          );

          await completeMemberLogin(exchangeResp, {
            submittedUsername: String(exchangeResp?.user?.username || ""),
            rememberDevice: rememberDevice ?? true,
            deviceId,
          });
        }}
      />

      {foregroundBanner ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            nav(foregroundBanner.url || "/messages");
            setForegroundBanner(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              nav(foregroundBanner.url || "/messages");
              setForegroundBanner(null);
            }
          }}
          style={{
            position: "fixed",
            top: 84,
            right: 16,
            left: 16,
            zIndex: 2000,
            maxWidth: 560,
            margin: "0 auto",
            background: "#111827",
            color: "#ffffff",
            borderRadius: 14,
            boxShadow: "0 10px 30px rgba(0,0,0,0.24)",
            padding: "14px 16px",
            cursor: "pointer",
          }}
          aria-label="Open new message"
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                {foregroundBanner.title}
              </div>
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.35,
                  opacity: 0.95,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {foregroundBanner.body}
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setForegroundBanner(null);
              }}
              style={{
                border: 0,
                background: "transparent",
                color: "#ffffff",
                cursor: "pointer",
                fontSize: 18,
                lineHeight: 1,
                padding: 0,
              }}
              aria-label="Dismiss notification banner"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

      {passkeyEnrollmentPrompt ? (
        <div
          style={{
            position: "fixed",
            top: foregroundBanner ? 164 : 84,
            right: 16,
            left: 16,
            zIndex: 1990,
            maxWidth: 560,
            margin: "0 auto",
            background: "#ffffff",
            color: "#111827",
            borderRadius: 14,
            boxShadow: "0 10px 30px rgba(0,0,0,0.16)",
            padding: "14px 16px",
            border: "1px solid rgba(17,24,39,0.08)",
          }}
        >
          {passkeyEnrollmentPrompt.status === "done" ? (
            <>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>
                Passkey ready
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.35, marginBottom: 12 }}>
                You can now sign in with a passkey on this device.
              </div>
              <button
                type="button"
                onClick={() => setPasskeyEnrollmentPrompt(null)}
                style={{
                  border: 0,
                  borderRadius: 10,
                  padding: "10px 14px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Dismiss
              </button>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>
                Create a passkey on this device
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.35, marginBottom: 12 }}>
                <br />
				Use Face ID, Touch ID, Windows Hello, or your device PIN to sign in faster next time.
				<br /><br />
				This does not affect your current password.
				<br />
              </div>

              {passkeyEnrollmentPrompt.status === "error" &&
              passkeyEnrollmentPrompt.error ? (
                <div
                  style={{
                    fontSize: 13,
                    marginBottom: 12,
                    color: "#b91c1c",
                    fontWeight: 600,
                  }}
                >
                  {passkeyEnrollmentPrompt.error}
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => void handleCreatePasskeyNow()}
                  disabled={passkeyEnrollmentPrompt.status === "working"}
                  style={{
                    border: 0,
                    borderRadius: 10,
					marginRight: 50,
                    padding: "10px 14px",
                    cursor:
                      passkeyEnrollmentPrompt.status === "working"
                        ? "default"
                        : "pointer",
                    fontWeight: 700,
                  }}
                >
                  {passkeyEnrollmentPrompt.status === "working"
                    ? "Creating..."
                    : "Create passkey"}
                </button>

                <button
                  type="button"
                  onClick={handleDismissPasskeyPrompt}
                  disabled={passkeyEnrollmentPrompt.status === "working"}
                  style={{
                    borderRadius: 10,
                    padding: "10px 14px",
                    cursor:
                      passkeyEnrollmentPrompt.status === "working"
                        ? "default"
                        : "pointer",
                    fontWeight: 700,
                    background: "transparent",
                  }}
                >
                  Not now
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* Route table */}
      <Routes>
        {/* Guest / entry */}
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/login" element={<Navigate to="/home?login=1" replace />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* /login still exists, but it no longer renders a page. */}
        <Route path="/debug" element={<Debug />} />

        {/* Registration/onboarding */}
        <Route path="/register" element={<Register />} />
        <Route path="/register/verify" element={<RegisterVerify />} />
        <Route path="/register/set-password" element={<SetPassword />} />
        <Route path="/profile-wizard" element={<ProfileWizard />} />

        {/* App routes */}
        <Route path="/selectairports" element={<SelectAirports />} />
        <Route path="/home" element={<Home />} />
        <Route path="/faq" element={<Faq />} />
        <Route path="/donate" element={<Donate />} />
        <Route path="/donate-return" element={<DonateReturn />} />
        <Route path="/legal" element={<Legal />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/hotels" element={<Hotels />} />
		
		
        <Route path="/standby-rooms" element={<StandbyRooms />} />	
		<Route path="/standby-rooms/:roomId" element={<div>Standby room detail page</div>} />


		<Route 
			path="/standby-rooms/submit" 
			element={
						<div className="app-screen">
						
							<div className="app-container">
							
								{/* Header */}
								<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>

								</div>

								{/* Content card */}
								<div
								  className="card"
								  style={{
									maxWidth: 720,
									margin: "0 auto",
									padding: 16,
									textAlign:"center",
								  }}
								>
								
									<img
										src={UI_ICONS.wip}
										alt="Under Construction"
										style={{
										  width: 250,
										  height: 250,
										  objectFit: "contain",
										  borderRadius: 14,
										}}
									/>										
								
									<p style={{ margin: 0, lineHeight: 1.6, color: "#4b5563" }}>
										In future, this page will contain the form to self submit rooms to rent.
									</p>
									<p> </p>
									<p style={{ margin: 0, lineHeight: 1.6, color: "#4b5563" }}>
										For now please email admin@xcmxfa.com with your room availabilities.
									</p>									
								</div>
								
							</div>
							
						</div>
												
					} 
		/>			

        <Route
          path="/week"
          element={<WeekRoute resetToGuestState={resetToGuestState} />}
        />

        <Route path="/day/:dateKey" element={<Day />} />

        {/* Member-only routes */}
        <Route
          path="/myflights"
          element={
            <RequireMember>
              <MyFlights />
            </RequireMember>
          }
        />

        <Route
          path="/crew-lockers"
          element={
            <RequireMember>
              <CrewLockers />
            </RequireMember>
          }
        />

        <Route
          path="/profile"
          element={
            <RequireMember>
              <Profile />
            </RequireMember>
          }
        />
		
		<Route
          path="/profile/travel-history"
          element={
            <RequireMember>
              <TravelHistory />
            </RequireMember>
          }
        />
		
		
		<Route
          path="/profile/travel-history/recent"
          element={
            <RequireMember>
              <TravelHistoryRecent />
            </RequireMember>
          }
        />
		

        {/* Messages page currently remains directly routable.
            If you want this member-only later, wrap it in RequireMember too. */}
        <Route path="/messages" element={<Messages />} />

        <Route
          path="/passport"
          element={
            <RequireMember>
              <Passport />
            </RequireMember>
          }
        />

        <Route
          path="/esta"
          element={
            <RequireMember>
              <Esta />
            </RequireMember>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </>
  );
}