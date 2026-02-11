// src/components/LoginModal.tsx
import { useMemo, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;

  // RN parity handlers
  onSubmit(args: {
    username: string;
    password: string;
    rememberDevice: boolean;
  }): Promise<void>;

  onCancel(): void; // Continue as guest
  onCreateAccount(): void;
};

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

export default function LoginModal({
  open,
  onClose,
  onSubmit,
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

  if (!open) return null;

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
        // We rely on caller to throw either auth error or post-login error messages.
        const msg = String(e?.message || "Login failed.");

        // Mirror your Login.tsx semantics:
        // If caller throws "POST_LOGIN_FAILED" or the post-login message, bucket it.
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

      // success: close
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = () => {
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
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          marginTop: 24,
          background: "#fff",
          borderRadius: 16,
          padding: 16,
          border: "1px solid #e6e9ee",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: 16,
              color: "#111827",
              textDecoration: "underline",
            }}
          >
            Sign into your account
          </div>
        </div>

        <input
          placeholder="Staff number"
          value={username}
          onChange={(e) => setUsername((e.target.value || "").toUpperCase())}
          autoCapitalize="characters"
          autoCorrect="off"
          disabled={busy}
          style={{
            width: "100%",
            border: "1px solid #e6e9ee",
            borderRadius: 12,
            padding: "12px 12px",
            marginBottom: 12,
			fontSize: 16,
			lineHeight: "20px",
            background: "#fff",
            boxSizing: "border-box",
          }}
        />

        <div style={{ position: "relative", marginBottom: 12 }}>
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
              border: "1px solid #e6e9ee",
              borderRadius: 12,
              fontSize: 16,	
			  lineHeight: "20px",
              padding: "12px 44px 12px 12px",
              background: "#fff",
              boxSizing: "border-box",
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
              top: 10,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 2,
              color: "#111827",
            }}
          >
            <EyeIcon open={showPassword} />
          </button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
          }}
        >
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={(e) => setRememberDevice(e.target.checked)}
            disabled={busy}
          />
          <div style={{ fontWeight: 800, color: "#111827" }}>
            Remember device
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            width: "100%",
            marginTop: 10,
            padding: "14px 14px",
            borderRadius: 999,
            border: "1px solid #d6e3ff",
            background: "#e9f1ff",
            fontWeight: 900,
            fontSize: 16,
            color: "#111827",
            cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: canSubmit ? 1 : 0.55,
          }}
        >
          {busy ? "…" : "Sign in"}
        </button>

        {authError && (
          <div
            style={{
              marginTop: 10,
              padding: 12,
              border: "1px solid #f0b",
              fontWeight: 800,
            }}
          >
            <strong>Auth error:</strong> {authError}
          </div>
        )}

        {postLoginError && (
          <div
            style={{
              marginTop: 10,
              padding: 12,
              border: "1px solid #fa0",
              fontWeight: 800,
            }}
          >
            <strong>Post-login error:</strong> {postLoginError}
          </div>
        )}

        <button
          type="button"
          onClick={handleCancel}
          disabled={busy}
          style={{
            width: "100%",
            marginTop: 14,
            padding: "6px 0",
            border: "none",
            background: "transparent",
            fontWeight: 800,
            fontSize: 16,
            color: "#111827",
            cursor: "pointer",
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
            marginTop: 6,
            padding: "6px 0",
            border: "none",
            background: "transparent",
            fontWeight: 800,
            fontSize: 16,
            color: "#111827",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          Create account
        </button>
      </div>
    </div>
  );
}
