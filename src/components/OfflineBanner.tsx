import useOnlineStatus from "../hooks/useOnlineStatus";

/**
 * PURPOSE
 * src/components/OfflineBanner.tsx
 * - Global app-shell connectivity banner
 *
 * PHASE 0 CONTRACT
 * - Show ONLY when browser is offline
 * - Keep it compact and non-blocking
 * - Do NOT imply any offline data availability
 */
export default function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "sticky",
        top: "var(--appheader-height, 84px)",
        zIndex: 45,
        background: "#fff7ed",
        borderBottom: "1px solid rgba(154, 52, 18, 0.18)",
        color: "#9a3412",
        padding: "10px 16px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontWeight: 800,
          fontSize: 14,
          lineHeight: 1.2,
          marginBottom: 2,
        }}
      >
        You&apos;re offline
      </div>

      <div
        style={{
          fontSize: 12,
          lineHeight: 1.2,
          opacity: 0.9,
        }}
      >
        Live data unavailable
      </div>
    </div>
  );
}