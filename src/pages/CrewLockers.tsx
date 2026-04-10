// FILE: src/pages/CrewLockers.tsx
//
// PURPOSE
// - Crew lockers page
//
// THIS CHANGE ONLY
// - Tighten top 2-chip card so it sits closer to Home proportions
// - Restructure locker cards into:
//     * top action zone
//     * divider
//     * bottom metadata zone
// - Keep page logic/API behaviour unchanged
// - Restore remove-locker confirm modal
// - FIX metadata rendering (robust, no metaParts, no index shifting)
// - FIX end_dt handling so DATE values are not shifted by timezone
// - ALSO support end_dt when backend returns local datetime strings like YYYY-MM-DD HH:MM:SS
// - Add dedicated Days left pill on the right side of the metadata zone
// - Use same pill family for Days left and Open / manage
// - Days pill variants:
//     * green  > 14 days
//     * amber  1-14 days
//     * red    expired
//     * grey   unknown
// - Status text on left remains simple ("Active" / "Expired" / "--")

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/authStore";
import { getCrewLockers, removeCrewLocker } from "../api/crewLockersApi";

import { APP_IMAGES, UI_ICONS } from "../assets";
import BackButton from "../components/BackButton";

import "../styles/crewLockers.css";

const ORDER_LOCKER_URL =
  "https://online.keynius.app/home/a0b72ec9-35cb-4e3b-a661-3bf4890a9493";

const LOCKER_HANDBOOK_URL =
  "https://myklm.klm.com/web/inflight-services/opslagfaciliteit";

function safeUpper(v: unknown) {
  return String(v || "").trim().toUpperCase();
}

function parseLocalDateLike(v: unknown) {
  const raw = String(v || "").trim();
  if (!raw) return null;

  // Supports:
  // - YYYY-MM-DD
  // - YYYY-MM-DD HH:MM
  // - YYYY-MM-DD HH:MM:SS
  // - YYYY-MM-DDTHH:MM
  // - YYYY-MM-DDTHH:MM:SS
  const m = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (m) {
    const yyyy = Number(m[1]);
    const mm = Number(m[2]);
    const dd = Number(m[3]);

    const hh = m[4] !== undefined ? Number(m[4]) : 12;
    const mi = m[5] !== undefined ? Number(m[5]) : 0;
    const ss = m[6] !== undefined ? Number(m[6]) : 0;

    const d = new Date(yyyy, mm - 1, dd, hh, mi, ss, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtEnd(endDtLike: unknown) {
  const raw = String(endDtLike || "").trim();
  if (!raw) return "--";

  const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const dd = ymdMatch[3];
    const mm = Number(ymdMatch[2]) - 1;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${dd} ${months[mm] || ""}`.trim();
  }

  const dtMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T]\d{2}:\d{2}(?::\d{2})?$/);
  if (dtMatch) {
    const dd = dtMatch[3];
    const mm = Number(dtMatch[2]) - 1;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${dd} ${months[mm] || ""}`.trim();
  }

  return "--";
}

function fmtUpdated(updatedLike: unknown) {
  if (!updatedLike) return "--";
  const d = new Date(String(updatedLike));
  if (Number.isNaN(d.getTime())) return String(updatedLike);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function daysRemaining(endDtLike: unknown) {
  const d = parseLocalDateLike(endDtLike);
  if (!d) return null;

  const diff = d.getTime() - Date.now();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function isExpiredLocker(endDtLike: unknown) {
  const days = daysRemaining(endDtLike);
  return typeof days === "number" ? days <= 0 : false;
}

function endDtSortValue(v: unknown) {
  const d = parseLocalDateLike(v);
  return d ? d.getTime() : Number.POSITIVE_INFINITY;
}

function daysPillVariant(days: number | null): "green" | "amber" | "red" | "grey" {
  if (typeof days !== "number") return "grey";
  if (days <= 0) return "red";
  if (days <= 14) return "amber";
  return "green";
}

function daysPillText(days: number | null) {
  if (typeof days !== "number") return "— —";
  if (days <= 0) return "Expired";
  return String(days);
}

export default function CrewLockers() {
  const nav = useNavigate();
  const { auth, psn } = useAuth();

  const isMember = (auth as any)?.mode === "member";
  const staffNo = useMemo(
    () => safeUpper((auth as any)?.user?.username) || null,
    [auth]
  );
  const psnForApi = useMemo(
    () => (psn ? String(psn) : staffNo ? String(staffNo) : ""),
    [psn, staffNo]
  );

  const [lockers, setLockers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLocker, setConfirmLocker] = useState<any | null>(null);
  const [removing, setRemoving] = useState(false);

  async function load() {
    if (!psnForApi) return;

    setLoading(true);
    setErrorText("");

    try {
      const resp: any = await getCrewLockers(psnForApi);
      const rows = Array.isArray(resp?.lockers) ? resp.lockers : [];
      setLockers(rows);
    } catch (e: any) {
      setErrorText(e?.message || "Failed to load crew lockers");
      setLockers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      if (!isMember) return;
      await load();
    })();
    return () => {
      alive = false;
    };
  }, [isMember, psnForApi]);

  const list = useMemo(() => {
    const rows = Array.isArray(lockers) ? [...lockers] : [];

    rows.sort((a, b) => {
      const aExpired = isExpiredLocker(a?.end_dt) ? 1 : 0;
      const bExpired = isExpiredLocker(b?.end_dt) ? 1 : 0;
      if (aExpired !== bExpired) return aExpired - bExpired;

      const aTime = a?.end_dt ? endDtSortValue(a.end_dt) : Number.POSITIVE_INFINITY;
      const bTime = b?.end_dt ? endDtSortValue(b.end_dt) : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    });

    return rows;
  }, [lockers]);

  function openOrderLockerCard() {
    window.open(ORDER_LOCKER_URL, "_blank", "noopener,noreferrer");
  }

  function openLockerBrochure() {
    window.open(LOCKER_HANDBOOK_URL, "_blank", "noopener,noreferrer");
  }

  function askRemoveLocker(locker: any) {
    setConfirmLocker(locker);
    setConfirmOpen(true);
  }

  async function confirmRemoveLocker() {
    if (!confirmLocker || !psnForApi || removing) return;

    setRemoving(true);
    try {
      await removeCrewLocker(psnForApi, String(confirmLocker.locker_uuid || ""));
      setConfirmOpen(false);
      setConfirmLocker(null);
      await load();
    } finally {
      setRemoving(false);
    }
  }

  function closeConfirm() {
    if (removing) return;
    setConfirmOpen(false);
    setConfirmLocker(null);
  }

  if (!isMember) {
    return (
      <div className="crewLockers-page crewLockers-page--guest">
        <div className="crewLockers-titleRow">
          <div className="crewLockers-titleCol">
            <div className="crewLockers-title">Crew lockers</div>
            <div className="crewLockers-status">Member-only page.</div>
          </div>
          <BackButton onClick={() => nav(-1)} ariaLabel="Back" size={38} />
        </div>
      </div>
    );
  }

  return (
    <div className="crewLockers-page">
      <div className="crewLockers-scroll">
        <div className="crewLockers-titleRow">
          <div className="crewLockers-titleCol">
            <div className="crewLockers-title">Crew lockers</div>

            {loading ? (
              <div className="crewLockers-status">Loading your lockers…</div>
            ) : errorText ? (
              <div className="crewLockers-status">{errorText}</div>
            ) : null}
          </div>

          <BackButton onClick={() => nav(-1)} ariaLabel="Back" size={38} />
        </div>

        <div className="crewLockers-topCard">
          <div className="crewLockers-topTitle">Access & setup</div>

          <div className="crewLockers-topGrid">
            <button type="button" className="crewLockers-topChip" onClick={openLockerBrochure}>
              <div className="crewLockers-topChipMedia">
                <img src={APP_IMAGES.LOCKER} alt="" className="crewLockers-topChipImg" />
              </div>
              <div className="crewLockers-topChipLabel">Lockers handbook</div>
            </button>

            <button type="button" className="crewLockers-topChip" onClick={openOrderLockerCard}>
              <div className="crewLockers-topChipMedia">
                <img src={APP_IMAGES.LOCKERS_QR} alt="" className="crewLockers-topChipImg" />
              </div>
              <div className="crewLockers-topChipLabel">Order a locker</div>
            </button>
          </div>
        </div>

        {list.map((l) => {
          const endText = fmtEnd(l.end_dt);
          const updatedText = fmtUpdated(l.last_scraped_at);

          const days = daysRemaining(l.end_dt);
          const expired = typeof days === "number" ? days <= 0 : !l.active;

          const statusText =
            typeof days === "number"
              ? days <= 0
                ? "Expired"
                : "Active"
              : l.active
              ? "Active"
              : "--";

          const daysVariant = daysPillVariant(days);
          const daysText = daysPillText(days);

          const lockerTypeText = l.locker_size ? String(l.locker_size) : "";
          const locationText = l.locker_wall ? String(l.locker_wall) : "";

          const lockerUrl = String(l.locker_url || "").trim();

          return (
            <div key={String(l.locker_uuid)} className="crewLockers-cardHorizontal">
              <div className="crewLockers-cardTopZone">
                <div className="crewLockers-cardIconWrap">
                  <img src={UI_ICONS.locker} alt="" className="crewLockers-cardIcon" />
                </div>

                <div className="crewLockers-cardActionBlock">
                  <div className="crewLockers-cardActionRow">
                    <div className="crewLockers-cardTitle">
                      {l.locker_number || "Locker"}
                    </div>

                    {!expired ? (
                      <button
                        type="button"
                        className="crewLockers-pill crewLockers-pill--green"
                        disabled={!lockerUrl}
                        onClick={() => {
                          if (!lockerUrl) return;
                          window.open(lockerUrl, "_blank", "noopener,noreferrer");
                        }}
                      >
                        Open / manage
                      </button>
                    ) : null}
                  </div>

                  <div className="crewLockers-cardEndRow">Ends: {endText}</div>
                </div>
              </div>

              <div className="crewLockers-zoneDivider" />

              <div className="crewLockers-metaRow">
                <div className="crewLockers-metaLeft">
                  <div className="crewLockers-cardMetaLine">
                    {lockerTypeText && (
                      <span className="crewLockers-cardMetaItem">{lockerTypeText}</span>
                    )}

                    {lockerTypeText && statusText && (
                      <span className="crewLockers-cardMetaBullet">•</span>
                    )}

                    {statusText && (
                      <span className="crewLockers-cardMetaItem">{statusText}</span>
                    )}
                  </div>

                  {locationText && (
                    <div className="crewLockers-cardMetaLine">
                      <span className="crewLockers-cardMetaItem">{locationText}</span>
                    </div>
                  )}

                  <div className="crewLockers-updated">Last refreshed: {updatedText}</div>

                  <button
                    type="button"
                    className="crewLockers-removeLink"
                    onClick={() => askRemoveLocker(l)}
                  >
                    Remove locker
                  </button>
                </div>

                <div className="crewLockers-daysBlock">
                  <div className={`crewLockers-daysLabel crewLockers-daysLabel--${daysVariant}`}>
                    Days left
                  </div>

                  <div className={`crewLockers-pill crewLockers-pill--${daysVariant}`}>
                    {daysText}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {confirmOpen && confirmLocker ? (
        <div
          className="crewLockers-confirmOverlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeConfirm();
          }}
        >
          <div
            className="crewLockers-confirmModal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="crewLockers-confirmTitle">Remove locker?</div>

            <div className="crewLockers-confirmBody">
              {confirmLocker.locker_number ? (
                <>
                  This will permanently remove locker{" "}
                  <b>{String(confirmLocker.locker_number)}</b> from your app.
                </>
              ) : (
                <>This will permanently remove this locker from your app.</>
              )}
            </div>

            <div className="crewLockers-confirmHint">This action cannot be undone.</div>

            <div className="crewLockers-confirmActions">
              <button
                type="button"
                className="crewLockers-confirmCancel"
                onClick={closeConfirm}
                disabled={removing}
              >
                Cancel
              </button>

              <button
                type="button"
                className="crewLockers-confirmDelete"
                onClick={() => void confirmRemoveLocker()}
                disabled={removing}
              >
                {removing ? "Removing…" : "Remove locker"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}