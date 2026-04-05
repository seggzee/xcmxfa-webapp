// src/components/DeleteAccountModal.tsx

import { useMemo, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit(args: {
    confirmText: string;
  }): Promise<void>;
};

function WarningIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3 1.8 20.5c-.38.65.09 1.5.84 1.5h18.72c.75 0 1.22-.85.84-1.5L12 3Zm0 5.5c.55 0 1 .45 1 1v5a1 1 0 1 1-2 0v-5c0-.55.45-1 1-1Zm0 10a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function DeleteAccountModal({
  open,
  onClose,
  onSubmit,
}: Props) {
  const [confirmText, setConfirmText] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(() => {
    return confirmText.trim() === "DELETE" && !busy;
  }, [confirmText, busy]);

  if (!open) return null;

  const handleSubmit = async () => {
    setErrorText(null);

    if (confirmText.trim() !== "DELETE") {
      setErrorText('Please type DELETE exactly to confirm.');
      return;
    }

    setBusy(true);
    try {
      await onSubmit({ confirmText });
      setConfirmText("");
      onClose();
    } catch (e: any) {
      setErrorText(String(e?.message || "Failed to delete account."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Delete account"
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
            color: "#dc2626",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 999,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <WarningIcon />
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
            Delete account
          </div>
        </div>

        <div
          style={{
            fontWeight: 700,
            fontSize: 14,
            lineHeight: "20px",
            color: "rgba(19,35,51,0.88)",
          }}
        >
          This will permanently delete your member account for privacy reasons.
        </div>

        <div
          style={{
            marginTop: 8,
            fontWeight: 700,
            fontSize: 13,
            lineHeight: "18px",
            color: "rgba(19,35,51,0.60)",
          }}
        >
          Type <strong>DELETE</strong> below to confirm.
        </div>

        <input
          placeholder="Type DELETE"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          autoCapitalize="characters"
          autoCorrect="off"
          disabled={busy}
          style={{
            width: "100%",
            border: "1px solid #d8dee8",
            borderRadius: 14,
            padding: "14px 14px",
            marginTop: 14,
            fontSize: 16,
            lineHeight: "20px",
            background: "#fff",
            boxSizing: "border-box",
            color: "#111827",
          }}
        />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            width: "100%",
            marginTop: 14,
            padding: "15px 16px",
            borderRadius: 999,
            border: "1px solid rgba(220,38,38,0.30)",
            background: canSubmit ? "rgba(220,38,38,0.10)" : "#f5f5f5",
            fontWeight: 800,
            fontSize: 17,
            lineHeight: "22px",
            color: canSubmit ? "#7f1d1d" : "#6b7280",
            cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: 1,
          }}
        >
          {busy ? "…" : "Delete my account"}
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