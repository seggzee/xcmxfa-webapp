//
// src/components/AppHeader.tsx
//
// =====================================================================================
// ASSET LOADING FIX (NO VITE MAGIC): AppHeader assets must NOT use "/assets/..."
// =====================================================================================
//
// NOTE (V2 HEADER LOGO):
// - We now use one rectangular header logo that already includes the text.
// - We keep legacy APP_LOGO for other areas / legacy app usage.
// - AppHeader uses APP_IMAGES.HEADER_LOGO only.
//
// MESSAGE BELL CONTRACT:
// - Bell is shown ONLY for logged-in members who currently have any messages.
// - Red badge is shown ONLY when unreadMessageCount > 0.
// - Bell click routes to /messages (or uses onGoMessages if supplied).
//
// =====================================================================================

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { APP_IMAGES, UI_ICONS } from "../assets";
import LoginModal from "./LoginModal";
import AccountMenuModal from "./AccountMenuModal";

type Props = {
  auth: any;

  title?: string;
  subtitle?: string;

  onGoHome?: () => void;
  onGoProfile?: () => void;
  onGoMessages?: () => void;
  onLogout?: () => void;

  // Message summary props passed from the global app route/layout level.
  unreadMessageCount?: number;
  hasAnyMessages?: boolean;

  onLoginSubmit?: (args: {
    username: string;
    password: string;
    rememberDevice: boolean;
  }) => Promise<void>;

  onCancelLogin?: () => void;
  onCreateAccount?: () => void;

  // ADDED
  onForgotPassword?: () => void;
};

function BellIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 3a5 5 0 0 0-5 5v2.17c0 .7-.24 1.38-.68 1.92L4.7 14.08A1 1 0 0 0 5.47 15h13.06a1 1 0 0 0 .77-1.62l-1.62-1.99A3 3 0 0 1 17 10.17V8a5 5 0 0 0-5-5Z"
        fill="currentColor"
      />
      <path
        d="M9.5 17a2.5 2.5 0 0 0 5 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function AppHeader({
  auth,
  onGoHome,
  onGoProfile,
  onGoMessages,
  onLogout,
  unreadMessageCount = 0,
  hasAnyMessages = false,
  onLoginSubmit,
  onCancelLogin,
  onCreateAccount,
  onForgotPassword,
}: Props) {
  const isLoggedIn = auth?.mode === "member";

  const showMessageBell = isLoggedIn && hasAnyMessages;
  const showUnreadBadge = isLoggedIn && unreadMessageCount > 0;

  const [accountOpen, setAccountOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const root = document.documentElement;

    const apply = () => {
      const h = Math.ceil(el.getBoundingClientRect().height || 0);
      if (h > 0) root.style.setProperty("--appheader-height", `${h}px`);
    };

    apply();

    let ro: ResizeObserver | null = null;

    try {
      ro = new ResizeObserver(() => apply());
      ro.observe(el);
    } catch {}

    window.addEventListener("resize", apply);

    return () => {
      window.removeEventListener("resize", apply);
      if (ro) ro.disconnect();
    };
  }, []);

  const handleAvatarClick = () => {
    if (!isLoggedIn) {
      setAccountOpen(false);
      setLoginOpen(true);
      return;
    }

    setLoginOpen(false);
    setAccountOpen(true);
  };

  const loginHandlersOk = Boolean(
    onLoginSubmit && onCancelLogin && onCreateAccount && onForgotPassword
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const wantsLogin = params.get("login") === "1";

    if (!wantsLogin) return;

    if (!isLoggedIn) setLoginOpen(true);

    params.delete("login");
    const nextSearch = params.toString();

    navigate(
      { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : "" },
      { replace: true }
    );
  }, [location.search, location.pathname, navigate, isLoggedIn]);

  return (
    <>
      <header ref={headerRef} className="appHeader">
        <button
          type="button"
          className="appHeader-brand"
          onClick={onGoHome}
          aria-label="Go home"
        >
          <img
            src={APP_IMAGES.HEADER_LOGO}
            alt="XCMXFA App"
            className="appHeader-logo"
          />
        </button>

        <div className="appHeader-actions">
          <div className="appHeader-msgSlot">
            {showMessageBell && (
              <button
                type="button"
                className="appHeader-msgBtn"
                onClick={() => {
                  if (onGoMessages) onGoMessages();
                  else navigate("/messages");
                }}
                aria-label={
                  showUnreadBadge
                    ? `Messages, ${unreadMessageCount} unread`
                    : "Messages"
                }
              >
                <span className="appHeader-msgIcon" aria-hidden="true">
                  <BellIcon />
                </span>

                {showUnreadBadge && (
                  <span className="appHeader-msgBadge" aria-hidden="true">
                    {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                  </span>
                )}
              </button>
            )}
          </div>

          <button
            type="button"
            className="appHeader-avatarBtn"
            onClick={handleAvatarClick}
            aria-label={isLoggedIn ? "Account" : "Login"}
          >
            <div
              className={
                isLoggedIn
                  ? "appHeader-avatarRing appHeader-avatarRingOn"
                  : "appHeader-avatarRing"
              }
            >
              <div className="appHeader-avatarInner">
                <img src={UI_ICONS.avatar} alt="" className="appHeader-avatarImg" />
              </div>
            </div>
          </button>
        </div>
      </header>

      {loginOpen && !isLoggedIn && (
        <>
          {!loginHandlersOk ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Login"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setLoginOpen(false);
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
                    fontWeight: 900,
                    marginBottom: 8,
                    fontSize: 18,
                    lineHeight: "24px",
                    color: "#111827",
                  }}
                >
                  Login modal misconfigured
                </div>
                <div
                  style={{
                    color: "#374151",
                    fontWeight: 600,
                    lineHeight: "22px",
                  }}
                >
                  AppHeader requires <code>onLoginSubmit</code>,{" "}
                  <code>onCancelLogin</code>, <code>onCreateAccount</code>, and{" "}
                  <code>onForgotPassword</code>.
                </div>

                <button
                  type="button"
                  onClick={() => setLoginOpen(false)}
                  style={{
                    marginTop: 16,
                    width: "100%",
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                    fontWeight: 700,
                    fontSize: 16,
                    lineHeight: "20px",
                    color: "#111827",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <LoginModal
              open={loginOpen}
              onClose={() => setLoginOpen(false)}
              onSubmit={onLoginSubmit!}
              onCancel={onCancelLogin!}
              onCreateAccount={onCreateAccount!}
              onForgotPassword={onForgotPassword!}
            />
          )}
        </>
      )}

      {accountOpen && isLoggedIn && (
        <AccountMenuModal
          open={accountOpen}
          onClose={() => setAccountOpen(false)}
          onProfile={() => {
            if (onGoProfile) onGoProfile();
          }}
          onLegal={() => {
            navigate("/legal");
          }}
          onContact={() => {
            navigate("/contact");
          }}
          onLogout={() => {
            onLogout?.();
          }}
        />
      )}
    </>
  );
}