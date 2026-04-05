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

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/authStore";
import { getCrewLockers, removeCrewLocker } from "../api/crewLockersApi";

import { APP_IMAGES, UI_ICONS } from "../assets";
import BackButton from "../components/BackButton";

import "../styles/crewLockers.css";

const ORDER_LOCKER_URL =
  "https://myklm.klm.com/web/inflight-services/opslagfaciliteit";

const LOCKER_HANDBOOK_URL =
  "https://online.keynius.app/home/a0b72ec9-35cb-4e3b-a661-3bf4890a9493";

function safeUpper(v: unknown) {
  return String(v || "").trim().toUpperCase();
}

function fmtEnd(endDtLike: unknown) {
  if (!endDtLike) return "--";
  const d = new Date(String(endDtLike));
  if (Number.isNaN(d.getTime())) return String(endDtLike);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
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
  if (!endDtLike) return null;
  const d = new Date(String(endDtLike));
  if (Number.isNaN(d.getTime())) return null;
  const diff = d.getTime() - Date.now();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function isExpiredLocker(endDtLike: unknown) {
  const days = daysRemaining(endDtLike);
  return typeof days === "number" ? days <= 0 : false;
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

      const aTime = a?.end_dt ? new Date(String(a.end_dt)).getTime() : Infinity;
      const bTime = b?.end_dt ? new Date(String(b.end_dt)).getTime() : Infinity;
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
                : days <= 14
                ? `Ending soon (${days}d)`
                : `Active (${days}d)`
              : l.active
              ? "Active"
              : "--";

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
                        className="crewLockers-openBtn"
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

                  <div className="crewLockers-cardEndRow">End: {endText}</div>
                </div>
              </div>

              <div className="crewLockers-zoneDivider" />

              {/* Line 1 */}
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

              {/* Line 2 */}
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