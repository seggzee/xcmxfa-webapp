import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { STORAGE_PENDING_USERNAME } from "../app/storageKeys";
import { API_BASE_URL, postJson } from "../app/api";

/**
 * Idiot-guide: What this page is
 * ------------------------------
 * RN has ONE RegisterScreen with two states:
 *   - Before submit: collect details + call registerStart(payload)
 *   - After submit: show "check email" + button "I have verified"
 *
 * Web splits this into 2 routes:
 *   - /register         (this file)  -> request verification email
 *   - /register/verify  (other file) -> user confirms they clicked email link
 *
 * This file copies RN logic exactly:
 * - company: "KLM" | "HV"
 * - jobFunction: "cockpit" | "cabin"
 * - staff digits: 5 or 6 digits only (max 6)
 * - Transavia email local part required only if company === "HV"
 * - contractOk must be true
 * - payload shape:
 *     { company, job, staffNumber, hvEmailLocalPart? }
 *
 * Source of truth: RegisterScreen.js :contentReference[oaicite:1]{index=1}
 */

// ---------------------------------------------------------------------------
// Constants copied from RN
// ---------------------------------------------------------------------------
const JOB_FUNCTIONS = [
  { key: "cockpit", label: "Cockpit crew" },
  { key: "cabin", label: "Cabin crew" },
] as const;

type Company = "KLM" | "HV";
type JobKey = (typeof JOB_FUNCTIONS)[number]["key"];

// ---------------------------------------------------------------------------
// Small helper functions copied from RN (same behaviour)
// ---------------------------------------------------------------------------
function onlyDigits(s: string) {
  return (s || "").replace(/\D+/g, "");
}

function transaviaLocalPart(input: string) {
  const t = (input || "").trim().toLowerCase();
  if (!t) return "";
  const at = t.indexOf("@");
  return at >= 0 ? t.slice(0, at) : t;
}

/**
 * Idiot-guide: Where is registerStart()?
 * --------------------------------------
 * In RN, RegisterScreen imports:
 *    import { registerStart } from "../../auth/authClient";
 *
 * On web, we can call the SAME endpoint directly.
 * You did not post authClient.js here, so we do not guess its wrapper.
 *
 * IMPORTANT:
 * - If your /auth/register-start endpoint differs, change ONLY this constant.
 * - Do NOT change payload shape. Payload shape is locked by RN file.
 */
 
 
// RN registerStart() endpoint (your confirmed path)
const REGISTER_START_URL = `${API_BASE_URL}/auth/register/start.php`;

export default function Register() {
  const nav = useNavigate();

  // --------------------------------------------
  // Form state (same as RN)
  // --------------------------------------------
  const [company, setCompany] = useState<Company | null>(null);
  const [jobFunction, setJobFunction] = useState<JobKey | null>(null);
  const [staffDigits, setStaffDigits] = useState("");
  const [transaviaEmailInput, setTransaviaEmailInput] = useState("");
  const [contractOk, setContractOk] = useState(false);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // --------------------------------------------
  // Derived values (same as RN)
  // --------------------------------------------

  // digits only, max 6 (RN slices to 6)
  const normalizedStaffDigits = useMemo(() => {
    return onlyDigits(staffDigits).slice(0, 6);
  }, [staffDigits]);

  // RN rule: valid if length is 5 OR 6
  const staffValid = useMemo(() => {
    return normalizedStaffDigits.length === 5 || normalizedStaffDigits.length === 6;
  }, [normalizedStaffDigits]);

  const tvLocal = useMemo(() => transaviaLocalPart(transaviaEmailInput), [transaviaEmailInput]);

  const needsTransaviaEmail = company === "HV";
  const transaviaEmailValid = !needsTransaviaEmail ? true : tvLocal.length > 0;

  // canSubmit rule copied from RN
  const canSubmit =
    !!company &&
    !!jobFunction &&
    staffValid &&
    transaviaEmailValid &&
    contractOk &&
    !isSubmitting;

  /**
   * Idiot-guide: derivedUsername
   * ----------------------------
   * RN uses:
   *   KLM + digits  OR  HV + digits
   * This becomes the identity key everywhere (login, member lookups, etc.)
   */
  const derivedUsername = useMemo(() => {
    if (!company) return "";
    if (!staffValid) return "";
    return `${company}${normalizedStaffDigits}`.toUpperCase();
  }, [company, normalizedStaffDigits, staffValid]);

  /**
   * Idiot-guide: derivedEmail
   * -------------------------
   * This is only for user clarity (what email they are verifying)
   *
   * RN rules:
   * - KLM -> derivedUsername@klm.com
   * - HV  -> tvLocal@transavia.com
   */
  const derivedEmail = useMemo(() => {
    if (!company || !staffValid) return "";
    if (company === "KLM") {
      return `${derivedUsername}@klm.com`.toLowerCase();
    }
    if (company === "HV") {
      return `${tvLocal}@transavia.com`;
    }
    return "";
  }, [company, staffValid, derivedUsername, tvLocal]);

  /**
   * Idiot-guide: Submit handler
   * ---------------------------
   * Mirrors RN handleSubmit():
   * - build payload with exact key names
   * - call registerStart(payload)
   * - on success:
   *    - store pendingUsername so onboarding can resume (web equivalent of AsyncStorage)
   *    - navigate to /register/verify and pass derived info in navigation state
   */
  const handleSubmit = async () => {
    if (!canSubmit) return;

    setErrorMsg("");
    setIsSubmitting(true);

    try {
      // Payload shape copied from RN file (DO NOT RENAME KEYS)
      const payload: {
        company: Company;
        job: JobKey;
        staffNumber: string;
        hvEmailLocalPart?: string;
      } = {
        company,
        job: jobFunction!,
        staffNumber: normalizedStaffDigits,
        hvEmailLocalPart: company === "HV" ? tvLocal : undefined,
      };

      // Dev-only debug (helps validate contracts)
      // eslint-disable-next-line no-console
      console.log("[RegisterStart] payload:", payload);

      // Call the backend
      await postJson<any>(REGISTER_START_URL, payload);

      // IMPORTANT: This is what allows "resume onboarding" if user closes browser.
      localStorage.setItem(STORAGE_PENDING_USERNAME, derivedUsername);

      // Web split: go to /register/verify
      // We pass helpful display values via navigation state (not business logic).
      nav("/register/verify", {
        replace: true,
        state: {
          submittedEmail: derivedEmail,
          derivedUsername,
        },
      });
    } catch (e: any) {
      // RN shows friendly message (not raw server response)
      // Keep parity.
      // eslint-disable-next-line no-console
      console.log("[RegisterStart] failed:", e?.message || e);
      setErrorMsg("Registration failed. Please check your details and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --------------------------------------------
  // UI (minimal, but logically equivalent)
  // --------------------------------------------
  return (
    <div style={{ padding: 24, maxWidth: 520 }}>
      <h2>Sign up for XCM / XFA App</h2>

      {/* Employer selection */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Your Employer</div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => setCompany("KLM")}
            disabled={isSubmitting}
            style={{
              flex: 1,
              padding: 16,
              borderRadius: 12,
              border: "1px solid #ddd",
              background: company === "KLM" ? "#e9f1ff" : "#fff",
              fontWeight: 800,
            }}
          >
            KLM
          </button>

          <button
            type="button"
            onClick={() => setCompany("HV")}
            disabled={isSubmitting}
            style={{
              flex: 1,
              padding: 16,
              borderRadius: 12,
              border: "1px solid #ddd",
              background: company === "HV" ? "#e9f1ff" : "#fff",
              fontWeight: 800,
            }}
          >
            Transavia (HV)
          </button>
        </div>
      </div>

      {/* Job function pills */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Your job function</div>

        <div style={{ display: "flex", gap: 10, flexWrap: "nowrap" }}>
          {JOB_FUNCTIONS.map((j) => {
            const active = jobFunction === j.key;
            return (
              <button
                key={j.key}
                type="button"
                onClick={() => setJobFunction(j.key)}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 999,
                  border: "1px solid #ddd",
                  background: active ? "#e9f1ff" : "#fff",
                  fontWeight: 800,
                }}
              >
                {j.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Staff digits */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Your staff number (digits only)</div>

        <input
          value={staffDigits}
          onChange={(e) => {
            // RN sanitizes to digits and max 6
            const next = onlyDigits(e.target.value).slice(0, 6);
            setStaffDigits(next);
          }}
          inputMode="numeric"
          placeholder="e.g. 12345"
          disabled={isSubmitting}
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
        />

        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
          Valid length: 5 or 6 digits. Current: {normalizedStaffDigits.length}
        </div>
      </div>

      {/* HV email local part */}
      {company === "HV" && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Transavia email address</div>

          <input
            value={transaviaEmailInput}
            onChange={(e) => setTransaviaEmailInput(e.target.value)}
            placeholder="e.g. patrick.vansteen"
            disabled={isSubmitting}
            style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
          />

          <div style={{ marginTop: 8, fontSize: 13 }}>
            We will use: <strong>{tvLocal || "local-part"}@transavia.com</strong>
          </div>
        </div>
      )}

      {/* Contract confirmation */}
      <div style={{ marginTop: 20, display: "flex", gap: 10, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={contractOk}
          onChange={(e) => setContractOk(e.target.checked)}
          disabled={isSubmitting}
        />
        <div style={{ fontWeight: 700 }}>
          I confirm that I am permitted by my employment contract to use the KLM XCM / XFA facility.
        </div>
      </div>

      {/* Submit */}
      <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            padding: 14,
            borderRadius: 999,
            border: "1px solid #d6e3ff",
            background: "#e9f1ff",
            fontWeight: 900,
            opacity: canSubmit ? 1 : 0.55,
          }}
        >
          {isSubmitting ? "Working..." : "Request verification email"}
        </button>

        {errorMsg && (
          <div style={{ color: "#b91c1c", fontWeight: 800, fontSize: 13 }}>
            {errorMsg}
          </div>
        )}

        <button
          type="button"
          onClick={() => nav("/home")}
          disabled={isSubmitting}
          style={{
            padding: 10,
            borderRadius: 10,
            background: "transparent",
            fontWeight: 900,
          }}
        >
          Cancel
        </button>
      </div>

      {/* Helpful debug display (safe) */}
      <div style={{ marginTop: 22, fontSize: 12, opacity: 0.8 }}>
        <div>
          <strong>Derived username:</strong> {derivedUsername || "(incomplete)"}
        </div>
        <div>
          <strong>Derived email:</strong> {derivedEmail || "(incomplete)"}
        </div>
      </div>
    </div>
  );
}
