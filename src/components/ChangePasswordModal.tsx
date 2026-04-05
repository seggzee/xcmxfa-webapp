//   src/components/ChangePasswordModal.tsx

import { useMemo, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit(args: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<void>;
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

function KeyIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M14 3a7 7 0 0 0-5.65 11.13L3 19.5V22h2.5l1.38-1.38H9v-2.12h2.12l1.75-1.75A7 7 0 1 0 14 3Zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function ChangePasswordModal({
  open,
  onClose,
  onSubmit,
}: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [errorText, setErrorText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(() => {
    return (
      currentPassword.trim().length > 0 &&
      newPassword.trim().length >= 8 &&
      confirmPassword.trim().length > 0 &&
      !busy
    );
  }, [currentPassword, newPassword, confirmPassword, busy]);

  if (!open) return null;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid #d8dee8",
    borderRadius: 14,
    fontSize: 16,
    lineHeight: "20px",
    padding: "14px 48px 14px 14px",
    background: "#fff",
    boxSizing: "border-box",
    color: "#111827",
  };

  const eyeBtnStyle: React.CSSProperties = {
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
  };

  const handleSubmit = async () => {
    setErrorText(null);

    if (!currentPassword.trim()) {
      setErrorText("Please enter your current password.");
      return;
    }
    if (!newPassword.trim()) {
      setErrorText("Please enter a new password.");
      return;
    }
    if (newPassword.trim().length < 8) {
      setErrorText("New password must be at least 8 characters.");
      return;
    }
    if (!confirmPassword.trim()) {
      setErrorText("Please confirm your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorText("New password and confirmation do not match.");
      return;
    }

    setBusy(true);
    try {
      await onSubmit({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onClose();
      window.alert("Password changed successfully.");
    } catch (e: any) {
      setErrorText(String(e?.message || "Failed to change password."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Change password"
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
            <KeyIcon />
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
            Change password
          </div>
        </div>

        <div style={{ position: "relative", marginBottom: 12 }}>
          <input
            placeholder="Current password"
            type={showCurrent ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            disabled={busy}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            disabled={busy}
            aria-label={showCurrent ? "Hide current password" : "Show current password"}
            style={eyeBtnStyle}
          >
            <EyeIcon open={showCurrent} />
          </button>
        </div>

        <div style={{ position: "relative", marginBottom: 12 }}>
          <input
            placeholder="New password"
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            disabled={busy}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            disabled={busy}
            aria-label={showNew ? "Hide new password" : "Show new password"}
            style={eyeBtnStyle}
          >
            <EyeIcon open={showNew} />
          </button>
        </div>

        <div style={{ position: "relative", marginBottom: 8 }}>
          <input
            placeholder="Confirm new password"
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            disabled={busy}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            disabled={busy}
            aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
            style={eyeBtnStyle}
          >
            <EyeIcon open={showConfirm} />
          </button>
        </div>

        <div
          style={{
            marginBottom: 14,
            fontSize: 13,
            fontWeight: 600,
            lineHeight: "18px",
            color: "rgba(19,35,51,0.60)",
          }}
        >
          New password must be at least 8 characters long.
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            width: "100%",
            padding: "15px 16px",
            borderRadius: 999,
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
          {busy ? "…" : "Save password"}
        </button>

        {errorText && (
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
            <strong>Error:</strong> {errorText}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "14px 16px",
            borderRadius: 999,
            border: "1px solid #d1d5db",
            background: "#f9fafb",
            fontWeight: 700,
            fontSize: 16,
            lineHeight: "20px",
            color: "#111827",
            cursor: busy ? "default" : "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}