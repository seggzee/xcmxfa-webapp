// FILE: src/pages/Profile.tsx
//
// PURPOSE
// - Member profile landing page
//
// THIS CHANGE ONLY
// - Move page onto reusable StickyPageHeaderCard pattern
// - Keep profile tiles, modals, and unrelated API behaviour unchanged
// - Remove old local top-row shell / back button pattern
// - Keep body content inside the existing card/tile layout
// - Add a minimal phase-1 passkey setup entry inside the Account section
// - Use UI_ICONS.passkey for the new passkey row
// - Use ConfirmPasswordModal for passkey re-auth
// - No full passkey management UI in this phase
// - No other profile behaviour changes
//
// THIS CHANGE ONLY (email notification preference wiring)
// - Read auth_members_v2.email_notify via /api/members/get.php when Profile loads
// - Display the saved email_notify state in the Email notifications toggle
// - Save toggle changes via /api/members/member_general.php using yes/no
// - Keep push notification behaviour unchanged

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL, postJson } from "../app/api";
import { UI_ICONS } from "../assets";

import StickyPageHeaderCard from "../components/StickyPageHeaderCard";
import ChangePasswordModal from "../components/ChangePasswordModal";
import DeleteAccountModal from "../components/DeleteAccountModal";
import ConfirmPasswordModal from "../components/ConfirmPasswordModal";

import { useAuth } from "../app/authStore";
import {
  requestPushPermissionAndRegister,
  unregisterPushDevice,
  getPushDeviceStatus,
} from "../api/pushApi";
import {
  beginPasskeyRegistration,
  finishPasskeyRegistration,
} from "../api/passkeysApi";
import {
  createPasskeyFromOptions,
  isPasskeySupported,
} from "../utils/passkeys";

const CHANGE_PASSWORD_URL = `${API_BASE_URL}/auth/password/change.php`;
const DELETE_ACCOUNT_URL = `${API_BASE_URL}/api/account/delete_account.php`;

const MEMBER_GET_URL = `${API_BASE_URL}/api/members/get.php`;
const MEMBER_GENERAL_URL = `${API_BASE_URL}/api/members/member_general.php`;

// PURPOSE:
// - Verify current password for the already-logged-in member
// - Return a fresh passkey registration token
// IMPORTANT:
// - This endpoint should NOT mutate refresh-token state
const PASSKEY_RECONFIRM_PASSWORD_URL = `${API_BASE_URL}/auth/passkeys/reconfirm-password.php`;

function getPasskeyPromptSuppressionKey(username: string): string {
  return `passkey_prompt_suppressed_v1:${String(username || "").trim().toUpperCase()}`;
}

function markPasskeyPromptSuppressed(username: string): void {
  if (typeof window === "undefined") return;

  const normalized = String(username || "").trim().toUpperCase();
  if (!normalized) return;

  try {
    window.localStorage.setItem(getPasskeyPromptSuppressionKey(normalized), "1");
  } catch {
    // silent by design
  }
}

function normalizePasskeySetupError(error: unknown): string {
  const raw = String((error as any)?.message || error || "PASSKEY_SETUP_FAILED");
  const lower = raw.toLowerCase();

  if (
    lower.includes("duplicate_credential") ||
    lower.includes("already set up") ||
    lower.includes("already exists") ||
    lower.includes("already ready") ||
    lower.includes("invalidstateerror")
  ) {
    return "Passkey is already set up on this device.";
  }

  if (
    lower.includes("passkey_creation_cancelled") ||
    lower.includes("passkey_auth_cancelled") ||
    lower.includes("notallowederror") ||
    lower.includes("cancelled")
  ) {
    return "Passkey setup was cancelled.";
  }

  if (
    lower.includes("passkeys_not_supported") ||
    lower.includes("not supported")
  ) {
    return "Passkeys are not supported on this device/browser.";
  }

  return "Passkey setup failed. Please try again or use your password.";
}

function normalizePasskeyReauthError(error: unknown): string {
  const err: any = error as any;

  const code = String(
    err?.data?.error ||
      err?.error ||
      ""
  ).trim().toUpperCase();

  const message = String(
    err?.data?.message ||
      err?.message ||
      error ||
      "PASSKEY_REAUTH_FAILED"
  );

  const lower = `${code} ${message}`.toLowerCase();

  if (
    lower.includes("invalid_login") ||
    lower.includes("invalid credentials") ||
    lower.includes("incorrect password") ||
    lower.includes("wrong password")
  ) {
    return "Incorrect password.";
  }

  if (lower.includes("user_inactive")) {
    return "Your account is inactive.";
  }

  if (lower.includes("email_not_verified")) {
    return "Your email is not verified.";
  }

  return "Could not verify your password. Please try again.";
}

function emailNotifyToChecked(value: unknown): boolean {
  return String(value || "").trim().toLowerCase() === "yes";
}

function ToggleRow(props: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  const { label, checked, disabled, onChange } = props;

  return (
    <button
      type="button"
      className="profile-row"
      onClick={onChange}
      disabled={disabled}
    >
      <span>{label}</span>

      <span
        aria-hidden="true"
        style={{
          position: "relative",
          width: 50,
          height: 30,
          borderRadius: 999,
          background: checked ? "#111827" : "#d1d5db",
          transition: "background 0.2s ease",
          flexShrink: 0,
          opacity: disabled ? 0.7 : 1,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: checked ? 23 : 3,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "#ffffff",
            transition: "left 0.2s ease",
            boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
          }}
        />
      </span>
    </button>
  );
}

function ActionTile(props: {
  iconSrc: string;
  title: string;
  subtext: string;
  onClick: () => void;
  showLock?: boolean;
  disabled?: boolean;
}) {
  const {
    iconSrc,
    title,
    subtext,
    onClick,
    showLock = false,
    disabled = false,
  } = props;

  return (
    <button
      className="profile-row"
      onClick={onClick}
      disabled={disabled}
      style={disabled ? { opacity: 0.7, cursor: "default" } : undefined}
    >
      <div className="profile-actionMain">
        <div className="profile-actionIconWrap">
          <img src={iconSrc} alt="" className="profile-actionIcon" />
          {showLock ? (
            <img src={UI_ICONS.locked} alt="" className="profile-actionLock" />
          ) : null}
        </div>

        <div className="profile-actionText">
          <div className="profile-actionTitle">{title}</div>
          <div className="profile-actionSub">{subtext}</div>
        </div>
      </div>

      <span className="profile-chevron">›</span>
    </button>
  );
}

export default function Profile() {
  const nav = useNavigate();
  const authCtx: any = useAuth();
  const auth = authCtx?.auth || null;

  const memberPsn = String(
    auth?.user?.username || authCtx?.psn || ""
  )
    .trim()
    .toUpperCase();

  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);

  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyConfirmOpen, setPasskeyConfirmOpen] = useState(false);
  const [passkeyConfirmError, setPasskeyConfirmError] = useState<string | null>(null);

  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!memberPsn) {
        setEmailEnabled(false);
        return;
      }

      try {
        const resp = await postJson<{
          ok?: boolean;
          member?: {
            email_notify?: string | null;
          } | null;
        }>(MEMBER_GET_URL, {
          psn: memberPsn,
        });

        if (!alive) return;

        setEmailEnabled(emailNotifyToChecked(resp?.member?.email_notify));
      } catch {
        if (!alive) return;
        setEmailEnabled(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [memberPsn]);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!memberPsn) {
        setPushEnabled(false);
        return;
      }

      if (typeof window === "undefined" || !("Notification" in window)) {
        setPushEnabled(false);
        return;
      }

      if (Notification.permission !== "granted") {
        setPushEnabled(false);
        return;
      }

      try {
        const enabled = await getPushDeviceStatus(memberPsn);
        if (!alive) return;

        setPushEnabled(enabled);
      } catch {
        if (!alive) return;
        setPushEnabled(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [memberPsn]);

  const onToggleEmail = async () => {
    if (!memberPsn || emailBusy) return;

    const next = !emailEnabled;

    setEmailBusy(true);

    try {
      await postJson(MEMBER_GENERAL_URL, {
        psn: memberPsn,
        email_notify: next ? "yes" : "no",
      });

      setEmailEnabled(next);
    } catch {
      window.alert("Could not update email notification preference. Please try again.");
    } finally {
      setEmailBusy(false);
    }
  };

  const onTogglePush = async () => {
    if (!memberPsn || pushBusy) return;

    setPushBusy(true);

    try {
      if (typeof window === "undefined" || !("Notification" in window)) {
        setPushEnabled(false);
        return;
      }

      const permission = Notification.permission;

      if (permission === "granted") {
        if (pushEnabled) {
          await unregisterPushDevice(memberPsn);
          setPushEnabled(false);
        } else {
          await requestPushPermissionAndRegister(memberPsn);
          setPushEnabled(true);
        }
        return;
      }

      if (permission === "default") {
        await requestPushPermissionAndRegister(memberPsn);
        setPushEnabled(Notification.permission === "granted");
        return;
      }

      setPushEnabled(false);
      window.alert(
        "Push notifications are currently blocked in your browser settings. Please enable them there if you want to receive notifications."
      );
    } catch {
      // no-op
    } finally {
      setPushBusy(false);
    }
  };

  const openPasskeySetup = () => {
    if (passkeyBusy) return;

    if (!memberPsn) {
      window.alert("Missing username.");
      return;
    }

    if (!isPasskeySupported()) {
      window.alert("Passkeys are not supported on this device/browser.");
      return;
    }

    setPasskeyConfirmError(null);
    setPasskeyConfirmOpen(true);
  };

  const handleConfirmPasswordForPasskey = async (args: { password: string }) => {
    if (passkeyBusy) return;

    if (!memberPsn) {
      setPasskeyConfirmError("Missing username.");
      return;
    }

    if (!isPasskeySupported()) {
      setPasskeyConfirmError("Passkeys are not supported on this device/browser.");
      return;
    }

    setPasskeyBusy(true);
    setPasskeyConfirmError(null);

    let registrationToken = "";

    try {
      const reauthResp = await postJson<{
        ok?: boolean;
        token?: string;
        expiresIn?: number;
        passkeyRegistrationToken?: string;
        passkeyRegistrationExpiresIn?: number;
        error?: string;
        message?: string;
      }>(PASSKEY_RECONFIRM_PASSWORD_URL, {
        username: memberPsn,
        password: args.password,
      });

      registrationToken = String(
        reauthResp?.passkeyRegistrationToken || reauthResp?.token || ""
      ).trim();

      if (!registrationToken) {
        throw new Error("PASSKEY_REAUTH_MISSING_TOKEN");
      }
    } catch (error) {
      setPasskeyConfirmError(normalizePasskeyReauthError(error));
      setPasskeyBusy(false);
      return;
    }

    setPasskeyConfirmOpen(false);
    setPasskeyConfirmError(null);

    try {
      const beginResp = await beginPasskeyRegistration(registrationToken);
      const credential = await createPasskeyFromOptions(beginResp.options);
      await finishPasskeyRegistration(registrationToken, credential);

      markPasskeyPromptSuppressed(memberPsn);
      window.alert("Passkey created for this device.");
    } catch (error) {
      const message = normalizePasskeySetupError(error);

      if (message === "Passkey is already set up on this device.") {
        markPasskeyPromptSuppressed(memberPsn);
      }

      window.alert(message);
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleChangePassword = async (args: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    if (!memberPsn) {
      throw new Error("Missing username.");
    }

    await postJson(CHANGE_PASSWORD_URL, {
      username: memberPsn,
      current_password: args.currentPassword,
      new_password: args.newPassword,
    });
  };

  const handleDeleteAccount = async (args: { confirmText: string }) => {
    if (!memberPsn) {
      throw new Error("Missing username.");
    }

    if (args.confirmText.trim() !== "DELETE") {
      throw new Error("Please type DELETE exactly to confirm.");
    }

    await postJson(DELETE_ACCOUNT_URL, {
      username: memberPsn,
    });

    window.alert("Account deleted.");

    if (typeof authCtx?.logout === "function") {
      await authCtx.logout();
      return;
    }

    if (typeof authCtx?.signOut === "function") {
      await authCtx.signOut();
      return;
    }

    nav("/", { replace: true });
  };

  return (
    <>
      <div className="app-screen profile-page">
        <StickyPageHeaderCard
          leftContent={
            <img
              src={UI_ICONS.profile}
              alt="My profile"
              style={{
                width: 52,
                height: 52,
                objectFit: "contain",
                borderRadius: 14,
              }}
            />
          }
          title="My Profile"
          onBack={() => nav(-1)}
          backAriaLabel="Back"
        />

        <div className="app-container" style={{ paddingTop: 0 }}>
          <div className="card">
            <div className="profile-section-title">About you</div>

            <ActionTile
              iconSrc={UI_ICONS.profile_blue}
              title="Personal information"
              subtext="Name, work and contact details"
              onClick={() => nav("/profile-wizard")}
            />
          </div>

          <div className="card">
            <div className="profile-section-title">Travel documents</div>

            <ActionTile
              iconSrc={UI_ICONS.passport}
              title="Passport information"
              subtext="Passport details, nationality etc"
              onClick={() => nav("/passport")}
              showLock={true}
            />

            <ActionTile
              iconSrc={UI_ICONS.esta}
              title="ESTA / Residence permits"
              subtext="For UK, USA, Canada residents"
              onClick={() => nav("/esta")}
              showLock={true}
            />
          </div>
		  
          <div className="card">
            <div className="profile-section-title">Travel history</div>

            <ActionTile
              iconSrc={UI_ICONS.listing}
              title="Listings history"
              subtext="Recent listing records"
              onClick={() => nav("/profile/travel-history")}
            />
          </div>		  

          <div className="card">
            <div className="profile-section-title">Notification preferences</div>

            <ToggleRow
              label="Email notifications"
              checked={emailEnabled}
              disabled={emailBusy || !memberPsn}
              onChange={() => void onToggleEmail()}
            />

            <ToggleRow
              label="Push notifications"
              checked={pushEnabled}
              disabled={pushBusy || !memberPsn}
              onChange={() => void onTogglePush()}
            />
          </div>

          <div className="card">
            <div className="profile-section-title">Account</div>

            <ActionTile
              iconSrc={UI_ICONS.passkey}
              title="Set up passkey on this device"
              subtext={
                passkeyBusy
                  ? "Preparing secure sign-in..."
                  : "Use Face ID, Touch ID, or Windows Hello"
              }
              onClick={openPasskeySetup}
              disabled={passkeyBusy || !memberPsn}
            />

            <ActionTile
              iconSrc={UI_ICONS.change_password}
              title="Change password"
              subtext="Choose a new password"
              onClick={() => setChangePasswordOpen(true)}
            />

            <ActionTile
              iconSrc={UI_ICONS.cancel}
              title="Cancel membership"
              subtext="Delete your member account"
              onClick={() => setDeleteAccountOpen(true)}
            />
          </div>
        </div>
      </div>

      <ConfirmPasswordModal
        open={passkeyConfirmOpen}
        busy={passkeyBusy}
        error={passkeyConfirmError}
        onClose={() => {
          if (passkeyBusy) return;
          setPasskeyConfirmOpen(false);
          setPasskeyConfirmError(null);
        }}
        onCancel={() => {
          setPasskeyConfirmOpen(false);
          setPasskeyConfirmError(null);
        }}
        onSubmit={handleConfirmPasswordForPasskey}
      />

      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        onSubmit={handleChangePassword}
      />

      <DeleteAccountModal
        open={deleteAccountOpen}
        onClose={() => setDeleteAccountOpen(false)}
        onSubmit={handleDeleteAccount}
      />
    </>
  );
}