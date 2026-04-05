// FILE: src/pages/Profile.tsx
//
// PURPOSE
// - Member profile landing page
//
// THIS CHANGE ONLY
// - Replace the disabled "Email, PUSH and SMS" row with real notification
//   preference switches inside the existing Notification preferences section.
// - Push switch is wired.
// - Email and SMS switches are UI-only placeholders for now.
// - Push toggle initial state is read from DB via current-device status.
// - Profile page must NOT trigger a permission prompt on load.
// - No other profile behaviour changes.
//
// ADDITIONAL CHANGES (PER LATEST INSTRUCTION):
// - REMOVE SMS notifications toggle
// - ADD Account block with:
//     * Change password (icon: change_password.webp)
//     * Cancel membership (icon: cancel.webp)
//
// ADDITIONAL CHANGES (LATEST AGREED SCOPE ONLY):
// - Convert action rows to icon + title + subtext tiles
// - Keep all groups inside cards with section titles
// - Rename first section to "About you"
// - Travel document lock shown as superscript on icon
// - No icon background
//
// ADDITIONAL CHANGES (THIS PASS ONLY):
// - Wire Change password modal to /auth/password/change.php
// - Wire Delete-account modal to /api/account/delete_account.php
// - No CSS change required

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL, postJson } from "../app/api";
import { UI_ICONS } from "../assets";

import BackButton from "../components/BackButton";
import ChangePasswordModal from "../components/ChangePasswordModal";
import DeleteAccountModal from "../components/DeleteAccountModal";

import { useAuth } from "../app/authStore";
import {
  requestPushPermissionAndRegister,
  unregisterPushDevice,
  getPushDeviceStatus,
} from "../api/pushApi";

const CHANGE_PASSWORD_URL = `${API_BASE_URL}/auth/password/change.php`;
const DELETE_ACCOUNT_URL = `${API_BASE_URL}/api/account/delete_account.php`;

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
}) {
  const { iconSrc, title, subtext, onClick, showLock = false } = props;

  return (
    <button className="profile-row" onClick={onClick}>
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
  const { psn } = authCtx;

  const memberPsn = String(psn || "").trim().toUpperCase();

  const [emailEnabled, setEmailEnabled] = useState(false);

  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);

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
        <div className="app-container">
          <div className="profile-top">
            <div className="text-title">My Profile</div>

            <BackButton onClick={() => nav(-1)} ariaLabel="Back" size={38} />
          </div>

          <div className="card">
            <div className="profile-section-title">About you</div>

            <ActionTile
              iconSrc={UI_ICONS.profile}
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
            <div className="profile-section-title">Notification preferences</div>

            <ToggleRow
              label="Email notifications"
              checked={emailEnabled}
              onChange={() => setEmailEnabled((v) => !v)}
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