import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { STORAGE_PENDING_USERNAME } from "../app/storageKeys";
import { useAuth } from "../app/authStore";

/**
 * Idiot-guide: What this page is
 * ------------------------------
 * RN RegisterScreen has 2 states:
 *   1) Before submit: collect user identity -> call registerStart()
 *   2) After submit (didSubmit === true):
 *        - show "check your email"
 *        - button: "I have verified my email"
 *        - on click: call onContinue({ username })
 *        - AppRoot routes to SetPassword using that username
 *
 * On web, we split those 2 states into 2 routes:
 *   - /register         -> request verification email (Register.tsx)
 *   - /register/verify  -> this file (user confirms they clicked email link)
 *
 * IMPORTANT BUSINESS RULE:
 * - We do NOT call any verification endpoint here.
 * - The user verifies by clicking the email link outside the app.
 * - Here we only continue the flow and route to SetPassword.
 *
 * Source of truth: RegisterScreen.js (RN). :contentReference[oaicite:0]{index=0}
 */

type NavState = {
  submittedEmail?: string;   // for display only
  derivedUsername?: string;  // the important identity key
};

export default function RegisterVerify() {
  const nav = useNavigate();
  const loc = useLocation();
  const { setOnboardingUsername } = useAuth();

  // ---------------------------------------------------------
  // 1) Read navigation state (if user arrived directly from /register)
  // ---------------------------------------------------------
  const navState = (loc.state || {}) as NavState;

  // ---------------------------------------------------------
  // 2) Read localStorage fallback (if user refreshed, or opened /verify directly)
  // ---------------------------------------------------------
  const pendingUsername = useMemo(() => {
    return String(localStorage.getItem(STORAGE_PENDING_USERNAME) || "")
      .trim()
      .toUpperCase();
  }, []);

  // ---------------------------------------------------------
  // 3) Determine the username we will continue with
  // ---------------------------------------------------------
  const usernameToUse = useMemo(() => {
    const fromState = String(navState?.derivedUsername || "")
      .trim()
      .toUpperCase();
    if (fromState) return fromState;
    return pendingUsername; // fallback
  }, [navState?.derivedUsername, pendingUsername]);

  // Display email: either from nav state or infer a hint
  // (We do NOT guess Transavia local-part here; it’s just for user reassurance)
  const submittedEmail = useMemo(() => {
    const e = String(navState?.submittedEmail || "").trim();
    if (e) return e;

    // If we only have username, we can show a conservative hint:
    // - KLMxxxxx -> KLMxxxxx@klm.com
    // - HVxxxxx -> "(your Transavia email)"
    if (usernameToUse.startsWith("KLM")) {
      return `${usernameToUse.toLowerCase()}@klm.com`;
    }
    if (usernameToUse.startsWith("HV")) {
      return "(your Transavia email address)";
    }
    return "";
  }, [navState?.submittedEmail, usernameToUse]);

  /**
   * Idiot-guide: Continue button
   * ----------------------------
   * This is the equivalent of RN's "I have verified my email" button.
   *
   * Action:
   * - set onboardingUsername in our global store (equivalent to AppRoot setOnboardingUsername)
   * - route to /register/set-password
   *
   * We do NOT clear pendingUsername yet, because the user might still close browser
   * before completing SetPassword/ProfileWizard.
   */
  const onContinue = () => {
    if (!usernameToUse) {
      // If we can't continue, something went wrong (user jumped here with no context).
      // We route them back to /register rather than letting them proceed with blank identity.
      nav("/register", { replace: true });
      return;
    }

    setOnboardingUsername(usernameToUse);

    nav("/register/set-password", {
      replace: true,
      state: { username: usernameToUse }, // helpful for SetPassword prefill
    });
  };

  /**
   * Idiot-guide: Back button
   * ------------------------
   * On web we send them back to /register (the data entry screen).
   */
  const onBack = () => {
    nav("/register");
  };

  return (
    <div style={{ padding: 24, maxWidth: 520 }}>
      <h2>Verify your email</h2>

      <div style={{ marginTop: 12, lineHeight: 1.5 }}>
        <p>
          We’ve sent a verification link to:
        </p>

        <p style={{ fontWeight: 900 }}>
          {submittedEmail || "(email address)"}
        </p>

        <p style={{ opacity: 0.85 }}>
          Please open that email and click the verification link.
          Then come back here and press the button below.
        </p>
      </div>

      <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
        <button
          type="button"
          onClick={onContinue}
          style={{
            padding: 14,
            borderRadius: 999,
            border: "1px solid #d6e3ff",
            background: "#e9f1ff",
            fontWeight: 900,
          }}
        >
          I have verified my email
        </button>

        <button
          type="button"
          onClick={onBack}
          style={{
            padding: 10,
            borderRadius: 10,
            background: "transparent",
            fontWeight: 900,
          }}
        >
          Back
        </button>
      </div>

      {/* Debug info (safe, helps newbies) */}
      <div style={{ marginTop: 22, fontSize: 12, opacity: 0.75 }}>
        <div>
          <strong>Continuing as:</strong> {usernameToUse || "(missing username)"}
        </div>
        {!usernameToUse && (
          <div style={{ marginTop: 6, color: "#b91c1c", fontWeight: 800 }}>
            Missing username context — please go back and re-enter registration details.
          </div>
        )}
      </div>
    </div>
  );
}
