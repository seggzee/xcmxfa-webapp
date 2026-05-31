// src/pages/ForgotPassword.tsx
//
// PURPOSE:
// - Collect PSN (username)
// - Call requestPasswordReset()
// - Show neutral confirmation state (no enumeration)
//
// RULES:
// - PSN only (KLM/HV format)
// - Always show same success state regardless of backend outcome

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { requestPasswordReset } from "../api/passwordResetApi";

export default function ForgotPassword() {
  const nav = useNavigate();

  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const normalizedUsername = useMemo(
    () => String(username || "").trim().toUpperCase(),
    [username]
  );

  const canSubmit =
    normalizedUsername.length > 0 &&
    !busy &&
    !submitted;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setBusy(true);

    try {
      await requestPasswordReset(normalizedUsername);
    } catch {
      // swallow errors — always go to confirmation state
    } finally {
      setBusy(false);
      setSubmitted(true);
    }
  };

  return (
    <div
      style={{
        maxWidth: 420,
        margin: "0 auto",
        padding: "24px 16px",
      }}
    >
      {!submitted ? (
        <>
          <h2 style={{ marginBottom: 12 }}>Forgot your password?</h2>

          <p style={{ marginBottom: 16, color: "#6b7280" }}>
            Enter your Username in order to receive reset instructions.
          </p>

          <input
            placeholder="Username (e.g. KLM12345)"
            value={username}
            onChange={(e) =>
              setUsername((e.target.value || "").toUpperCase())
            }
            autoCapitalize="characters"
            autoCorrect="off"
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

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              marginTop: 16,				
              width: "100%",
              padding: "14px",
			  fontSize: 14,
              borderRadius: 999,
              border: "1px solid #1d4ed8",
              background: canSubmit ? "#2563eb" : "#dbe7ff",
              color: canSubmit ? "#fff" : "#6b7280",
              fontWeight: 600,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            {busy ? "…" : "Send reset instructions"}
          </button>

          <button
            onClick={() => nav(-1)}
            disabled={busy}
            style={{
              marginTop: 16,
              width: "100%",
			  fontSize: 14,			  
              padding: "12px",
              borderRadius: 999,
              border: "1px solid #d1d5db",
              background: "#f9fafb",
              fontWeight: 600,
              cursor: busy ? "default" : "pointer",
            }}
          >
            Back
          </button>
        </>
      ) : (
        <>
          <h2 style={{ marginBottom: 12 }}>Check your email</h2>

          <p style={{ color: "#6b7280", marginBottom: 16 }}>
            If an account exists for that username, you will receive a password reset link shortly.
          </p>

          <button
            onClick={() => nav("/home")}
            style={{
              width: "100%",
			  fontSize: 14,					  
              padding: "14px",
              borderRadius: 999,
              border: "1px solid #1d4ed8",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Back to app
          </button>
        </>
      )}
    </div>
  );
}