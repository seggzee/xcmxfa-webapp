import React, { useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./authStore";
import { STORAGE_PENDING_USERNAME } from "./storageKeys";

/**
 * Idiot-guide:
 * This file holds router "guards".
 *
 * The important bug you saw:
 * - We store pendingUsername during /register
 * - PendingOnboardingGate sees pendingUsername and auto-routes to /register/set-password
 * - This accidentally skips /register/verify
 *
 * Fix:
 * - Never auto-redirect while already inside the registration flow.
 * - Auto-resume is only for: user returns later and lands on /home or other routes.
 */

export function RequireMember({ children }: { children: React.ReactNode }) {
  const { auth, setLoginReturnTo } = useAuth();
  const loc = useLocation();

  if (auth.mode !== "member") {
    setLoginReturnTo(loc.pathname + loc.search);
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
