// src/components/AppHeader.tsx
//
// =====================================================================================
// ?? ASSET LOADING FIX (NO VITE MAGIC): AppHeader assets must NOT use "/assets/..."
// =====================================================================================
//
// NOTE (V2 HEADER LOGO):
// - We now use one rectangular header logo that already includes the text.
// - We keep legacy APP_LOGO for other areas / legacy app usage.
// - AppHeader uses APP_IMAGES.HEADER_LOGO only.
//
// =====================================================================================

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { APP_IMAGES, UI_ICONS } from "../assets";
import LoginModal from "./LoginModal";

type Props = {
  auth: any;

  // Kept for compatibility (not rendered in header anymore because logo includes text)
  title?: string;
  subtitle?: string;

  onGoHome?: () => void;
  onGoProfile?: () => void;
  onLogout?: () => void;

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

  // Measure header height so page-level sticky headers can sit UNDER it cleanly.
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
    } catch {
      // ignore
    }

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

  const loginHandlersOk = Boolean(onLoginSubmit && onCancelLogin && onCreateAccount);

  // Option B: /login -> /home?login=1 -> auto-open modal once, then clear param
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
        {/* Left: single rectangular logo (includes text) */}
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
                <img src={UI_ICONS.avatar} alt="" className="appHeader-avatarImg" />
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
