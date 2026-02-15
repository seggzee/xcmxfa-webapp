import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/authStore";
import { getCrewLockers } from "../api/crewLockersApi";

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

export default function CrewLockers() {
  const nav = useNavigate();
  const { auth, psn } = useAuth();

  const isMember = auth.mode === "member";
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
      if (!isMember) return; // page is guarded, but keep parity with MyFlights
      await load();
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMember, psnForApi]);

  const list = useMemo(() => (Array.isArray(lockers) ? lockers : []), [lockers]);

  if (!isMember) {
    return (
      <div style={{ minHeight: "100vh", background: "#f6f7f9", padding: 24 }}>
        <div style={{ ...styles.pageTitle, fontSize: 20 }}>Crew lockers</div>
        <div style={{ marginTop: 6, ...styles.subtleStatusText }}>Member-only page.</div>
        <button type="button" style={{ ...styles.backBtn }} onClick={() => nav(-1)}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f9" }}>
      <div style={styles.scroll as any}>
        <div style={styles.pageTitleRow as any}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.pageTitle as any}>Crew lockers</div>

            {loading ? (
              <div style={styles.subtleStatusText as any}>Loading your lockers…</div>
            ) : errorText ? (
              <div style={styles.subtleStatusText as any}>{errorText}</div>
            ) : null}
          </div>

          <button type="button" style={styles.backBtn as any} onClick={() => nav(-1)}>
            Back
          </button>
        </div>

        {list.length === 0 ? (
          <div style={styles.emptyWrap as any}>
            <div style={styles.emptyTitle as any}>No lockers registered</div>
            <div style={styles.emptyBody as any}>
              Forward your Keynius locker email from your <b>@klm.com</b> inbox to{" "}
              <b>lockers@xcmxfa.com</b>.
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

            return (
              <div key={String(l.locker_uuid)} style={styles.card as any}>
                <div style={styles.cardTopRow as any}>
                  <div style={styles.cardTitle as any}>{l.locker_number || "Locker"}</div>
                  <div style={styles.cardMeta as any}>{status}</div>
                </div>

                <div style={styles.detailLine as any}>
                  <div style={styles.detailLabel as any}>End</div>
                  <div style={styles.detailValue as any}>{end}</div>
                </div>

                {l.locker_wall ? (
                  <div style={styles.detailLine as any}>
                    <div style={styles.detailLabel as any}>Wall</div>
                    <div style={styles.detailValue as any}>{String(l.locker_wall)}</div>
                  </div>
                ) : null}

                {l.locker_size ? (
                  <div style={styles.detailLine as any}>
                    <div style={styles.detailLabel as any}>Size</div>
                    <div style={styles.detailValue as any}>{String(l.locker_size)}</div>
                  </div>
                ) : null}

                <div style={styles.zoneDivider as any} />

                <div style={styles.zone6Wrap as any}>
                  <button
                    type="button"
                    onClick={() => {
                      const u = String(l.locker_url || "").trim();
                      if (!u) return;
                      window.open(u, "_blank", "noopener,noreferrer");
                    }}
                    style={{
                      ...(styles.actionBtn as any),
                      ...(styles.actionBtnGreen as any),
                    }}
                  >
                    Open / manage
                  </button>
                </div>

                <div style={styles.zoneDivider as any} />

                <div style={{ ...styles.subtleStatusText, marginTop: 10 }}>
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

const styles: Record<string, React.CSSProperties> = {
  // Mirror MyFlights rhythm
  scroll: { padding: 16, paddingBottom: 40, marginTop: 5 },

  pageTitle: { fontWeight: 900, fontSize: 20, color: "#132333" },
  subtleStatusText: { marginTop: 4, fontWeight: 800, fontSize: 12, color: "rgba(19,35,51,0.55)" },

  pageTitleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12 },

  backBtn: {
    height: 36,
    minWidth: 84,
    borderRadius: 999,
    border: "1px solid #d9e2ee",
    background: "#ffffff",
    fontWeight: 900,
    color: "#132333",
    cursor: "pointer",
    fontSize: 14,
    padding: "0 14px",
  },

  emptyWrap: { marginTop: 40, alignItems: "center" as any },
  emptyTitle: { fontWeight: 900, fontSize: 16, color: "#132333" },
  emptyBody: { marginTop: 6, fontWeight: 700, color: "rgba(19,35,51,0.6)", textAlign: "center" as any },

  card: {
    background: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    marginTop: 14,
    border: "2px solid #d9e2ee",
  },

  cardTopRow: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  cardTitle: { fontWeight: 900, fontSize: 16, color: "#132333" },
  cardMeta: { fontWeight: 800, fontSize: 12, color: "rgba(19,35,51,0.55)", whiteSpace: "nowrap" as const },

  detailLine: { display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", gap: 12 },
  detailLabel: { fontWeight: 700, color: "rgba(19,35,51,0.55)", fontSize: 12 },
  detailValue: { fontWeight: 900, color: "rgba(19,35,51,0.8)", fontSize: 12, textAlign: "right", flexShrink: 1 as any },

  zoneDivider: { marginTop: 12, paddingTop: 12, borderTop: "2px solid #eef2f7" },

  zone6Wrap: { paddingTop: 2, alignItems: "center" as any },
  actionBtn: {
    width: "60%",
    borderRadius: 14,
    padding: "12px 0",
    textAlign: "center" as any,
    fontWeight: 900,
    fontSize: 14,
    color: "#132333",
    cursor: "pointer",
    border: "1px solid transparent",
    background: "transparent",
  },
  actionBtnGreen: { background: "rgba(34,197,94,0.14)", borderColor: "rgba(34,197,94,0.35)" },
};
