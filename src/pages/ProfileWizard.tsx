import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { API_BASE_URL, postJson } from "../app/api";
import { STORAGE_PENDING_USERNAME } from "../app/storageKeys";
import { useAuth } from "../app/authStore";
import { useCrew } from "../app/crewStore";
import { COUNTRY_AIRPORTS } from "../data/airports";

/**
 * ============================================================================
 * ProfileWizard.tsx (Web)
 * ============================================================================
 * - Writes "member general" details to members_v2 via:
 *   POST  /api/members/member_general.php
 *
 * IMPORTANT (source of truth: your backend response):
 * - Backend expects FLAT JSON with top-level keys (psn, employer, etc)
 * - Do NOT wrap in { payload: ... }
 *
 * Polishes implemented:
 * 1) Title is a locked select (Mr/Mrs/Ms/Mx)
 * 2) Telephone is split: [countryCode select] + [digits input]
 * 3) Auto-capitalise firstname/lastname on blur
 */

const SAVE_MEMBER_GENERAL_URL = `${API_BASE_URL}/api/members/member_general.php`;

// Keep the list short-but-useful; you can extend later.
const PHONE_CODES = [
  { code: "+31", label: "Netherlands (+31)" },
  { code: "+44", label: "United Kingdom (+44)" },
  { code: "+1", label: "USA/Canada (+1)" },
  { code: "+33", label: "France (+33)" },
  { code: "+49", label: "Germany (+49)" },
  { code: "+34", label: "Spain (+34)" },
  { code: "+39", label: "Italy (+39)" },
  { code: "+32", label: "Belgium (+32)" },
  { code: "+351", label: "Portugal (+351)" },
  { code: "+353", label: "Ireland (+353)" },
  { code: "+41", label: "Switzerland (+41)" },
  { code: "+45", label: "Denmark (+45)" },
  { code: "+46", label: "Sweden (+46)" },
  { code: "+47", label: "Norway (+47)" },
] as const;

function normalizeEmail(raw: string) {
  return (raw || "").trim().toLowerCase();
}

/**
 * Allows:
 *   name.surname@klm.com OR name.surname@transavia.com
 * Supports:
 *   hyphens + multi-part surnames with dots
 */
function isValidKlmEmail(emailLower: string) {
  const re = /^[a-z]+(?:-[a-z]+)*(?:\.[a-z]+(?:-[a-z]+)*)+@(klm|transavia)\.com$/;
  return re.test(emailLower);
}

function deriveXType(jobFunction: string) {
  if (jobFunction === "Cockpit crew") return "XCM";
  if (jobFunction === "Cabin crew") return "XFA";
  if (jobFunction === "Ground staff") return "other";
  return null;
}

function deriveXCat(employer: string, xType: string | null) {
  if (!employer || !xType) return null;
  if (xType === "other") return null;

  const emp =
    employer === "KLM" ? "KLM" : employer === "TRANSAVIA" ? "TRANSAVIA" : null;
  if (!emp) return null;

  if (emp === "KLM" && xType === "XCM") return "A";
  if (emp === "TRANSAVIA" && xType === "XCM") return "B";
  if (emp === "KLM" && xType === "XFA") return "C";
  if (emp === "TRANSAVIA" && xType === "XFA") return "D";
  return null;
}

// Auto-capitalise each word part: "van der berg" -> "Van Der Berg"
function titleCaseWords(input: string) {
  const s = (input || "").trim();
  if (!s) return "";
  return s
    .split(/\s+/g)
    .map((word) => {
      const w = word.trim();
      if (!w) return "";
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

// Extract telephone into code + digits if stored as "+31 6123..." or "+316123..."
function splitTelephone(initialTelRaw: string): { code: string; digits: string } {
  const raw = (initialTelRaw || "").trim();
  if (!raw) return { code: "+31", digits: "" };

  const compact = raw.replace(/[^\d+]/g, "");

  const codes = [...PHONE_CODES].map((x) => x.code).sort((a, b) => b.length - a.length);
  const match = codes.find((c) => compact.startsWith(c));
  if (match) {
    const digits = compact.slice(match.length).replace(/\D/g, "");
    return { code: match, digits };
  }

  if (compact.startsWith("+")) {
    const digits = compact.replace(/\D/g, "");
    return { code: "+31", digits };
  }

  return { code: "+31", digits: compact.replace(/\D/g, "") };
}

export default function ProfileWizard() {
  const nav = useNavigate();
  const { auth, routeReason, setRouteReason, onboardingUsername } = useAuth();
  const { crew, loadCrew } = useCrew();

  const psn = useMemo(() => {
    return String(crew?.psn || onboardingUsername || auth?.user?.username || "")
      .trim()
      .toUpperCase();
  }, [crew?.psn, onboardingUsername, auth?.user?.username]);

  const countries = useMemo(() => {
    const keys = Object.keys(COUNTRY_AIRPORTS || {});
    const cleaned = keys.map((c) => String(c || "").trim()).filter(Boolean);
    cleaned.sort((a, b) => a.localeCompare(b));
    return cleaned;
  }, []);

  const initial = crew || {};

  const [saving, setSaving] = useState(false);

  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");

  const [title, setTitle] = useState(String(initial?.title || ""));

  const [firstName, setFirstName] = useState(
    String(initial?.firstname || initial?.firstName || "")
  );
  const [lastName, setLastName] = useState(
    String(initial?.lastname || initial?.lastName || "")
  );

  const [email, setEmail] = useState(String(initial?.email || ""));

  const initialTel = splitTelephone(String(initial?.telephone || initial?.phone || ""));
  const [phoneCode, setPhoneCode] = useState(initialTel.code);
  const [phoneDigits, setPhoneDigits] = useState(initialTel.digits);

  const [employer, setEmployer] = useState(() => {
    if (initial?.employer === "TRANSAVIA") return "TRANSAVIA";
    if (initial?.employer === "KLM") return "KLM";
    return String(initial?.employer || "");
  });

  const [jobFunction, setJobFunction] = useState(() => {
    const xt = initial?.x_type;
    if (xt === "XCM") return "Cockpit crew";
    if (xt === "XFA") return "Cabin crew";
    if (xt === "other") return "Ground staff";
    return String(initial?.jobFunction || initial?.role || "");
  });

  const [xBase, setXBase] = useState(String(initial?.x_base || initial?.xBase || ""));

  const [error, setError] = useState("");

  const telephoneCombined = useMemo(() => {
    const d = (phoneDigits || "").replace(/\D/g, "");
    return d ? `${phoneCode}${d}` : "";
  }, [phoneCode, phoneDigits]);

  function validateGeneral(): string | null {
    if (!psn) return "Missing PSN / staff number.";

    if (!title) return "Please select a title.";
    if (!["Mr", "Mrs", "Ms", "Mx"].includes(title)) return "Invalid title selection.";

    if (!firstName.trim()) return "Please enter first name.";
    if (!lastName.trim()) return "Please enter last name.";

    const emailLower = normalizeEmail(email);
    if (!emailLower) return "Please enter email.";
    if (!isValidKlmEmail(emailLower))
      return "Email must be name.surname@klm.com or name.surname@transavia.com";

    if (!phoneCode) return "Please select country code.";
    const digits = (phoneDigits || "").replace(/\D/g, "");
    if (!digits) return "Please enter telephone digits.";
    if (!/^\d+$/.test(digits)) return "Telephone digits must be numbers only.";

    if (!employer) return "Please select employer.";
    if (!jobFunction) return "Please select job function.";

    const xType = deriveXType(jobFunction);
    if (!xType) return "Invalid job function selection.";

    if (!xBase) return "Please select primary XCM/XFA country.";
    if (countries.length > 0 && !countries.includes(xBase)) {
      return "Primary country must be selected from the app country list.";
    }

    return null;
  }

  async function handleSave() {
    if (saving) return;
    setError("");

    const v = validateGeneral();
    if (v) {
      setError(v);
      return;
    }

    const xType = deriveXType(jobFunction);
    const xCat = deriveXCat(employer, xType);

    const generalPayload = {
      psn: psn.trim(),

      employer: employer === "KLM" ? "KLM" : employer === "TRANSAVIA" ? "TRANSAVIA" : employer,
      job_function: jobFunction,
      primary_country: xBase,

      x_type: xType,
      x_base: xBase,
      x_cat: xCat,

      title: title,
      firstname: firstName.trim(),
      lastname: lastName.trim(),
      email: normalizeEmail(email),
      telephone: telephoneCombined,
    };

    try {
      setSaving(true);

      await postJson(SAVE_MEMBER_GENERAL_URL, generalPayload);

      await loadCrew(psn);

      localStorage.removeItem(STORAGE_PENDING_USERNAME);

      setRouteReason?.("details_saved");
      nav("/home", { replace: true });
    } catch (e: any) {
      setError(e?.message || "Failed to save details.");
    } finally {
      setSaving(false);
    }
  }

  const onPrevious = () => {
    if (routeReason === "profile_incomplete" || routeReason === "password_required") {
      nav("/register/set-password", { replace: true });
      return;
    }
    nav("/home");
  };

  const onCancel = () => {
    nav("/home");
  };

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter((c) => c.toLowerCase().includes(q));
  }, [countries, countryQuery]);

  const isMember = auth?.mode === "member";

  return (
    <div className="app-screen profile-page">
      <div className="app-container">
        <div className="profile-top">
          <div className="text-title">Complete your details</div>

          <button className="btn btn-secondary" onClick={() => nav(-1)} disabled={saving}>
            Back
          </button>
        </div>

        {!isMember ? (
          <div className="wizard-warning card">
            <div className="wizard-warning-title">Members only</div>
            <div className="wizard-warning-body">Please log in to complete your profile.</div>
          </div>
        ) : null}

        {/* PSN display (read-only) */}
        <div className="card">
          <div className="profile-section-title">PSN / Staff identity</div>
          <input value={psn} readOnly disabled className="wizard-input wizard-input--readonly" />
        </div>

        {/* Title (LOCKED SELECT) */}
        <div className="card">
          <div className="profile-section-title">Title</div>
          <select
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving}
            className="wizard-input"
          >
            <option value="">Select title…</option>
            <option value="Mr">Mr</option>
            <option value="Mrs">Mrs</option>
            <option value="Ms">Ms</option>
            <option value="Mx">Mx</option>
          </select>
        </div>

        {/* First + last name */}
        <div className="card">
          <div className="profile-section-title">First name</div>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            onBlur={() => setFirstName(titleCaseWords(firstName))}
            disabled={saving}
            className="wizard-input"
          />
        </div>

        <div className="card">
          <div className="profile-section-title">Last name</div>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            onBlur={() => setLastName(titleCaseWords(lastName))}
            disabled={saving}
            className="wizard-input"
          />
        </div>

        {/* Email */}
        <div className="card">
          <div className="profile-section-title">Email</div>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={saving}
            autoCapitalize="none"
            className="wizard-input"
          />
          <div className="wizard-help">name.surname (@klm.com or @transavia.com)</div>
        </div>

        {/* Telephone (2-part) */}
        <div className="card">
          <div className="profile-section-title">Telephone</div>

          <div className="wizard-grid2">
            <select
              value={phoneCode}
              onChange={(e) => setPhoneCode(e.target.value)}
              disabled={saving}
              className="wizard-input"
            >
              {PHONE_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>

            <input
              value={phoneDigits}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/\D/g, "");
                setPhoneDigits(digitsOnly);
              }}
              inputMode="numeric"
              placeholder="digits only"
              disabled={saving}
              className="wizard-input"
            />
          </div>

          <div className="wizard-help">
            Stored as: <strong>{telephoneCombined || "(empty)"}</strong>
          </div>
        </div>

        {/* Employer pills */}
        <div className="card">
          <div className="profile-section-title">Employer</div>

          <div className="wizard-pillRow">
            <button
              type="button"
              onClick={() => setEmployer("KLM")}
              disabled={saving}
              className={`btn btn-secondary wizard-pill ${
                employer === "KLM" ? "wizard-pill--active" : ""
              }`}
            >
              KLM / KLC
            </button>

            <button
              type="button"
              onClick={() => setEmployer("TRANSAVIA")}
              disabled={saving}
              className={`btn btn-secondary wizard-pill ${
                employer === "TRANSAVIA" ? "wizard-pill--active" : ""
              }`}
            >
              Transavia
            </button>
          </div>
        </div>

        {/* Job function pills */}
        <div className="card">
          <div className="profile-section-title">Job function</div>

          <div className="wizard-pillRow">
            {["Cockpit crew", "Cabin crew"].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setJobFunction(v)}
                disabled={saving}
                className={`btn btn-secondary wizard-pill ${
                  jobFunction === v ? "wizard-pill--active" : ""
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Country selection */}
        <div className="card">
          <div className="profile-section-title">XCM / XFA country</div>

          <button
            type="button"
            onClick={() => {
              setCountryQuery("");
              setCountryModalOpen(true);
            }}
            disabled={saving}
            className="profile-row"
          >
            <span>{xBase || "Select country"}</span>
            <span className="profile-chevron">›</span>
          </button>

          <div className="wizard-help">Main country for xcm / xfa travel</div>
        </div>

        {/* Modal (simple overlay) */}
        {countryModalOpen ? (
          <div
            className="wizard-modalOverlay"
            onClick={() => setCountryModalOpen(false)}
          >
            <div className="wizard-modalCard" onClick={(e) => e.stopPropagation()}>
              <div className="wizard-modalHeader">
                <div className="wizard-modalTitle">Select country</div>

                <input
                  value={countryQuery}
                  onChange={(e) => setCountryQuery(e.target.value)}
                  placeholder="Search…"
                  className="wizard-input wizard-input--modal"
                />
              </div>

              <div className="wizard-modalBody">
                {countries.length ? (
                  filteredCountries.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setXBase(c);
                        setCountryModalOpen(false);
                      }}
                      className={`wizard-listRow ${
                        xBase === c ? "wizard-listRow--active" : ""
                      }`}
                    >
                      {c}
                    </button>
                  ))
                ) : (
                  <div className="wizard-empty">No countries available.</div>
                )}
              </div>

              <div className="wizard-modalFooter">
                <button
                  type="button"
                  onClick={() => setCountryModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Passport/ESTA note */}
        <div className="card">
          <div className="profile-section-title">Passport &amp; Travel documents</div>
          <div className="wizard-note">
            Passport and ESTA details are stored separately. ESTA/residence details are only required
            for United States and Canada. Please complete passport details from profile page.
          </div>
        </div>

        {/* Buttons */}
        <div className="wizard-actions">
          <div className="wizard-actionsRow">
            <button
              type="button"
              onClick={onPrevious}
              disabled={saving}
              className="btn btn-secondary"
            >
              Previous page
            </button>

            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="btn btn-secondary wizard-cancel"
            >
              Cancel
            </button>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary wizard-save"
          >
            {saving ? "Saving..." : "Save details"}
          </button>

          {error ? <div className="wizard-error">{error}</div> : null}
        </div>
      </div>
    </div>
  );
}
