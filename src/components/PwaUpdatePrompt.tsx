type PwaUpdatePromptProps = {
  showUpdatePrompt?: boolean;
  onConfirmReload?: () => void;
  onDismissReloadPrompt?: () => void;
  showOfflineReadyPrompt?: boolean;
  onDismissOfflineReady?: () => void;
};

/**
 * PURPOSE
 * - App-shell prompt for PWA lifecycle events
 *
 * src/components/PwaUpdatePrompt.tsx
 *
 * SUPPORTED STATES
 * 1. New version available
 *    - user can choose Reload or Later
 * 2. Offline ready
 *    - informational only
 *
 * IMPORTANT
 * - This is global UI
 * - It is intentionally compact and non-blocking
 * - It does NOT auto-reload the app
 */
export default function PwaUpdatePrompt({
  showUpdatePrompt = false,
  onConfirmReload,
  onDismissReloadPrompt,
  showOfflineReadyPrompt = false,
  onDismissOfflineReady,
}: PwaUpdatePromptProps) {
  const visible = showUpdatePrompt || showOfflineReadyPrompt;

  if (!visible) {
    return null;
  }

  const isUpdatePrompt = showUpdatePrompt;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-live="polite"
      style={{
        position: "fixed",
        right: 16,
        left: 16,
        bottom: 16,
        zIndex: 3000,
        maxWidth: 560,
        margin: "0 auto",
        background: "#ffffff",
        color: "#132333",
        borderRadius: 16,
        boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
        border: "1px solid rgba(19,35,51,0.10)",
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          fontWeight: 900,
          fontSize: 15,
          lineHeight: 1.2,
          marginBottom: 6,
        }}
      >
        {isUpdatePrompt ? "App update available" : "Offline support ready"}
      </div>

      <div
        style={{
          fontSize: 14,
          lineHeight: 1.35,
          color: "rgba(19,35,51,0.75)",
        }}
      >
        {isUpdatePrompt
          ? "A newer version of the app is ready. Reload to update now."
          : "This app is now ready to work offline for supported shell content."}
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 14,
          flexWrap: "wrap",
        }}
      >
        {isUpdatePrompt ? (
          <>
            <button
              type="button"
              onClick={onConfirmReload}
              style={{
                border: 0,
                borderRadius: 10,
                padding: "10px 14px",
                cursor: "pointer",
                fontWeight: 800,
                background: "#132333",
                color: "#ffffff",
              }}
            >
              Reload
            </button>

            <button
              type="button"
              onClick={onDismissReloadPrompt}
              style={{
                borderRadius: 10,
                padding: "10px 14px",
                cursor: "pointer",
                fontWeight: 800,
                background: "transparent",
                color: "#132333",
                border: "1px solid rgba(19,35,51,0.14)",
              }}
            >
              Later
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onDismissOfflineReady}
            style={{
              border: 0,
              borderRadius: 10,
              padding: "10px 14px",
              cursor: "pointer",
              fontWeight: 800,
              background: "#132333",
              color: "#ffffff",
            }}
          >
            OK
          </button>
        )}
      </div>
    </div>
  );
}