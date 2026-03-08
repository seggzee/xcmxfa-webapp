// src/components/PopupNoticeHost.tsx

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../app/authStore";
import { dismissPopupMessage, getActivePopupMessage } from "../api/messagesApi";

type PopupMessage = {
  id: string;
  title: string;
  body: string;
  severity?: "info" | "success" | "warning" | "critical";
  link_type?: "internal_route" | "external_url" | "none";
  link_target?: string | null;
  link_fallback?: string | null;
  dismiss_text?: string | null;
  action_text?: string | null;
};

function openExternal(url: string) {
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    // silent
  }
}

export default function PopupNoticeHost() {
  const nav = useNavigate();
  const { auth } = useAuth();

  const isMember = auth?.mode === "member";

  const [popup, setPopup] = useState<PopupMessage | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!isMember) {
        setPopup(null);
        return;
      }

      try {
        const resp: any = await getActivePopupMessage();
        if (!alive) return;

        const row = resp?.popup ?? null;
        setPopup(row || null);
      } catch {
        if (!alive) return;
        setPopup(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isMember]);

  const closePopup = async () => {
    if (!popup || busy) return;

    setBusy(true);
    try {
      await dismissPopupMessage(Number(popup.id));
    } catch {
      // silent
    } finally {
      setBusy(false);
      setPopup(null);
    }
  };

  const handleAction = async () => {
    if (!popup || busy) return;

    const linkType = popup.link_type || "none";
    const target = String(popup.link_target || "").trim();
    const fallback = String(popup.link_fallback || "").trim();

    setBusy(true);
    try {
      await dismissPopupMessage(Number(popup.id));
    } catch {
      // silent
    } finally {
      setBusy(false);
      setPopup(null);
    }

    if (linkType === "internal_route") {
      if (target) {
        nav(target);
        return;
      }
      if (fallback) {
        nav(fallback);
        return;
      }
      return;
    }

    if (linkType === "external_url") {
      if (target) {
        openExternal(target);
        return;
      }
      if (fallback) {
        openExternal(fallback);
        return;
      }
    }
  };

  if (!isMember || !popup) return null;

  const dismissText = String(popup.dismiss_text || "Dismiss");
  const actionText = String(popup.action_text || "View");
  const hasAction =
    popup.link_type === "internal_route" || popup.link_type === "external_url";

  const accent =
    popup.severity === "critical"
      ? "#b91c1c"
      : popup.severity === "warning"
      ? "#b45309"
      : popup.severity === "success"
      ? "#166534"
      : "#111827";

  const border =
    popup.severity === "critical"
      ? "#fecaca"
      : popup.severity === "warning"
      ? "#fde68a"
      : popup.severity === "success"
      ? "#bbf7d0"
      : "#e6e9ee";

  const background =
    popup.severity === "critical"
      ? "#fff7f7"
      : popup.severity === "warning"
      ? "#fffaf0"
      : popup.severity === "success"
      ? "#f6fff8"
      : "#ffffff";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Notice"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          void closePopup();
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
        zIndex: 9998,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          marginTop: 24,
          background,
          borderRadius: 16,
          padding: 16,
          border: `1px solid ${border}`,
          boxSizing: "border-box",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div
            style={{
              fontWeight: 900,
              fontSize: 16,
              color: accent,
              lineHeight: "20px",
            }}
          >
            {popup.title}
          </div>

          <button
            type="button"
            onClick={() => void closePopup()}
            disabled={busy}
            aria-label="Close notice"
            style={{
              border: "none",
              background: "transparent",
              fontWeight: 900,
              fontSize: 18,
              lineHeight: "18px",
              cursor: busy ? "default" : "pointer",
              color: "#111827",
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            marginTop: 10,
            color: "#111827",
            lineHeight: "20px",
            whiteSpace: "pre-wrap",
          }}
        >
          {popup.body}
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          {hasAction ? (
            <button
              type="button"
              onClick={() => void handleAction()}
              disabled={busy}
              style={{
                width: "100%",
                padding: "14px 14px",
                borderRadius: 999,
                border: "1px solid #d6e3ff",
                background: "#e9f1ff",
                fontWeight: 900,
                fontSize: 16,
                color: "#111827",
                cursor: busy ? "default" : "pointer",
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? "…" : actionText}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => void closePopup()}
            disabled={busy}
            style={{
              width: "100%",
              padding: "6px 0",
              border: "none",
              background: "transparent",
              fontWeight: 800,
              fontSize: 16,
              color: "#111827",
              cursor: busy ? "default" : "pointer",
            }}
          >
            {dismissText}
          </button>
        </div>
      </div>
    </div>
  );
}