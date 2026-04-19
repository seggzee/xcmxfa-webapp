// src/components/LoginModal.tsx
//
// =====================================================================================
// LOGIN MODAL
// =====================================================================================
//
// PHASE-1 PASSKEY SUPPORT
// - Password login remains the primary/default flow.
// - Passkey login is OPTIONAL.
// - If onPasskeyLogin is supplied, show a secondary "Sign in with a passkey" button.
// - Username hint is optional for passkey login:
//     * if user has typed username, pass it through
//     * if blank, allow username-less passkey flow
//
// IMPORTANT
// - This modal still owns only UI + local validation/error handling.
// - It does NOT talk directly to backend APIs.
// - Password submit uses onSubmit(...)
// - Passkey submit uses onPasskeyLogin(...)
//
// =====================================================================================

import { useMemo, useState } from "react";
import { UI_ICONS } from "../assets";

type Props = {
  open: boolean;
  onClose: () => void;

  onForgotPassword(): void;

  // RN parity handlers
  onSubmit(args: {
    username: string;
    password: string;
    rememberDevice: boolean;
  }): Promise<void>;

  // PHASE-1 PASSKEY LOGIN
  onPasskeyLogin?(args: {
    usernameHint?: string;
    rememberDevice?: boolean;
    deviceId?: string;
  }): Promise<void>;

  onCancel(): void; // Continue as guest
  onCreateAccount(): void;
};



{/*
function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z"
        fill="currentColor"
      />
      <path
        d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
        fill="currentColor"
      />
    </svg>
  ) : (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M2 5.27 3.28 4 20 20.72 18.73 22l-2.35-2.35A11.7 11.7 0 0 1 12 21C5 21 2 14 2 14a17.4 17.4 0 0 1 4.1-5.1L2 5.27Zm10 13.73c.9 0 1.76-.18 2.56-.5l-1.63-1.63c-.3.08-.61.13-.93.13a3 3 0 0 1-3-3c0-.32.05-.63.13-.93L7.5 11.44A5 5 0 0 0 12 19Zm10-5s-1.04 2.43-3.37 4.57l-1.45-1.45A11.5 11.5 0 0 0 19.9 14S17 7 10 7c-.52 0-1.02.04-1.5.12L6.9 5.52C7.86 5.18 8.9 5 10 5c7 0 12 9 12 9Z"
        fill="currentColor"
      />
    </svg>
  );
}
*/}



function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <img
      src={UI_ICONS.eyes_open}
      alt=""
      aria-hidden="true"
      style={{ width: 25, height: 25, objectFit: "contain", display: "block" }}
    />
  ) : (
    <img
      src={UI_ICONS.eyes_closed}
      alt=""
      aria-hidden="true"
      style={{ width: 25, height: 25, objectFit: "contain", display: "block" }}
    />
  );
}

function LoginIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PasskeyIcon() {
  return (
    <img
      src={UI_ICONS.passkey}
      alt=""
      aria-hidden="true"
      style={{ width: 25, height: 25, objectFit: "contain", display: "block", marginRight: 20 }}
    />
  );
}

export default function LoginModal({
  open,
  onClose,
  onSubmit,
  onPasskeyLogin,
  onForgotPassword,
  onCancel,
  onCreateAccount,
}: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // RN parity: rememberDevice toggle, default true
  const [rememberDevice, setRememberDevice] = useState(true);

  const [showPassword, setShowPassword] = useState(false);

  // Separate error buckets like Login.tsx
  const [authError, setAuthError] = useState<string | null>(null);
  const [postLoginError, setPostLoginError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  const normalizedUsername = useMemo(
    () => String(username || "").trim().toUpperCase(),
    [username],
  );

  const canSubmit =
    normalizedUsername.length > 0 && password.trim().length > 0 && !busy;

  const canUsePasskey = Boolean(onPasskeyLogin) && !busy;

  if (!open) return null;

  const handleForgotPassword = () => {
    onClose();
    onForgotPassword();
  };

  const handleSubmit = async () => {
    setAuthError(null);
    setPostLoginError(null);

    setBusy(true);
    try {
      if (!String(username).trim()) {
        setAuthError("Please enter your username / staff identity.");
        return;
      }
      if (!String(password).trim()) {
        setAuthError("Please enter your password.");
        return;
      }

      try {
        await onSubmit({
          username: normalizedUsername,
          password,
          rememberDevice,
        });
      } catch (e: any) {
        const msg = String(e?.message || "Login failed.");

        if (
          msg.includes("post-login checks failed") ||
          msg.includes("POST_LOGIN_FAILED")
        ) {
          setPostLoginError(
            "Login succeeded, but the post-login checks failed (network/server). Please try again.",
          );
        } else {
          setAuthError(msg);
        }
        return;
      }

      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handlePasskeyLogin = async () => {
    if (!onPasskeyLogin) return;

    setAuthError(null);
    setPostLoginError(null);

    setBusy(true);
    try {
      try {
        await onPasskeyLogin({
          usernameHint: normalizedUsername || undefined,
          rememberDevice,
        });
      } catch (e: any) {
        const msg = String(e?.message || "Passkey sign-in failed.");
        setAuthError(msg);
        return;
      }

      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleContinueAsGuest = () => {
    onClose();
    onCancel();
  };

  const handleCreateAccount = () => {
    onClose();
    onCreateAccount();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Login"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(17,24,39,0.35)",
        padding: 16,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        zIndex: 9999,
        overflowY: "auto",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          marginTop: 48,
          background: "#fff",
          borderRadius: 18,
          padding: 20,
          border: "1px solid #e6e9ee",
          boxShadow: "0 10px 30px rgba(17,24,39,0.10)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 10,
            color: "#2563eb",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 999,
              background: "#eff6ff",
              border: "1px solid #dbeafe",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LoginIcon />
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: 20,
              lineHeight: "28px",
              color: "#111827",
            }}
          >
            Sign into your account
          </div>
        </div>

        <input
          placeholder="Username (e.g. KLM12345)"
          value={username}
          onChange={(e) => setUsername((e.target.value || "").toUpperCase())}
          autoCapitalize="characters"
          autoCorrect="off"
          disabled={busy}
          style={{
            width: "100%",
            border: "1px solid #d8dee8",
            borderRadius: 14,
            padding: "14px 14px",
            marginBottom: 12,
            fontSize: 16,
            lineHeight: "20px",
            background: "#fff",
            boxSizing: "border-box",
            color: "#111827",
          }}
        />

        <div style={{ position: "relative", marginBottom: 8 }}>
          <input
            placeholder="Password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            disabled={busy}
            style={{
              width: "100%",
              border: "1px solid #d8dee8",
              borderRadius: 14,
              fontSize: 16,
              lineHeight: "20px",
              padding: "14px 48px 14px 14px",
              background: "#fff",
              boxSizing: "border-box",
              color: "#111827",
            }}
          />

          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            disabled={busy}
            aria-label={showPassword ? "Hide password" : "Show password"}
            style={{
              position: "absolute",
              right: 14,
              top: "50%",
              transform: "translateY(-50%)",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 2,
              color: "#111827",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <EyeIcon open={showPassword} />
          </button>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 14,
          }}
        >
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={busy}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              margin: 0,
              color: "#2563eb",
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "underline",
              cursor: busy ? "default" : "pointer",
            }}
          >
            Forgotten password
          </button>
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 16,
            cursor: busy ? "default" : "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={(e) => setRememberDevice(e.target.checked)}
            disabled={busy}
            style={{
              width: 18,
              height: 18,
              margin: 0,
              flex: "0 0 auto",
            }}
          />
          <span
            style={{
              fontWeight: 600,
              fontSize: 14,
              lineHeight: "20px",
              color: "#374151",
            }}
          >
            Remember this device
          </span>
        </label>

        <div style={{ display: "grid", gap: 10 }}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              width: "100%",
              marginTop: 0,
              padding: "15px 16px",
              borderRadius: 20,
              border: "1px solid #1d4ed8",
              background: canSubmit ? "#2563eb" : "#dbe7ff",
              fontWeight: 800,
              fontSize: 17,
              lineHeight: "22px",
              color: canSubmit ? "#ffffff" : "#6b7280",
              cursor: canSubmit ? "pointer" : "not-allowed",
              opacity: 1,
            }}
          >
            {busy ? "…" : "Sign in"}
          </button>

          {onPasskeyLogin ? (
            <button
              type="button"
              onClick={handlePasskeyLogin}
              disabled={!canUsePasskey}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 20,
                border: "1px solid #d1d5db",
                background: "#f9fafb",
                fontWeight: 800,
                fontSize: 16,
                lineHeight: "20px",
                color: "#111827",
                cursor: canUsePasskey ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <PasskeyIcon />
              <span>{busy ? "…" : "Sign in with a passkey"}</span>
            </button>
          ) : null}
        </div>

        {authError && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              border: "1px solid #f0b",
              borderRadius: 12,
              fontWeight: 800,
              color: "#111827",
            }}
          >
            <strong>Auth error:</strong> {authError}
          </div>
        )}

        {postLoginError && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              border: "1px solid #fa0",
              borderRadius: 12,
              fontWeight: 800,
              color: "#111827",
            }}
          >
            <strong>Post-login error:</strong> {postLoginError}
          </div>
        )}

        <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
          <button
            type="button"
            onClick={handleContinueAsGuest}
            disabled={busy}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 20,
              border: "1px solid #d1d5db",
              background: "#f9fafb",
              fontWeight: 700,
              fontSize: 16,
              lineHeight: "20px",
              color: "#111827",
              cursor: busy ? "default" : "pointer",
            }}
          >
            Continue as guest
          </button>

          <button
            type="button"
            onClick={handleCreateAccount}
            disabled={busy}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 20,
              border: "1px solid #dbeafe",
              background: "#eff6ff",
              fontWeight: 700,
              fontSize: 16,
              lineHeight: "20px",
              color: "#1d4ed8",
              cursor: busy ? "default" : "pointer",
            }}
          >
            New user registration
          </button>
        </div>
      </div>
    </div>
  );
}