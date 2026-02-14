// src/pages/Passport.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { UI_ICONS } from "../assets";
import { useAuth } from "../app/authStore";
import { useCrew } from "../app/crewStore";
import { COUNTRY_AIRPORTS } from "../data/airports";
import { API_BASE_URL, postJson } from "../app/api";
import { useSecureUnlock } from "../hooks/useSecureUnlock";

function safeStr(v: any) {
  return (v ?? "") === null ? "" : String(v ?? "");
}

function isYMD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

function toYMD(d: Date) {
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const SAVE_MEMBER_PASSPORT_URL = `${API_BASE_URL}/api/members/member_passport.php`;

type CrewPassport = {
  passport_name?: unknown;
  passport_number?: unknown;
  d_o_b?: unknown;
  nationality?: unknown;
  passport_expiry?: unknown;
};

export default function Passport() {
  const nav = useNavigate();
  const { auth } = useAuth();
  const { crew } = useCrew();

  const isMember = auth?.mode === "member";

  const psn = useMemo(() => {
    return String(auth?.user?.username || crew?.psn || "")
      .trim()
      .toUpperCase();
  }, [auth?.user?.username, crew?.psn]);

  const countries = useMemo(() => {
    const keys = Object.keys(COUNTRY_AIRPORTS || {});
    const cleaned = keys.map((c) => String(c || "").trim()).filter(Boolean);
    cleaned.sort((a, b) => a.localeCompare(b));
    return cleaned;
  }, []);

  const { unlocked, unlock } = useSecureUnlock();

  const [passportNumber, setPassportNumber] = useState("");
  const [passportName, setPassportName] = useState("");
  const [dob, setDob] = useState(""); // YYYY-MM-DD
  const [passportExpiry, setPassportExpiry] = useState(""); // YYYY-MM-DD
  const [nationality, setNationality] = useState("");

  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter((c) => c.toLowerCase().includes(q));
  }, [countries, countryQuery]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // ✅ RN parity: prefill does NOT depend on unlocked (lock only gates rendering)
  useEffect(() => {
    if (!isMember) return;

    const p = (crew as any)?.passport as CrewPassport | null | undefined;
    if (!p) return;

    setPassportName(safeStr(p.passport_name));
    setPassportNumber(safeStr(p.passport_number));

    const dobRaw = safeStr(p.d_o_b);
    setDob(dobRaw ? toYMD(new Date(dobRaw)) : "");

    setNationality(safeStr(p.nationality));

    const expRaw = safeStr(p.passport_expiry);
    setPassportExpiry(expRaw ? toYMD(new Date(expRaw)) : "");
  }, [crew, isMember]);

  function validate(): string {
    if (!isMember) return "Members only.";
    if (!psn) return "Missing PSN.";
    if (!passportNumber.trim()) return "Passport number is required.";
    if (!passportName.trim()) return "Passport name(s) is required.";
    if (!dob.trim() || !isYMD(dob.trim())) return "DOB must be YYYY-MM-DD.";
    if (!nationality.trim()) return "Nationality is required.";
    if (!passportExpiry.trim() || !isYMD(passportExpiry.trim()))
      return "Expiry must be YYYY-MM-DD.";
    return "";
  }

  async function handleSave() {
    if (busy) return;

    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    try {
      setBusy(true);
      setError("");

      const payload = {
        psn,
        passport_number: passportNumber.trim(),
        passport_name: passportName.trim(),
        d_o_b: dob.trim(),
        nationality: nationality.trim(),
        passport_expiry: passportExpiry.trim(),
      };

      const token = String(auth?.accessToken || "").trim();
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      await postJson(SAVE_MEMBER_PASSPORT_URL, payload, headers);
    } catch (e: any) {
      setError(e?.message || "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-screen profile-page">
      <div className="app-container">
        <div className="profile-top">
          <div className="text-title">Passport information</div>

          <button className="btn btn-secondary" onClick={() => nav(-1)} disabled={busy}>
            Back
          </button>
        </div>

        <div className="passport-sub">Enter details exactly as shown in your passport.</div>

        {!isMember ? (
          <div className="card wizard-warning">
            <div className="wizard-warning-title">Members only</div>
            <div className="wizard-warning-body">
              Please sign in as a member to add or edit passport details.
            </div>
          </div>
        ) : !unlocked ? (
          <div className="card passport-lockCard passport-lockCard--center">
            <img
              src={UI_ICONS.STOP_SIGN}
              alt="Security"
              className="passport-lockIconCenter"
            />
            <div className="passport-lockTitleCenter">Security sensitive information!</div>
            <div className="passport-lockBodyCenter">
              Passport and Residence information are protected.
            </div>
            <button type="button" className="passport-unlockLink" onClick={unlock}>
              Unlock to continue
            </button>
          </div>
        ) : (
          <div className="card">
            <div className="profile-section-title">PSN (Staff Number)</div>
            <input
              value={psn}
              readOnly
              disabled
              className="wizard-input wizard-input--readonly"
            />

            <div className="passport-field">
              <div className="profile-section-title">Full name in passport</div>
              <input
                value={passportName}
                onChange={(e) => setPassportName(e.target.value)}
                placeholder="e.g. David Klaas Somebody"
                disabled={busy}
                className="wizard-input"
                style={{ textTransform: "uppercase" }}
              />
            </div>

            <div className="passport-field">
              <div className="profile-section-title">Date of birth</div>
              <input
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                disabled={busy}
                className="wizard-input"
                type="date"
              />
            </div>

            <div className="passport-field">
              <div className="profile-section-title">Passport number</div>
              <input
                value={passportNumber}
                onChange={(e) => setPassportNumber(e.target.value)}
                placeholder="e.g. N1234567"
                disabled={busy}
                className="wizard-input"
                style={{ textTransform: "uppercase" }}
              />
            </div>

            <div className="passport-field">
              <div className="profile-section-title">Passport issuing country</div>

              <button
                type="button"
                className="profile-row"
                onClick={() => {
                  if (busy) return;
                  setCountryQuery("");
                  setCountryModalOpen(true);
                }}
                disabled={busy}
              >
                <span>{nationality || "Select country"}</span>
                <span className="profile-chevron">›</span>
              </button>
            </div>

            <div className="passport-field">
              <div className="profile-section-title">Passport expiry date</div>
              <input
                value={passportExpiry}
                onChange={(e) => setPassportExpiry(e.target.value)}
                disabled={busy}
                className="wizard-input"
                type="date"
              />
            </div>

            {error ? <div className="wizard-error">{error}</div> : null}

            <button
              type="button"
              className="btn btn-primary passport-saveBtn"
              onClick={handleSave}
              disabled={busy}
            >
              {busy ? "Saving..." : "Save passport information"}
            </button>
          </div>
        )}

        {countryModalOpen ? (
          <div className="wizard-modalOverlay" onClick={() => setCountryModalOpen(false)}>
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
                      className={`wizard-listRow ${
                        nationality === c ? "wizard-listRow--active" : ""
                      }`}
                      onClick={() => {
                        setNationality(c);
                        setCountryModalOpen(false);
                      }}
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
                  className="btn btn-secondary"
                  onClick={() => setCountryModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
