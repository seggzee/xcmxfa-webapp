// src/app/guards.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./authStore";
import { STORAGE_PENDING_USERNAME } from "./storageKeys";

/**
 * Idiot-guide:
 * This file holds router "guards".
 *
 * IMPORTANT FIX (refresh on member-only routes):
 * - On a hard refresh, authStore may briefly be "guest" while it performs refresh-token boot.
 * - If we redirect immediately, we lose the intended URL (e.g. /myflights -> /login or /home).
 *
 * RN parity intent:
 * - During "boot check", do NOT redirect yet.
 * - After a short grace window:
 *    - if auth becomes member -> render
 *    - if still not member -> redirect to /login (with returnTo)
 *
 * We do this WITHOUT inventing authStore flags: we just wait briefly.
 */

export function RequireMember({ children }: { children: React.ReactNode }) {
  const { auth, setLoginReturnTo } = useAuth();
  const loc = useLocation();

  // A small boot grace window to let refresh-token boot complete on hard refresh.
  // Keeps UX stable and prevents "refresh kicks me home" on member-only routes.
  const BOOT_GRACE_MS = 2000;

  const [bootGraceExpired, setBootGraceExpired] = useState(false);

  // Capture returnTo once (and do it in an effect, not during render)
  const returnTo = useMemo(() => loc.pathname + loc.search, [loc.pathname, loc.search]);

  useEffect(() => {
    setLoginReturnTo(returnTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnTo]);

  useEffect(() => {
    // If already member, no need for grace window.
    if (auth.mode === "member") {
      setBootGraceExpired(false);
      return;
    }

    setBootGraceExpired(false);
    const t = window.setTimeout(() => setBootGraceExpired(true), BOOT_GRACE_MS);
    return () => window.clearTimeout(t);
  }, [auth.mode]);

  if (auth.mode !== "member") {
    // During boot grace window: don't redirect yet (prevents refresh bounce).
    if (!bootGraceExpired) {
      return (
        <div className="app-screen">
          <div className="app-container" style={{ paddingTop: 16 }}>
            <div className="card" style={{ textAlign: "center" }}>
              <div className="text-title" style={{ fontSize: 16 }}>
                Checking login…
              </div>
              <div style={{ marginTop: 8, opacity: 0.7, fontWeight: 700 }}>
                Please wait
              </div>
            </div>
          </div>
        </div>
      );
    }

    // After grace: confirmed not member -> go to login (keeps returnTo)
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function PendingOnboardingGate() {
  const { auth, setOnboardingUsername } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    // If already logged in, do nothing.
    if (auth.accessToken) return;

    // IMPORTANT: Do NOT hijack the user while they are in the registration flow.
    const p = loc.pathname;

    const inRegisterFlow =
      p === "/register" ||
      p === "/register/verify" ||
      p === "/register/set-password" ||
      p === "/login" || // optional: don't hijack login either
      p === "/profile-wizard"; // optional: don't fight wizard routing

    if (inRegisterFlow) return;

    // If the user has a pending username, resume onboarding by sending them to set-password.
    const pending = localStorage.getItem(STORAGE_PENDING_USERNAME);
    if (pending) {
      const u = String(pending).trim().toUpperCase();
      if (!u) return;

      setOnboardingUsername(u);
      nav("/register/set-password", { replace: true });
    }
  }, [auth.accessToken, loc.pathname, nav, setOnboardingUsername]);

  return null;
}

export function UseOnboardingBackOverride() {
  const { routeReason } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    const locked =
      routeReason === "password_required" || routeReason === "profile_incomplete";
    if (!locked) return;

    const onPopState = (e: PopStateEvent) => {
      e.preventDefault?.();
      nav("/register/set-password", { replace: true });
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [routeReason, nav]);

  return null;
}
