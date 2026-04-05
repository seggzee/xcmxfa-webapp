// src/pages/ResetPassword.tsx
//
// PURPOSE:
// - Accept token from query string
// - Allow user to set new password
// - Call confirmPasswordReset()
// - Handle success + basic error states
//
// RULES:
// - Token comes from ?token=...
// - Minimum password length = 8 (aligned with backend)
// - On success → route back to login entry

import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { confirmPasswordReset } from "../api/passwordResetApi";

export default function ResetPassword() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();

  const token = useMemo(() => {
    return String(searchParams.get("token") || "").trim();
  }, [searchParams]);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit =
    token.length > 0 &&
    password.length >= 8 &&
    password === confirm &&
    !busy &&
    !done;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setError(null);
    setBusy(true);

    try {
      const resp = await confirmPasswordReset(token, password);

      if (!resp?.ok) {
        setError(
          resp?.message ||
            "This reset link is invalid or has expired. Please request a new one."
        );
        return;
      }

      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "24px 16px" }}>
        <h2 style={{ marginBottom: 12 }}>Invalid link</h2>
        <p style={{ color: "#6b7280", marginBottom: 16 }}>
          This reset link is invalid or incomplete.
        </p>

        <button
          onClick={() => nav("/forgot-password")}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 999,
            border: "1px solid #1d4ed8",
            background: "#2563eb",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Request new link
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 420,
        margin: "0 auto",
        padding: "24px 16px",
      }}
    >
      {!done ? (
        <>
          <h2 style={{ marginBottom: 12 }}>Set a new password</h2>

          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            style={{
              width: "100%",
              border: "1px solid #d8dee8",
              borderRadius: 12,
              padding: "14px",
              marginBottom: 12,
              fontSize: 16,
              boxSizing: "border-box",
            }}
          />

          <input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={busy}
            style={{
              width: "100%",
              border: "1px solid #d8dee8",
              borderRadius: 12,
              padding: "14px",
              marginBottom: 16,
              fontSize: 16,
              boxSizing: "border-box",
            }}
          />

          {password !== confirm && confirm.length > 0 && (
            <div style={{ marginBottom: 12, color: "#b91c1c", fontWeight: 600 }}>
              Passwords do not match
            </div>
          )}

          {error && (
            <div
              style={{
                marginBottom: 12,
                padding: 12,
                border: "1px solid #f87171",
                borderRadius: 12,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 999,
              border: "1px solid #1d4ed8",
              background: canSubmit ? "#2563eb" : "#dbe7ff",
              color: canSubmit ? "#fff" : "#6b7280",
              fontWeight: 700,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            {busy ? "…" : "Reset password"}
          </button>
        </>
      ) : (
        <>
          <h2 style={{ marginBottom: 12 }}>Password updated</h2>

          <p style={{ color: "#6b7280", marginBottom: 16 }}>
            Your password has been successfully updated. Please sign in again.
          </p>

          <button
            onClick={() => nav("/home?login=1")}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 999,
              border: "1px solid #1d4ed8",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Go to login
          </button>
        </>
      )}
    </div>
  );
}