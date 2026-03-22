import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/authStore";
import { getCrewLockers, removeCrewLocker } from "../api/crewLockersApi";

import { APP_IMAGES } from "../assets";

// ✅ Standard back icon button (same as Week)
import BackButton from "../components/BackButton";

import "../styles/crewLockers.css";

const ORDER_LOCKER_URL =
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

function DetailLine({ label, value }: { label: string; value: any }) {
  if (!value && value !== 0) return null;
  return (
    <div className="crewLockers-detailLine">
      <div className="crewLockers-detailLabel">{label}</div>
      <div className="crewLockers-detailValue">{String(value)}</div>
    </div>
  );
}

export default function CrewLockers() {
  const nav = useNavigate();
  const { auth, psn } = useAuth();

  const isMember = (auth as any)?.mode === "member";
  const staffNo = useMemo(() => safeUpper((auth as any)?.user?.username) || null, [auth]);
  const psnForApi = useMemo(() => (psn ? String(psn) : staffNo ? String(staffNo) : ""), [psn, staffNo]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMember, psnForApi]);

  const list = useMemo(() => {
    const rows = Array.isArray(lockers) ? [...lockers] : [];

    rows.sort((a, b) => {
      const aExpired = isExpiredLocker(a?.end_dt) ? 1 : 0;
      const bExpired = isExpiredLocker(b?.end_dt) ? 1 : 0;

      // Active/expiring first, expired last.
      if (aExpired !== bExpired) return aExpired - bExpired;

      // Within each group, sort by nearest end_dt first.
      const aTime = a?.end_dt ? new Date(String(a.end_dt)).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b?.end_dt ? new Date(String(b.end_dt)).getTime() : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    });

    return rows;
  }, [lockers]);

  function openOrderLockerCard() {
    window.open(ORDER_LOCKER_URL, "_blank", "noopener,noreferrer");
  }

  function askRemoveLocker(locker: any) {
    setConfirmLocker(locker);
    setConfirmOpen(true);
  }

  async function confirmRemoveLocker() {
    if (!confirmLocker || !psnForApi || removing) return;

    setRemoving(true);
    setErrorText("");

    try {
      await removeCrewLocker(psnForApi, String(confirmLocker.locker_uuid || ""));
      setConfirmOpen(false);
      setConfirmLocker(null);
      await load();
    } catch (e: any) {
      setErrorText(e?.message || "Failed to remove locker");
    } finally {
      setRemoving(false);
    }
  }

  function closeConfirm() {
    if (removing) return;
    setConfirmOpen(false);
    setConfirmLocker(null);
  }

  // page is guarded by RequireMember, but keep a safe fallback (same pattern as MyFlights)
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

        {/* Order / additional locker promo card — always first */}
        <button
          type="button"
          className="crewLockers-orderCard"
          onClick={openOrderLockerCard}
          aria-label="Order a locker"
        >
          <div className="crewLockers-orderCardBadge">Order a locker</div>

          <div className="crewLockers-orderCardBody">
           <img
			  src={APP_IMAGES.LOCKERS_QR}
			  alt="Order a locker QR code"
			  className="crewLockers-orderQr"
			/>
          </div>
        </button>

        {list.length === 0 ? (
          <div className="crewLockers-emptyWrap">
            <div className="crewLockers-emptyTitle">No lockers registered</div>
            <div className="crewLockers-emptyBody">
              Forward your Keynius locker email from your <b>@klm.com</b> inbox to <b>lockers@xcmxfa.com</b>.
            </div>
          </div>
        ) : (
          list.map((l) => {
            const end = fmtEnd(l.end_dt);
            const updated = fmtUpdated(l.last_scraped_at);
            const days = daysRemaining(l.end_dt);
            const expired = typeof days === "number" ? days <= 0 : !l.active;

            const status =
              typeof days === "number"
                ? days <= 0
                  ? "Expired"
                  : days <= 14
                  ? `Ending soon (${days}d)`
                  : `Active (${days}d)`
                : l.active
                ? "Active"
                : "--";

            const lockerUrl = String(l.locker_url || "").trim();

            return (
              <div key={String(l.locker_uuid)} className="crewLockers-card">
                <div className="crewLockers-cardTopRow">
                  <div className="crewLockers-cardTitle">{l.locker_number || "Locker"}</div>
                  <div className="crewLockers-cardMeta">{status}</div>
                </div>

                <DetailLine label="End" value={end} />
                <DetailLine label="Wall" value={l.locker_wall ? String(l.locker_wall) : null} />
                <DetailLine label="Size" value={l.locker_size ? String(l.locker_size) : null} />

                <div className="crewLockers-zoneDivider" />

                <div className="crewLockers-actionWrap">
                  {!expired ? (
                    <>
                      <button
                        type="button"
                        className="crewLockers-actionBtn"
                        disabled={!lockerUrl}
                        onClick={() => {
                          if (!lockerUrl) return;
                          window.open(lockerUrl, "_blank", "noopener,noreferrer");
                        }}
                      >
                        Open / manage
                      </button>

                      <button
                        type="button"
                        className="crewLockers-removeBtn"
                        onClick={() => askRemoveLocker(l)}
                      >
                        Remove locker
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="crewLockers-removeBtn crewLockers-removeBtn--primary"
                      onClick={() => askRemoveLocker(l)}
                    >
                      Remove locker
                    </button>
                  )}
                </div>

                <div className="crewLockers-zoneDivider" />

                <div className="crewLockers-updated">Last updated: {updated}</div>
              </div>
            );
          })
        )}
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
                  This will permanently remove locker <b>{String(confirmLocker.locker_number)}</b> from your app.
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