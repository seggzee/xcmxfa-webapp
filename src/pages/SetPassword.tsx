import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { API_BASE_URL, AUTH_LOGIN_URL, postJson } from "../app/api";
import { STORAGE_PENDING_USERNAME } from "../app/storageKeys";
import { useAuth } from "../app/authStore";
import { useCrew } from "../app/crewStore";

/**
 * Idiot-guide:
 * - Set password (requires verified email)
 * - Then auto-login
 * - Then route to ProfileWizard
 *
 * Polish:
 * - Show truthful errors:
 *   * step 1 failed (set password)
 *   * step 2 failed (login after password set)
 */

const REGISTER_SET_PASSWORD_URL = `${API_BASE_URL}/auth/register/set-password.php`;

function extractStaffIdentity(username: string) {
  const staffIdentity = String(username || "").trim().toUpperCase();
  const m = staffIdentity.match(/(\d+)$/);
  if (!m) throw new Error("Invariant violation: username does not contain a PSN");
  return { staffIdentity, staffNumber: m[1] };
}

type NavState = { username?: string };

type LoginResponse = {
  ok?: boolean;
  accessToken?: string | null;
  refreshToken?: string | null;
  user?: any;
  message?: string;
  error?: string;
};

export default function SetPassword() {
  const nav = useNavigate();
  const loc = useLocation();
  const navState = (loc.state || {}) as NavState;

  const { auth, setAuth, routeReason, setRouteReason, onboardingUsername, setOnboardingUsername } =
    useAuth();
  const { loadCrew } = useCrew();

  const pendingUsername = useMemo(() => {
    return String(localStorage.getItem(STORAGE_PENDING_USERNAME) || "")
      .trim()
      .toUpperCase();
  }, []);

  const initialUsername = useMemo(() => {
    const fromNav = String(navState?.username || "").trim().toUpperCase();
    if (fromNav) return fromNav;

    const fromStore = String(onboardingUsername || "").trim().toUpperCase();
    if (fromStore) return fromStore;

    return pendingUsername;
  }, [navState?.username, onboardingUsername, pendingUsername]);

  const [username, setUsername] = useState(() => initialUsername);
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");

  const [showPass1, setShowPass1] = useState(false);
  const [showPass2, setShowPass2] = useState(false);

  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [waitingForVerification, setWaitingForVerification] = useState(false);

  // New: if password was set but login fails, tell user exactly what to do.
  const [passwordSetButLoginFailed, setPasswordSetButLoginFailed] = useState(false);

  const [bannerReason] = useState(() => (routeReason ? String(routeReason) : ""));
  const [showBanner, setShowBanner] = useState(() => Boolean(routeReason));

  const bannerCopy = useMemo(() => {
    const r = String(bannerReason || "").toLowerCase();
    if (!r) return null;

    if (r === "password_required") {
      return { title: "Secure your account", body: "Please set a password before continuing." };
    }
    if (r === "profile_incomplete") {
      return { title: "A few details missing", body: "Complete your profile to continue." };
    }
    if (r === "resume_onboarding") {
      return { title: "Finish setting up your account", body: "You can continue from where you left off." };
    }
    return null;
  }, [bannerReason]);

  useEffect(() => {
    const u = String(initialUsername || "").trim().toUpperCase();
    if (u && u !== username) setUsername(u);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUsername]);

  const canSubmit = useMemo(() => {
    return username.trim().length > 0 && pass1.length >= 8 && pass1 === pass2 && !busy;
  }, [username, pass1, pass2, busy]);

  const submit = async () => {
    if (!canSubmit) return;

    setErr("");
    setWaitingForVerification(false);
    setPasswordSetButLoginFailed(false);
    setBusy(true);

    const u = username.trim().toUpperCase();

    let step1PasswordSetOk = false;

    try {
      // STEP 1: set password
      const setResp = await postJson<any>(REGISTER_SET_PASSWORD_URL, { username: u, password: pass1 });

      // If backend returns {ok:false}, treat as failure
      if (setResp && typeof setResp === "object" && setResp.ok === false) {
        throw new Error(setResp.message || setResp.error || "Failed to set password.");
      }

      step1PasswordSetOk = true;

      // STEP 2: login
      const loginResp = await postJson<LoginResponse>(AUTH_LOGIN_URL, {
        username: u,
        password: pass1,
        rememberDevice: true,
      });

      if (loginResp && typeof loginResp === "object" && loginResp.ok === false) {
        throw new Error(loginResp.message || loginResp.error || "Login failed.");
      }

      const { staffIdentity, staffNumber } = extractStaffIdentity(u);

      setAuth({
        mode: "member",
        user: {
          ...(loginResp?.user || {}),
          staff_identity: staffIdentity,
          staff_number: staffNumber,
          username: staffIdentity,
        },
        accessToken: loginResp?.accessToken || null,
        refreshToken: loginResp?.refreshToken || null,
      });

      setOnboardingUsername(staffIdentity);
      await loadCrew(staffIdentity);

      nav("/profile-wizard", { replace: true });
    } catch (e: any) {
      const msg = String(e?.message || "");
      const code = String(e?.code || "");
      const status = String(e?.status || e?.statusCode || "");

      // Special case: email not verified (backend may throw/return this)
      if (
        status === "403" ||
        code === "EMAIL_NOT_VERIFIED" ||
        /email\s+not\s+verified/i.test(msg)
      ) {
        setWaitingForVerification(true);
        setErr("");
      } else if (step1PasswordSetOk) {
        // Password set OK, but login failed
        setPasswordSetButLoginFailed(true);
        setErr("Password set, but login failed. Please go to Login and sign in.");
      } else {
        // Step 1 failed
        setErr("Failed to set password. Check your username and try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const onBack = () => {
    setRouteReason(null);
    nav("/home", { replace: true });
  };

  useEffect(() => {
    if (!String(username || "").trim()) {
      nav("/register", { replace: true });
    }
  }, [nav, username]);

  return (
    <div style={{ padding: 24, maxWidth: 520 }}>
      {showBanner && bannerCopy ? (
        <div
          style={{
            border: "1px solid #e6e9ee",
            borderRadius: 14,
            padding: 14,
            marginBottom: 14,
            background: "#fff",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 900 }}>{bannerCopy.title}</div>
              <div style={{ opacity: 0.85, marginTop: 4 }}>{bannerCopy.body}</div>
            </div>
            <button
              onClick={() => setShowBanner(false)}
              style={{ border: "none", background: "transparent", fontWeight: 900, cursor: "pointer" }}
              aria-label="Close banner"
              disabled={busy}
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}

      <h2>Set your password</h2>

      {waitingForVerification ? (
        <div style={{ marginTop: 10, padding: 12, border: "1px solid #f59e0b", borderRadius: 12 }}>
          <strong>Still waiting for email verification.</strong>
          <div style={{ marginTop: 6 }}>
            Please check your inbox and tap the verification link, then try again.
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Username</div>
        <input
          value={username}
          readOnly
          disabled
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#f3f4f6",
            fontWeight: 800,
          }}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Password</div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={pass1}
            onChange={(e) => setPass1(e.target.value)}
            type={showPass1 ? "text" : "password"}
            placeholder="min 8 chars"
            disabled={busy}
            style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
          />
          <button
            type="button"
            onClick={() => setShowPass1((v) => !v)}
            disabled={busy}
            style={{ padding: "0 14px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
          >
            {showPass1 ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Confirm password</div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={pass2}
            onChange={(e) => setPass2(e.target.value)}
            type={showPass2 ? "text" : "password"}
            placeholder="re-enter password"
            disabled={busy}
            style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
          />
          <button
            type="button"
            onClick={() => setShowPass2((v) => !v)}
            disabled={busy}
            style={{ padding: "0 14px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
          >
            {showPass2 ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          style={{
            padding: 14,
            borderRadius: 999,
            border: "1px solid #d6e3ff",
            background: "#e9f1ff",
            fontWeight: 900,
            opacity: canSubmit ? 1 : 0.55,
          }}
        >
          {busy ? "Please wait..." : "Continue"}
        </button>

        {err ? (
          <div style={{ marginTop: 2, color: "#b91c1c", fontWeight: 800, fontSize: 13 }}>
            {err}
          </div>
        ) : null}

        {passwordSetButLoginFailed ? (
          <button
            type="button"
            onClick={() => nav("/login", { replace: true })}
            disabled={busy}
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "#fff",
              fontWeight: 900,
            }}
          >
            Go to Login
          </button>
        ) : null}

        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          style={{
            padding: 10,
            borderRadius: 10,
            background: "transparent",
            fontWeight: 900,
          }}
        >
          Back
        </button>
      </div>

      <div style={{ marginTop: 20, fontSize: 12, opacity: 0.75 }}>
        <div>
          <strong>Note:</strong> pendingUsername is stored so onboarding can resume if you close the browser.
        </div>
        <div>
          Current auth mode: <strong>{auth.mode}</strong>
        </div>
      </div>
    </div>
  );
}
