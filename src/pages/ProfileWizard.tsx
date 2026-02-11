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
// (If you later want Dutch particles lowercased, we can add that rule.)
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

  // Remove spaces/dashes for parsing
  const compact = raw.replace(/[^\d+]/g, "");

  // Find a matching code from our list (longest match first)
  const codes = [...PHONE_CODES].map((x) => x.code).sort((a, b) => b.length - a.length);
  const match = codes.find((c) => compact.startsWith(c));
  if (match) {
    const digits = compact.slice(match.length).replace(/\D/g, "");
    return { code: match, digits };
  }

  // Fallback: if it starts with +, keep +31 default and use remaining digits
  if (compact.startsWith("+")) {
    const digits = compact.replace(/\D/g, "");
    return { code: "+31", digits };
  }

  // Fallback: treat as local digits
  return { code: "+31", digits: compact.replace(/\D/g, "") };
}

export default function ProfileWizard() {
  const nav = useNavigate();
  const { auth, routeReason, setRouteReason, onboardingUsername } = useAuth();
  const { crew, loadCrew } = useCrew();

  // 1) PSN / identity key
  const psn = useMemo(() => {
    return String(crew?.psn || onboardingUsername || auth?.user?.username || "")
      .trim()
      .toUpperCase();
  }, [crew?.psn, onboardingUsername, auth?.user?.username]);

  // 2) Countries list (keys of COUNTRY_AIRPORTS, sorted)
  const countries = useMemo(() => {
    const keys = Object.keys(COUNTRY_AIRPORTS || {});
    const cleaned = keys.map((c) => String(c || "").trim()).filter(Boolean);
    cleaned.sort((a, b) => a.localeCompare(b));
    return cleaned;
  }, []);

  // 3) Initial values: prefill from crew cache
  const initial = crew || {};

  const [saving, setSaving] = useState(false);

  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");

  // Title MUST be one of 4 options (locked select)
  const [title, setTitle] = useState(String(initial?.title || ""));

  const [firstName, setFirstName] = useState(
    String(initial?.firstname || initial?.firstName || "")
  );
  const [lastName, setLastName] = useState(
    String(initial?.lastname || initial?.lastName || "")
  );

  const [email, setEmail] = useState(String(initial?.email || ""));

  // Telephone split inputs
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

  // Combine phone into international format. Store without spaces for backend stability.
  const telephoneCombined = useMemo(() => {
    const d = (phoneDigits || "").replace(/\D/g, "");
    return d ? `${phoneCode}${d}` : "";
  }, [phoneCode, phoneDigits]);

  function validateGeneral(): string | null {
    if (!psn) return "Missing PSN / staff number.";

    // Title must be locked to 4 options
    if (!title) return "Please select a title.";
    if (!["Mr", "Mrs", "Ms", "Mx"].includes(title)) return "Invalid title selection.";

    if (!firstName.trim()) return "Please enter first name.";
    if (!lastName.trim()) return "Please enter last name.";

    const emailLower = normalizeEmail(email);
    if (!emailLower) return "Please enter email.";
    if (!isValidKlmEmail(emailLower))
      return "Email must be name.surname@klm.com or name.surname@transavia.com";

    // Telephone must be in international format components
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
      telephone: telephoneCombined, // ✅ international format, e.g. +31612345678
    };

    try {
      setSaving(true);

      // ✅ IMPORTANT: FLAT JSON (do NOT wrap in { payload: ... })
      await postJson(SAVE_MEMBER_GENERAL_URL, generalPayload);

      await loadCrew(psn);

      // Onboarding complete: clear pending onboarding
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
    <div style={{ padding: 24, maxWidth: 620 }}>
      <h2>Complete your details</h2>

      {!isMember ? (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #f59e0b", borderRadius: 12 }}>
          <strong>Members only</strong>
          <div style={{ marginTop: 6 }}>Please log in to complete your profile.</div>
        </div>
      ) : null}

      {/* PSN display (read-only) */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>PSN / Staff identity</div>
        <input
          value={psn}
          readOnly
          disabled
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#f3f4f6",
            fontWeight: 800,
          }}
        />
      </div>

      {/* Title (LOCKED SELECT) */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Title</div>
        <select
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={saving}
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
        >
          <option value="">Select title…</option>
          <option value="Mr">Mr</option>
          <option value="Mrs">Mrs</option>
          <option value="Ms">Ms</option>
          <option value="Mx">Mx</option>
        </select>
      </div>

      {/* First + last name (auto-capitalise on blur) */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>First name</div>
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          onBlur={() => setFirstName(titleCaseWords(firstName))}
          disabled={saving}
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Last name</div>
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          onBlur={() => setLastName(titleCaseWords(lastName))}
          disabled={saving}
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
        />
      </div>

      {/* Email */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Email</div>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={saving}
          autoCapitalize="none"
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
        />
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
          name.surname (@klm.com or @transavia.com)
        </div>
      </div>

      {/* Telephone (2-part: code + digits) */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Telephone</div>

        <div style={{ display: "flex", gap: 10 }}>
          <select
            value={phoneCode}
            onChange={(e) => setPhoneCode(e.target.value)}
            disabled={saving}
            style={{
              width: 210,
              padding: 12,
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              fontWeight: 800,
            }}
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
              // keep it digits-only as user types
              const digitsOnly = e.target.value.replace(/\D/g, "");
              setPhoneDigits(digitsOnly);
            }}
            inputMode="numeric"
            placeholder="digits only"
            disabled={saving}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 10,
              border: "1px solid #ddd",
            }}
          />
        </div>

        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
          Stored as: <strong>{telephoneCombined || "(empty)"}</strong>
        </div>
      </div>

      {/* Employer pills */}
      <div style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Employer</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => setEmployer("KLM")}
            disabled={saving}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 999,
              border: "1px solid #ddd",
              background: employer === "KLM" ? "#e9f1ff" : "#fff",
              fontWeight: 900,
            }}
          >
            KLM / KLC
          </button>
          <button
            type="button"
            onClick={() => setEmployer("TRANSAVIA")}
            disabled={saving}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 999,
              border: "1px solid #ddd",
              background: employer === "TRANSAVIA" ? "#e9f1ff" : "#fff",
              fontWeight: 900,
            }}
          >
            Transavia
          </button>
        </div>
      </div>

      {/* Job function pills */}
      <div style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Job function</div>
        <div style={{ display: "flex", gap: 10 }}>
          {["Cockpit crew", "Cabin crew"].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setJobFunction(v)}
              disabled={saving}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 999,
                border: "1px solid #ddd",
                background: jobFunction === v ? "#e9f1ff" : "#fff",
                fontWeight: 900,
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Country selection */}
      <div style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>XCM / XFA country</div>

        <button
          type="button"
          onClick={() => {
            setCountryQuery("");
            setCountryModalOpen(true);
          }}
          disabled={saving}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "1px solid #ddd",
            textAlign: "left",
            background: "#fff",
            fontWeight: 900,
          }}
        >
          {xBase || "Select country"}
        </button>

        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
          Main country for xcm / xfa travel
        </div>
      </div>

      {/* Modal (simple overlay) */}
      {countryModalOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 16,
            zIndex: 999,
          }}
          onClick={() => setCountryModalOpen(false)}
        >
          <div
            style={{
              width: "min(720px, 100%)",
              maxHeight: "80vh",
              background: "#fff",
              borderRadius: 16,
              border: "1px solid #e6e9ee",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: 14, borderBottom: "1px solid #eee" }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>Select country</div>

              <input
                value={countryQuery}
                onChange={(e) => setCountryQuery(e.target.value)}
                placeholder="Search…"
                style={{
                  width: "100%",
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #ddd",
                }}
              />
            </div>

            <div style={{ padding: 14, overflow: "auto", maxHeight: "60vh" }}>
              {countries.length ? (
                filteredCountries.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setXBase(c);
                      setCountryModalOpen(false);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid #eee",
                      background: xBase === c ? "#e9f1ff" : "#fff",
                      fontWeight: 900,
                      marginBottom: 8,
                      cursor: "pointer",
                    }}
                  >
                    {c}
                  </button>
                ))
              ) : (
                <div style={{ opacity: 0.75 }}>No countries available.</div>
              )}
            </div>

            <div style={{ padding: 14, borderTop: "1px solid #eee", display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setCountryModalOpen(false)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  background: "#fff",
                  fontWeight: 900,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Passport/ESTA note */}
      <div style={{ marginTop: 18, padding: 14, border: "1px solid #eee", borderRadius: 14 }}>
        <div style={{ fontWeight: 900 }}>Passport &amp; Travel documents</div>
        <div style={{ marginTop: 8, opacity: 0.85 }}>
          Passport and ESTA details are stored separately. ESTA/residence details are only required
          for United States and Canada. Please complete passport details from profile page.
        </div>
      </div>

      {/* Buttons */}
      <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onPrevious}
            disabled={saving}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "#fff",
              fontWeight: 900,
            }}
          >
            Previous page
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 12,
              border: "1px solid #f5d0a8",
              background: "#fff7ed",
              fontWeight: 900,
            }}
          >
            Cancel
          </button>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: 14,
            borderRadius: 999,
            border: "1px solid #bbf7d0",
            background: "#dcfce7",
            fontWeight: 900,
          }}
        >
          {saving ? "Saving..." : "Save details"}
        </button>

        {error ? (
          <div style={{ color: "#b91c1c", fontWeight: 900, fontSize: 13 }}>
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
