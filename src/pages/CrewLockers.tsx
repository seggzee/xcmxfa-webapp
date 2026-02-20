// src/pages/CrewLockers.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/authStore";
import { getCrewLockers } from "../api/crewLockersApi";

// ✅ Standard back icon button (same as Week)
import BackButton from "../components/BackButton";

import "../styles/crewLockers.css";

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

function daysRemaining(endDtLike: unknown) {
  if (!endDtLike) return null;
  const d = new Date(String(endDtLike));
  if (Number.isNaN(d.getTime())) return null;
  const diff = d.getTime() - Date.now();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
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

  const list = useMemo(() => (Array.isArray(lockers) ? lockers : []), [lockers]);

  // page is guarded by RequireMember, but keep a safe fallback (same pattern as MyFlights)
  if (!isMember) {
    return (
      <div className="crewLockers-page crewLockers-page--guest">
        <div className="crewLockers-titleRow">
          <div className="crewLockers-titleCol">
            <div className="crewLockers-title">Crew lockers</div>
            <div className="crewLockers-status">Member-only page.</div>
          </div>

          {/* ✅ Standard icon back button */}
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

          {/* ✅ Standard icon back button */}
          <BackButton onClick={() => nav(-1)} ariaLabel="Back" size={38} />
        </div>

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
            const days = daysRemaining(l.end_dt);

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
                </div>

                <div className="crewLockers-zoneDivider" />

                <div className="crewLockers-updated">
                  Last updated: {l.last_scraped_at ? String(l.last_scraped_at) : "--"}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}