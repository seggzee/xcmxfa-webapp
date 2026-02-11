
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";

import AppHeader from "../components/AppHeader";

import { RequireMember } from "./guards";
import { useAuth } from "./authStore";
import { useCrew } from "./crewStore";
import { AUTH_LOGIN_URL, postJson } from "./api";

// Pages
import Debug from "../pages/Debug";
import Splash from "../pages/Splash";

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

/**
 * Idiot-guide: what does auth/login return?
 * -----------------------------------------
 * Copied from pages/Login.tsx (loose shape)
 */
type LoginResponse = {
  accessToken?: string | null;
  refreshToken?: string | null;
  user?: any;
};

export default function AppRoutes() {
  const nav = useNavigate();

  const {
    auth,
    setAuth,
    setRouteReason,
    setOnboardingUsername,
    loginReturnTo,
    resetToGuestState,
  } = useAuth();

  const { loadCrew } = useCrew();

  return (
    <>
      {/* ONE global header (RN AppRoot parity) */}
      <AppHeader
        auth={auth}
        onGoHome={() => nav("/home")}
        onGoProfile={() => nav("/profile")}
        onLogout={() => {
          // Web: local reset (server logout can be added later if/when you have it)
          resetToGuestState();
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
          // === COPIED LOGIC FROM pages/Login.tsx onSubmit() (phase 1 + phase 2) ===

          // Basic empty checks (RN does similar "required" checks)
          if (!String(username).trim()) {
            throw new Error("Please enter your username / staff identity.");
          }
          if (!String(password).trim()) {
            throw new Error("Please enter your password.");
          }

          // --------------------------------------------
          // Phase 1: AUTH
          // --------------------------------------------
          const { staffIdentity, staffNumber } = extractStaffIdentity(username);

          const resp = await postJson<LoginResponse>(AUTH_LOGIN_URL, {
            username: staffIdentity,
            password,
            rememberDevice: !!rememberDevice,
          });

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

          const token = resp?.accessToken || "";
          if (!token) {
            throw new Error("LOGIN_NO_ACCESS_TOKEN");
          }

          const bearer: Record<string, string> = token
		  ? { Authorization: `Bearer ${token}` }
		  : {};

          // --------------------------------------------
          // Phase 2: POST-LOGIN checks (copied routing table)
          // --------------------------------------------
          try {
            const { CREW_EXISTS_URL, MEMBERS_STATUS_URL } = await import("./api");

            const existsResp = await postJson<any>(
              CREW_EXISTS_URL,
              { psn: staffIdentity },
              bearer,
            );

            const exists = Boolean(existsResp?.exists);

            if (exists) {
              const statusResp = await postJson<any>(
                MEMBERS_STATUS_URL,
                { psn: staffIdentity },
                bearer,
              );

              const next = String(statusResp?.next_step || "")
                .trim()
                .toLowerCase();

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
            // MARKED post-login failure (RN parity)
            throw new Error(
              "Login succeeded, but the post-login checks failed (network/server). Please try again.",
            );
          }
        }}
      />

      {/* Route table */}
      <Routes>
        {/* Guest / entry */}
        <Route path="/" element={<Splash />} />
        <Route path="/login" element={<Navigate to="/home?login=1" replace />} />    ///login still exists, but it no longer renders a page.
        <Route path="/debug" element={<Debug />} />

        {/* Registration/onboarding */}
        <Route path="/register" element={<Register />} />
        <Route path="/register/verify" element={<RegisterVerify />} />
        <Route path="/register/set-password" element={<SetPassword />} />
        <Route path="/profile-wizard" element={<ProfileWizard />} />

        {/* App routes */}
        <Route path="/selectairports" element={<SelectAirports />} />
        <Route path="/home" element={<Home />} />
        <Route path="/week" element={<Week />} />
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
          path="/profile"
          element={
            <RequireMember>
              <Profile />
            </RequireMember>
          }
        />
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
