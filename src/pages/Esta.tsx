// src/pages/Esta.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { UI_ICONS } from "../assets";
import { useAuth } from "../app/authStore";
import { useCrew } from "../app/crewStore";
import { API_BASE_URL, postJson } from "../app/api";
import { useSecureUnlock } from "../hooks/useSecureUnlock";

/**
 * IMPORTANT:
 * Keep this endpoint aligned with your backend.
 * If your PHP file is named differently, change ONLY this constant.
 */
const SAVE_MEMBER_ESTA_URL = `${API_BASE_URL}/api/members/member_esta.php`;

function safeStr(v: any) {
  return (v ?? "") === null ? "" : String(v ?? "");
}

type CrewFx = {
  fx_address?: unknown;
  fx_city?: unknown;
  fx_state?: unknown;
  fx_country?: unknown;
  fx_postcode?: unknown;
  fx_telephone?: unknown;
  fx_green_card_no?: unknown;
  fx_residence_permit_no?: unknown;
  fx_other_info?: unknown;
};

export default function Esta() {
  const nav = useNavigate();
  const { auth } = useAuth();
  const { crew } = useCrew();

  const isMember = auth?.mode === "member";

  const psn = useMemo(() => {
    return String(auth?.user?.username || crew?.psn || "")
      .trim()
      .toUpperCase();
  }, [auth?.user?.username, crew?.psn]);

  const { unlocked, unlock } = useSecureUnlock();

  const [fx_address, setfx_address] = useState("");
  const [fx_city, setfx_city] = useState("");
  const [fx_state, setfx_state] = useState("");
  const [fx_country, setfx_country] = useState("");
  const [fx_postcode, setfx_postcode] = useState("");
  const [fx_telephone, setfx_telephone] = useState("");
  const [fx_green_card_no, setfx_green_card_no] = useState("");
  const [fx_residence_permit_no, setfx_residence_permit_no] = useState("");
  const [fx_other_info, setfx_other_info] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // ✅ RN parity: prefill does NOT depend on unlocked (lock only gates rendering)
  useEffect(() => {
    if (!isMember) return;

    const fx = (crew as any)?.fx as CrewFx | null | undefined;
    if (!fx) return;

    setfx_address(safeStr(fx.fx_address));
    setfx_city(safeStr(fx.fx_city));
    setfx_state(safeStr(fx.fx_state));
    setfx_country(safeStr(fx.fx_country));
    setfx_postcode(safeStr(fx.fx_postcode));
    setfx_telephone(safeStr(fx.fx_telephone));
    setfx_green_card_no(safeStr(fx.fx_green_card_no));
    setfx_residence_permit_no(safeStr(fx.fx_residence_permit_no));
    setfx_other_info(safeStr(fx.fx_other_info));
  }, [crew, isMember]);

  function validate() {
    if (!isMember) return "Members only.";
    if (!psn) return "Missing PSN.";
    if (!fx_address.trim()) return "Foreign address is required.";
    if (!fx_city.trim()) return "Foreign address is required.";
    if (!fx_state.trim()) return "Foreign address is required.";
    if (!fx_country.trim()) return "Foreign address is required.";
    if (!fx_postcode.trim()) return "Foreign address is required.";
    if (!fx_telephone.trim()) return "Foreign contact number is required.";
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
        fx_address: fx_address.trim(),
        fx_city: fx_city.trim(),
        fx_state: fx_state.trim(),
        fx_country: fx_country.trim(),
        fx_postcode: fx_postcode.trim(),
        fx_telephone: fx_telephone.trim(),
        fx_green_card_no: fx_green_card_no.trim(),
        fx_residence_permit_no: fx_residence_permit_no.trim(),
        fx_other_info: fx_other_info.trim(),
      };

      const token = String(auth?.accessToken || "").trim();
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      await postJson(SAVE_MEMBER_ESTA_URL, payload, headers);
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
          <div className="text-title">Residence information</div>

          <button className="btn btn-secondary" onClick={() => nav(-1)} disabled={busy}>
            Back
          </button>
        </div>

        <div className="passport-sub">
          ESTA / FX details are required for United States and Canada. Please enter the details
          exactly as shown on your residence documents / visa
        </div>

        {!isMember ? (
          <div className="card wizard-warning">
            <div className="wizard-warning-title">Members only</div>
            <div className="wizard-warning-body">
              Please sign in as a member to add or edit esta details.
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
              <div className="profile-section-title">House No. and Street</div>
              <input
                value={fx_address}
                onChange={(e) => setfx_address(e.target.value)}
                placeholder="e.g. 100101 Westminster Court"
                disabled={busy}
                className="wizard-input"
                style={{ textTransform: "uppercase" }}
              />
            </div>

            <div className="passport-field">
              <div className="profile-section-title">City</div>
              <input
                value={fx_city}
                onChange={(e) => setfx_city(e.target.value)}
                placeholder="e.g. Owings Mills"
                disabled={busy}
                className="wizard-input"
                style={{ textTransform: "uppercase" }}
              />
            </div>

            <div className="passport-field">
              <div className="profile-section-title">State</div>
              <input
                value={fx_state}
                onChange={(e) => setfx_state(e.target.value)}
                placeholder="e.g. Nevada"
                disabled={busy}
                className="wizard-input"
                style={{ textTransform: "uppercase" }}
              />
            </div>

            <div className="passport-field">
              <div className="profile-section-title">Country</div>
              <input
                value={fx_country}
                onChange={(e) => setfx_country(e.target.value)}
                placeholder="e.g. USA"
                disabled={busy}
                className="wizard-input"
                style={{ textTransform: "uppercase" }}
              />
            </div>

            <div className="passport-field">
              <div className="profile-section-title">Postcode</div>
              <input
                value={fx_postcode}
                onChange={(e) => setfx_postcode(e.target.value)}
                placeholder="e.g. 11201"
                disabled={busy}
                className="wizard-input"
                style={{ textTransform: "uppercase" }}
              />
            </div>

            <div className="passport-field">
              <div className="profile-section-title">Telephone</div>
              <input
                value={fx_telephone}
                onChange={(e) => setfx_telephone(e.target.value)}
                placeholder="e.g. +1 234 567 8990"
                disabled={busy}
                className="wizard-input"
                style={{ textTransform: "uppercase" }}
              />
            </div>

            <div className="passport-field">
              <div className="profile-section-title">Green Card No.</div>
              <input
                value={fx_green_card_no}
                onChange={(e) => setfx_green_card_no(e.target.value)}
                placeholder="USA only"
                disabled={busy}
                className="wizard-input"
                style={{ textTransform: "uppercase" }}
              />
            </div>

            <div className="passport-field">
              <div className="profile-section-title">Residence permit No.</div>
              <input
                value={fx_residence_permit_no}
                onChange={(e) => setfx_residence_permit_no(e.target.value)}
                placeholder="USA / Canada only"
                disabled={busy}
                className="wizard-input"
                style={{ textTransform: "uppercase" }}
              />
            </div>

            <div className="passport-field">
              <div className="profile-section-title">Other info / Visa details</div>
              <input
                value={fx_other_info}
                onChange={(e) => setfx_other_info(e.target.value)}
                placeholder="other free text"
                disabled={busy}
                className="wizard-input"
              />
            </div>

            {error ? <div className="wizard-error">{error}</div> : null}

            <button
              type="button"
              className="btn btn-primary passport-saveBtn"
              onClick={handleSave}
              disabled={busy}
            >
              {busy ? "Saving..." : "Save residence information"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
