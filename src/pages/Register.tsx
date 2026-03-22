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

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 520,
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <h2
        style={{
          margin: "4px 0 20px",
          fontSize: 28,
          lineHeight: "34px",
          fontWeight: 800,
          color: "#111827",
        }}
      >
        Sign up for XCM / XFA App
      </h2>

      {/* Employer selection */}
      <div style={{ marginTop: 0 }}>
        <div
          style={{
            fontWeight: 800,
            fontSize: 15,
            lineHeight: "20px",
            marginBottom: 10,
            color: "#111827",
          }}
        >
          Your Employer
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => setCompany("KLM")}
            disabled={isSubmitting}
            style={{
              flex: 1,
              padding: "15px 16px",
              borderRadius: 12,
              border: company === "KLM" ? "1px solid #1d4ed8" : "1px solid #d1d5db",
              background: company === "KLM" ? "#eff6ff" : "#fff",
              color: "#111827",
              fontWeight: 800,
              fontSize: 16,
              lineHeight: "20px",
              cursor: isSubmitting ? "default" : "pointer",
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
              padding: "15px 16px",
              borderRadius: 12,
              border: company === "HV" ? "1px solid #1d4ed8" : "1px solid #d1d5db",
              background: company === "HV" ? "#eff6ff" : "#fff",
              color: "#111827",
              fontWeight: 800,
              fontSize: 16,
              lineHeight: "20px",
              cursor: isSubmitting ? "default" : "pointer",
            }}
          >
            Transavia (HV)
          </button>
        </div>
      </div>

      {/* Job function selector */}
      <div style={{ marginTop: 22 }}>
        <div
          style={{
            fontWeight: 800,
            fontSize: 15,
            lineHeight: "20px",
            marginBottom: 10,
            color: "#111827",
          }}
        >
          Your job function
        </div>

        <div style={{ display: "flex", gap: 10 }}>
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
                  padding: "15px 16px",
                  borderRadius: 12,
                  border: active ? "1px solid #1d4ed8" : "1px solid #d1d5db",
                  background: active ? "#eff6ff" : "#fff",
                  color: "#111827",
                  fontWeight: 800,
                  fontSize: 16,
                  lineHeight: "20px",
                  cursor: isSubmitting ? "default" : "pointer",
                }}
              >
                {j.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Staff digits */}
      <div style={{ marginTop: 22 }}>
        <div
          style={{
            fontWeight: 800,
            fontSize: 15,
            lineHeight: "20px",
            marginBottom: 10,
            color: "#111827",
          }}
        >
          Your staff number (digits only)
        </div>

        <input
          value={staffDigits}
          onChange={(e) => {
            const next = onlyDigits(e.target.value).slice(0, 6);
            setStaffDigits(next);
          }}
          inputMode="numeric"
          placeholder="e.g. 12345"
          disabled={isSubmitting}
          style={{
            width: "100%",
            padding: "14px 14px",
            borderRadius: 12,
            border: "1px solid #d1d5db",
            boxSizing: "border-box",
            fontSize: 16,
            lineHeight: "20px",
            color: "#111827",
            background: "#fff",
          }}
        />

        <div
          style={{
            marginTop: 8,
            fontSize: 13,
            lineHeight: "18px",
            color: "#6b7280",
          }}
        >
          Valid length: 5 or 6 digits. Current: {normalizedStaffDigits.length}
        </div>
      </div>

      {/* HV email local part */}
      {company === "HV" && (
        <div style={{ marginTop: 22 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: 15,
              lineHeight: "20px",
              marginBottom: 10,
              color: "#111827",
            }}
          >
            Transavia email address
          </div>

          <input
            value={transaviaEmailInput}
            onChange={(e) => setTransaviaEmailInput(e.target.value)}
            placeholder="e.g. patrick.vansteen"
            disabled={isSubmitting}
            style={{
              width: "100%",
              padding: "14px 14px",
              borderRadius: 12,
              border: "1px solid #d1d5db",
              boxSizing: "border-box",
              fontSize: 16,
              lineHeight: "20px",
              color: "#111827",
              background: "#fff",
            }}
          />

          <div
            style={{
              marginTop: 8,
              fontSize: 13,
              lineHeight: "18px",
              color: "#374151",
            }}
          >
            We will use: <strong>{tvLocal || "local-part"}@transavia.com</strong>
          </div>
        </div>
      )}

      {/* Contract confirmation */}
      <label
        style={{
          marginTop: 22,
          display: "grid",
          gridTemplateColumns: "20px minmax(0, 1fr)",
          gap: 10,
          alignItems: "start",
          cursor: isSubmitting ? "default" : "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={contractOk}
          onChange={(e) => setContractOk(e.target.checked)}
          disabled={isSubmitting}
          style={{
            width: 18,
            height: 18,
            margin: "2px 0 0 0",
          }}
        />
        <div
          style={{
            fontWeight: 600,
            fontSize: 14,
            lineHeight: "20px",
            color: "#374151",
            minWidth: 0,
            wordBreak: "break-word",
          }}
        >
          I confirm that I am permitted by my employment contract to use the KLM XCM / XFA facility.
        </div>
      </label>

      {/* Submit / actions */}
      <div style={{ marginTop: 20, display: "grid", gap: 10 }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            width: "100%",
            padding: "15px 16px",
            borderRadius: 999,
            border: "1px solid #1d4ed8",
            background: canSubmit ? "#2563eb" : "#dbe7ff",
            color: canSubmit ? "#ffffff" : "#6b7280",
            fontWeight: 800,
            fontSize: 16,
            lineHeight: "20px",
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          {isSubmitting ? "Working..." : "Request verification email"}
        </button>

        <button
          type="button"
          onClick={() => nav("/home")}
          disabled={isSubmitting}
          style={{
            width: "100%",
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px solid #d1d5db",
            background: "#fff",
            color: "#111827",
            fontWeight: 700,
            fontSize: 16,
            lineHeight: "20px",
            cursor: isSubmitting ? "default" : "pointer",
          }}
        >
          Cancel
        </button>

        {errorMsg && (
          <div
            style={{
              color: "#b91c1c",
              fontWeight: 800,
              fontSize: 13,
              lineHeight: "18px",
              marginTop: 2,
            }}
          >
            {errorMsg}
          </div>
        )}
      </div>

      {/* Helpful debug display (safe) - intentionally hidden in production UI */}
      <div
        aria-hidden="true"
        style={{
          display: "none",
          marginTop: 22,
          fontSize: 12,
          opacity: 0.8,
        }}
      >
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