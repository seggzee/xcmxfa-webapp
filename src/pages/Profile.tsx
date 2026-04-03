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

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UI_ICONS } from "../assets";

// ✅ Standard back icon button (same as Week/MyFlights)
import BackButton from "../components/BackButton";
import { useAuth } from "../app/authStore";
import {
  requestPushPermissionAndRegister,
  unregisterPushDevice,
  getPushDeviceStatus,
} from "../api/pushApi";

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
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        width: "100%",
        border: "none",
        background: "transparent",
        cursor: disabled ? "default" : "pointer",
      }}
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

export default function Profile() {
  const nav = useNavigate();
  const { psn } = useAuth();

  const memberPsn = String(psn || "").trim().toUpperCase();

  // UI-only placeholders for now
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);

  // Push preference UI state
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  // Initial switch state must come from DB truth for the current device.
  // IMPORTANT:
  // - Do NOT trigger permission prompt on page load.
  // - If browser permission is not already granted, keep the switch OFF.
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
          // User is turning push OFF for this current device.
          await unregisterPushDevice(memberPsn);
          setPushEnabled(false);
        } else {
          // Explicit user action: allowed to turn push back ON.
          await requestPushPermissionAndRegister(memberPsn);
          setPushEnabled(true);
        }
        return;
      }

      if (permission === "default") {
        // Explicit user action from preferences page.
        await requestPushPermissionAndRegister(memberPsn);
        setPushEnabled(Notification.permission === "granted");
        return;
      }

      // permission === "denied"
      // Browser will not reprompt here. Keep OFF.
      setPushEnabled(false);
      window.alert(
        "Push notifications are currently blocked in your browser settings. Please enable them there if you want to receive notifications."
      );
    } catch {
      // Keep current visible state if action failed.
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <div className="app-screen profile-page">
      <div className="app-container">
        <div className="profile-top">
          <div className="text-title">My Profile</div>

          {/* ✅ Standard icon back button */}
          <BackButton onClick={() => nav(-1)} ariaLabel="Back" size={38} />
        </div>

        <div className="card">
          <div className="profile-section-title">Personal information</div>

          <button className="profile-row" onClick={() => nav("/profile-wizard")}>
            <span>Name, work and contact details</span>
            <span className="profile-chevron">›</span>
          </button>
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

          <ToggleRow
            label="SMS notifications"
            checked={smsEnabled}
            onChange={() => setSmsEnabled((v) => !v)}
          />
        </div>

        <div className="card">
          <div className="profile-section-title">Travel documents</div>

          <button className="profile-row" onClick={() => nav("/passport")}>
            <span>Passport details</span>
            <img src={UI_ICONS.locked} alt="Locked" className="profile-lock" />
          </button>

          <button className="profile-row" onClick={() => nav("/esta")}>
            <span>ESTA / Residence permit details</span>
            <img src={UI_ICONS.locked} alt="Locked" className="profile-lock" />
          </button>
        </div>
      </div>
    </div>
  );
}