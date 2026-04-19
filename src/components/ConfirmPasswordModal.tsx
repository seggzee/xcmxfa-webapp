import React, { useMemo, useState } from "react";

type Props = {
  open: boolean;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onCancel: () => void;
  onSubmit: (args: { password: string }) => Promise<void> | void;
};

export default function ConfirmPasswordModal({
  open,
  busy = false,
  error = null,
  onClose,
  onCancel,
  onSubmit,
}: Props) {
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return password.trim().length > 0 && !busy;
  }, [password, busy]);

  if (!open) return null;

  const handleCancel = () => {
    if (busy) return;
    setPassword("");
    setLocalError(null);
    onCancel();
  };

  const handleSubmit = async () => {
    setLocalError(null);

    if (!password.trim()) {
      setLocalError("Please enter your current password.");
      return;
    }

    await onSubmit({ password });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirm your password"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) {
          setPassword("");
          setLocalError(null);
          onClose();
        }
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
            fontWeight: 800,
            fontSize: 20,
            lineHeight: "28px",
            color: "#111827",
            marginBottom: 8,
            textAlign: "center",
          }}
        >
          Confirm your password
        </div>

        <div
          style={{
            fontSize: 14,
            lineHeight: "20px",
            color: "#4b5563",
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          Your current password is required to set up a passkey on this device
        </div>

        <input
          type="password"
          placeholder="Current password"
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
            padding: "14px 14px",
            background: "#fff",
            boxSizing: "border-box",
            color: "#111827",
          }}
        />

        {(localError || error) && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              border: "1px solid #f0b",
              borderRadius: 12,
              fontWeight: 700,
              color: "#111827",
            }}
          >
            {localError || error}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginTop: 18,
          }}
        >
          <button
            type="button"
            onClick={handleCancel}
            disabled={busy}
            style={{
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

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 999,
              border: "1px solid #1d4ed8",
              background: canSubmit ? "#2563eb" : "#dbe7ff",
              fontWeight: 800,
              fontSize: 16,
              lineHeight: "20px",
              color: canSubmit ? "#ffffff" : "#6b7280",
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            {busy ? "…" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}