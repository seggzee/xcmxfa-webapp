// src/components/AppHeader.tsx
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { APP_IMAGES } from "../assets";
import LoginModal from "./LoginModal";

type Props = {
  auth: any;

  // Optional display strings (kept for parity with older header version)
  title?: string;
  subtitle?: string;

  onGoHome?: () => void;
  onGoProfile?: () => void;
  onLogout?: () => void;

  // Guest login modal handlers (current web wiring)
  onLoginSubmit?: (args: {
    username: string;
    password: string;
    rememberDevice: boolean;
  }) => Promise<void>;

  onCancelLogin?: () => void;
  onCreateAccount?: () => void;
};

export default function AppHeader({
  auth,
  title = "XCM / XFA",
  subtitle = "Commuter app for crew",
  onGoHome,
  onGoProfile,
  onLogout,
  onLoginSubmit,
  onCancelLogin,
  onCreateAccount,
}: Props) {
  const isLoggedIn = auth?.mode === "member";

  const [accountOpen, setAccountOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const handleAvatarClick = () => {
    if (!isLoggedIn) {
      setAccountOpen(false);
      setLoginOpen(true);
      return;
    }
    setLoginOpen(false);
    setAccountOpen(true);
  };

  const loginHandlersOk = Boolean(onLoginSubmit && onCancelLogin && onCreateAccount);

  // Option B: /login -> /home?login=1 -> auto-open modal once, then clear param
  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const wantsLogin = params.get("login") === "1";
    if (!wantsLogin) return;

    // Only open modal for guests
    if (!isLoggedIn) {
      setLoginOpen(true);
    }

    // Clear the login param so refresh/back doesn’t re-trigger it
    params.delete("login");
    const nextSearch = params.toString();

    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true },
    );
  }, [location.search, location.pathname, navigate, isLoggedIn]);

  return (
    <>
      <header className="appHeader">
        {/* Left: logo (transparent, aligned) */}
        <button
          type="button"
          className="appHeader-brand"
          onClick={onGoHome}
          aria-label="Go home"
        >
          <img src={APP_IMAGES.APP_LOGO} alt="XCM / XFA" className="appHeader-logo" />

          <div className="appHeader-titleWrap">
            <div className="appHeader-title">{title}</div>
            <div className="appHeader-subtitle">{subtitle}</div>
          </div>
        </button>

        {/* Right: reserved msg slot + avatar */}
        <div className="appHeader-actions">
          <div className="appHeader-msgSlot" />

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
                <img src="/assets/avatar.jpg" alt="" className="appHeader-avatarImg" />
              </div>
            </div>
          </button>
        </div>
      </header>

      {/* LOGIN MODAL (guest only) */}
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
                  marginTop: 24,
                  background: "#fff",
                  borderRadius: 16,
                  padding: 16,
                  border: "1px solid #e6e9ee",
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Login modal misconfigured</div>
                <div style={{ color: "#111827", fontWeight: 700 }}>
                  AppHeader requires <code>onLoginSubmit</code>, <code>onCancelLogin</code>, and{" "}
                  <code>onCreateAccount</code>.
                </div>
                <button
                  type="button"
                  onClick={() => setLoginOpen(false)}
                  style={{
                    marginTop: 14,
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #e6e9ee",
                    background: "#fff",
                    fontWeight: 800,
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
            />
          )}
        </>
      )}

      {/* Account sheet (member only) */}
      {accountOpen && isLoggedIn && (
        <div className="appHeader-overlay" onClick={() => setAccountOpen(false)}>
          <div className="appHeader-sheet" onClick={(e) => e.stopPropagation()}>
            <button
              className="appHeader-sheetBtn"
              onClick={() => {
                setAccountOpen(false);
                onGoProfile?.();
              }}
            >
              <div className="title">My profile</div>
              <div className="sub">Personal details</div>
            </button>

            <button
              className="appHeader-sheetBtn danger"
              onClick={() => {
                setAccountOpen(false);
                onLogout?.();
              }}
            >
              <div className="title">Log out</div>
              <div className="sub">Switch to guest mode</div>
            </button>

            <button className="appHeader-sheetCancel" onClick={() => setAccountOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
