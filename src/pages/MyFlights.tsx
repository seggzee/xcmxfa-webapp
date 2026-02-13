// src/pages/MyFlights.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/authStore";
import FlightCard3x3 from "../components/FlightCard3x3";
import { getMyFlights, setBookingListed } from "../api/flightsApi";
import { LISTING_STATUS_ICONS } from "../assets";

/* ----------------------------- small helpers ----------------------------- */

function safeUpper(v: unknown) {
  return String(v || "")
    .trim()
    .toUpperCase();
}

function safeLower(v: unknown) {
  return String(v || "")
    .trim()
    .toLowerCase();
}

function fmtTimeLocal(dtLike: unknown) {
  if (!dtLike) return "";
  const d = new Date(String(dtLike));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function fmtDayLabel(dtLike: unknown) {
  if (!dtLike) return "";
  const d = new Date(String(dtLike));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
}

function fmtRequestedOn(utcLike: unknown) {
  if (!utcLike) return "";
  const d = new Date(String(utcLike));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * JS screen treats listing status as: pending | sent | booked
 * Web backend commonly uses: pending | sent | confirmed
 * This is NOT a fallback; it's a strict mapping so the UI matches JS semantics.
 */
function normalizeListingStatusForUI(raw: unknown): "" | "pending" | "sent" | "booked" {
  const s = safeLower(raw);
  if (s === "pending") return "pending";
  if (s === "sent") return "sent";
  if (s === "booked") return "booked";
  if (s === "confirmed") return "booked";
  return "";
}

function listingIconSrcFromStatus(s: "" | "pending" | "sent" | "booked") {
  if (s === "pending") return LISTING_STATUS_ICONS.pending;
  if (s === "sent") return LISTING_STATUS_ICONS.sent;
  if (s === "booked") return LISTING_STATUS_ICONS.booked;
  return null;
}

/* ----------------------------- types ----------------------------- */

type RawMyFlightRow = Record<string, any>;

type ListedCommuter = {
  pos: any;
  name: string;
  staffNo: string;
  group: string;
  isSelf: boolean;
  status: "" | "pending" | "sent" | "booked";
};

type CardVM = {
  id: string;
  flightInstanceId: string;

  // For FlightCard3x3: we pass the RAW row through (RN parity: screen builds zones; card is display-only)
  row0: RawMyFlightRow;

  depDate: string; // "Mon 25 Feb"
  requestedAt: string; // "25 Feb 2026"
  listingStatus: "" | "pending" | "sent" | "booked";

  listPos: any;
  listTotal: any;

  commuterSummary: { XCM: number; XFA: number; Other: number };
  listedCommuters: ListedCommuter[];

  depTerminal: string | null;
  depGate: string | null;
  arrTerminal: string | null;
  arrGate: string | null;
  etaLocal: string;

  isFuture: boolean;
};

/**
 * Normalise API “my flights” rows into the same screen-level shape as JS.
 * Supports both:
 * - one row per flight (only my booking row)
 * - multiple rows per flight (one per commuter)
 */
function toCardVMFromMyFlightsRows(rowsForOneFlight: RawMyFlightRow[], currentStaffNo: string): CardVM | null {
  const rows = Array.isArray(rowsForOneFlight) ? rowsForOneFlight : [];
  if (rows.length === 0) return null;

  const r0 = rows[0] || {};

  const flightInstanceId = String(r0.flight_instance_id || "").trim();
  if (!flightInstanceId) throw new Error("Invariant violation: missing flight_instance_id in my_flights row");

  const stdLocal = r0.std_local || null;
  const staLocal = r0.sta_local || null;

  // opStatus: keep API key if present; else only ON_TIME/CANCELLED based on cancelled flag
  const cancelledFlag = safeLower(r0.cancelled);
  const isCancelled =
    cancelledFlag === "y" || cancelledFlag === "yes" || cancelledFlag === "true" || cancelledFlag === "1";

  const apiOpStatusKey = String(r0.op_status || r0.opStatus || r0.op_status_key || r0.status || "").trim();
  const opStatus = apiOpStatusKey ? apiOpStatusKey : isCancelled ? "CANCELLED" : "ON_TIME";

  // Find “my” row
  const myRow = rows.find((x) => String(x?.psn || "").trim() === currentStaffNo) || r0;

  const requestedAt = fmtRequestedOn(myRow?.requested_at_utc);
  const listingStatus = normalizeListingStatusForUI(myRow?.booking_status);

  const listPos = myRow?.list_position ?? myRow?.listPos ?? null;
  const listTotal = myRow?.list_total ?? myRow?.listTotal ?? null;

  const listedCommuters: ListedCommuter[] = rows
    .slice()
    .sort((a, b) => (Number(a?.listing_prio) || 9999) - (Number(b?.listing_prio) || 9999))
    .map((x) => {
      const staffNo = String(x?.psn || "").trim();
      const isSelf = staffNo === currentStaffNo;

      const first = String(x?.firstname || "").trim();
      const last = String(x?.lastname || "").trim();
      const fullName = `${first} ${last}`.trim();

      const group = String(x?.x_type || "").trim();
      const pos = x?.list_position ?? null;

      return {
        pos,
        name: fullName,
        staffNo,
        group,
        isSelf,
        status: normalizeListingStatusForUI(x?.booking_status),
      };
    });

  const summary = listedCommuters.reduce(
    (acc, u) => {
      const g = safeUpper(u.group);
      if (g === "XCM") acc.XCM += 1;
      else if (g === "XFA") acc.XFA += 1;
      else acc.Other += 1;
      return acc;
    },
    { XCM: 0, XFA: 0, Other: 0 }
  );

  let isFuture = true;
  try {
    const d = stdLocal ? new Date(String(stdLocal)) : null;
    if (d && !Number.isNaN(d.getTime())) isFuture = d.getTime() >= Date.now();
  } catch {
    // ignore (JS parity)
  }

  return {
    id: flightInstanceId,
    flightInstanceId,

    row0: {
      ...r0,
      // keep op_status key aligned for FlightCard3x3 display
      op_status: opStatus,
    },

    depDate: fmtDayLabel(stdLocal),
    requestedAt,
    listingStatus,

    listPos,
    listTotal,

    commuterSummary: summary,
    listedCommuters,

    depTerminal: r0.dep_terminal ? String(r0.dep_terminal) : null,
    depGate: r0.dep_gate ? String(r0.dep_gate) : null,
    arrTerminal: r0.arr_terminal ? String(r0.arr_terminal) : null,
    arrGate: r0.arr_gate ? String(r0.arr_gate) : null,
    etaLocal: fmtTimeLocal(staLocal),

    isFuture,
  };
}

function DetailLine({ label, value }: { label: string; value: any }) {
  if (!value) return null;
  return (
    <div style={styles.detailLine as any}>
      <div style={styles.detailLabel as any}>{label}</div>
      <div style={styles.detailValue as any}>{String(value)}</div>
    </div>
  );
}

/* ----------------------------- page ----------------------------- */

export default function MyFlights() {
  const nav = useNavigate();
  const { auth } = useAuth();

  // JS: staffNo from auth.user.username uppercase
  const staffNo = useMemo(() => safeUpper((auth as any)?.user?.username) || null, [auth]);

  const isMember = (auth as any)?.mode === "member";

  const [apiFlights, setApiFlights] = useState<CardVM[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const [actionBusyByFlight, setActionBusyByFlight] = useState<Record<string, "list" | "unlist" | null>>({});
  const [actionSuccessByFlight, setActionSuccessByFlight] = useState<Record<string, "listed" | "unlisted" | null>>({});

  async function loadFlights() {
    if (!staffNo) return [];

    setLoading(true);
    setErrorText("");

    try {
      const resp: any = await getMyFlights({ staffNo });

      const rows: RawMyFlightRow[] = Array.isArray(resp)
        ? resp
        : Array.isArray(resp?.flights)
        ? resp.flights
        : Array.isArray(resp?.data)
        ? resp.data
        : Array.isArray(resp?.rows)
        ? resp.rows
        : [];

      const grouped: Record<string, RawMyFlightRow[]> = {};
      rows.forEach((r) => {
        const id = String(r?.flight_instance_id || "").trim();
        if (!id) return;
        if (!grouped[id]) grouped[id] = [];
        grouped[id].push(r);
      });

      const cards = Object.keys(grouped)
        .map((id) => toCardVMFromMyFlightsRows(grouped[id], String(staffNo)))
        .filter(Boolean) as CardVM[];

      setApiFlights(cards);
      return cards;
    } catch (e: any) {
      setErrorText(e?.message || "Failed to load your flights");
      setApiFlights([]);
      return [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      if (!isMember) return; // member-only page
      await loadFlights();
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffNo, isMember]);

  const flightsForRender = useMemo(() => (Array.isArray(apiFlights) ? apiFlights : []), [apiFlights]);

  const isUserListedOnFlight = (flight: CardVM) => {
    // JS: payload-sourced: pending|sent|booked => listed
    const s = String(flight?.listingStatus || "").toLowerCase().trim();
    return s === "pending" || s === "sent" || s === "booked";
  };

  const onPressListToggle = async (flight: CardVM) => {
    const flightId = String(flight?.flightInstanceId || "").trim();
    if (!flightId) {
      setErrorText("Missing flight instance id. Please refresh.");
      return;
    }
    if (!staffNo) {
      setErrorText("Missing psn. Please log out/in and try again.");
      return;
    }

    const currentlyListed = isUserListedOnFlight(flight);
    const mode: "list" | "unlist" = currentlyListed ? "unlist" : "list";

    setErrorText("");
    setActionBusyByFlight((prev) => ({ ...prev, [flightId]: mode }));

    try {
      const res = await setBookingListed({
        mode,
        flightInstanceId: flightId,
        staffNo,
      });

      void res; // JS parity: truth comes from refresh
      await loadFlights();

      setActionSuccessByFlight((prev) => ({ ...prev, [flightId]: mode === "list" ? "listed" : "unlisted" }));
      window.setTimeout(() => {
        setActionSuccessByFlight((prev) => {
          const next = { ...prev };
          delete next[flightId];
          return next;
        });
      }, 1200);
    } catch (e: any) {
      setErrorText(e?.message || "Request failed");
    } finally {
      setActionBusyByFlight((prev) => {
        const next = { ...prev };
        delete next[flightId];
        return next;
      });
    }
  };

  const actionLabelFor = (flight: CardVM) => {
    const flightId = String(flight?.flightInstanceId || "").trim();
    const busy = actionBusyByFlight?.[flightId] || null;
    const success = actionSuccessByFlight?.[flightId] || null;
    const listed = isUserListedOnFlight(flight);

    if (busy === "list") return "Listing…";
    if (busy === "unlist") return "Unlisting…";
    if (success === "listed") return "Listed me";
    if (success === "unlisted") return "Unlisted me";

    return listed ? "Unlist me" : "List me";
  };

  const actionStyleFor = (flight: CardVM) => {
    const listed = isUserListedOnFlight(flight);
    return listed ? styles.actionBtnAmber : styles.actionBtnGreen;
  };

  const isActionDisabled = (flight: CardVM) => {
    const flightId = String(flight?.flightInstanceId || "").trim();
    return Boolean(actionBusyByFlight?.[flightId]);
  };

  // member-only route behaviour
  if (!isMember) {
    return (
      <div style={{ minHeight: "100vh", background: "#f6f7f9", padding: 24 }}>
        <div style={{ ...styles.pageTitle, fontSize: 20 }}>My flights</div>
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
            <div style={styles.pageTitle as any}>My flights</div>

            {loading ? (
              <div style={styles.subtleStatusText as any}>Loading your flights…</div>
            ) : errorText ? (
              <div style={styles.subtleStatusText as any}>{errorText}</div>
            ) : null}
          </div>

          <button type="button" style={styles.backBtn as any} onClick={() => nav(-1)}>
            Back
          </button>
        </div>

        {flightsForRender.length === 0 ? (
          <div style={styles.emptyWrap as any}>
            <div style={styles.emptyTitle as any}>No flights found</div>
            <div style={styles.emptyBody as any}>You haven’t requested any flights yet.</div>
          </div>
        ) : (
          flightsForRender.map((flight) => {
            const footerRight = (() => {
              // JS card computed listPosDisplay. We keep the same display outcomes.
              const posRaw =
                flight.row0?.listPos !== undefined && flight.row0?.listPos !== null
                  ? String(flight.row0.listPos).trim()
                  : flight.row0?.list_position !== undefined && flight.row0?.list_position !== null
                  ? String(flight.row0.list_position).trim()
                  : "";

              const totalRaw =
                flight.row0?.listTotal !== undefined && flight.row0?.listTotal !== null
                  ? String(flight.row0.listTotal).trim()
                  : flight.row0?.list_total !== undefined && flight.row0?.list_total !== null
                  ? String(flight.row0.list_total).trim()
                  : "";

              let listPosDisplay = "";
              if (posRaw) {
                if (/^P\d+(\/\d+)?$/i.test(posRaw)) listPosDisplay = posRaw.toUpperCase();
                else if (/^\d+\/\d+$/.test(posRaw)) listPosDisplay = `P${posRaw}`;
                else if (/^\d+$/.test(posRaw) && /^\d+$/.test(totalRaw)) listPosDisplay = `P${posRaw}/${totalRaw}`;
                else if (/^\d+$/.test(posRaw)) listPosDisplay = `P${posRaw}`;
                else listPosDisplay = posRaw;
              }

              const iconSrc = listingIconSrcFromStatus(flight.listingStatus);

              return (
                <div style={styles.footerRightRow as any}>
                  <div style={styles.footerRightPos as any}>{listPosDisplay}</div>
                  {iconSrc ? <img src={iconSrc} alt={flight.listingStatus || ""} style={styles.footerRightIcon as any} /> : <div style={styles.footerRightIcon as any} />}
                </div>
              );
            })();

            return (
              <div key={flight.id} style={styles.card as any}>
                {/* Zone 2 — Head zone (3×3 grid card) — fixed */}
                <FlightCard3x3
                  flight={flight.row0}
                  headerLeftLabel={flight.isFuture ? "Upcoming" : "Past"}
                  headerDate={flight.depDate}
                  showHeader={true}
                  footerRightContent={footerRight}
                />

                <div style={styles.zoneDivider as any} />

                {/* Zone 3 — Listing information */}
                <div style={styles.zone3Wrap as any}>
                  <div style={styles.zoneSubtitle as any}>Listing information</div>

                  <div style={styles.zone3Row2 as any}>
                    <div style={styles.zoneMetaText as any}>Requested: {flight.requestedAt || "--"}</div>
                    <div style={styles.zoneMetaText as any}>Status: {flight.listingStatus || "--"}</div>
                  </div>
                </div>

                <div style={styles.zoneDivider as any} />

                {/* Zone 4 — Commuter summary */}
                <div style={styles.zone4Wrap as any}>
                  <div style={styles.zoneSubtitle as any}>Commuter summary</div>

                  <div style={styles.zone4Row2 as any}>
                    <div style={styles.zoneMetaText as any}>XCM : {String(flight.commuterSummary?.XCM ?? 0)}</div>
                    <div style={styles.zoneMetaText as any}>XFA : {String(flight.commuterSummary?.XFA ?? 0)}</div>
                    <div style={styles.zoneMetaText as any}>Other : {String(flight.commuterSummary?.Other ?? 0)}</div>
                  </div>
                </div>

                <div style={styles.zoneDivider as any} />

                {/* Zone 5 — All listed commuters */}
                {Array.isArray(flight.listedCommuters) && flight.listedCommuters.length > 0 ? (
                  <div style={styles.zone5Wrap as any}>
                    <div style={styles.zone5Header as any}>All listed commuters: {flight.listedCommuters.length}</div>

                    <div style={{ marginTop: 8 }}>
                      {flight.listedCommuters.map((p, idx) => {
                        const posLabel =
                          p.pos !== undefined && p.pos !== null && String(p.pos).trim() !== "" ? `P${String(p.pos).trim()}.` : "P—.";

                        return (
                          <div key={`${p.staffNo}-${idx}`} style={styles.zone5Row as any}>
                            <div style={styles.zone5Pos as any}>{posLabel}</div>

                            <div style={{ ...(styles.zone5Name as any), ...(p.isSelf ? (styles.zone5NameSelf as any) : null) }}>{p.name}</div>

                            <div style={styles.zone5Staff as any} title={p.staffNo}>
                              {p.staffNo}
                            </div>

                            <div style={styles.zone5Group as any} title={p.group}>
                              {p.group}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div style={styles.zone5Wrap as any}>
                    <div style={styles.zone5Header as any}>All listed commuters: --</div>
                  </div>
                )}

                <div style={styles.zoneDivider as any} />

                {/* Zone 6 — Action zone (wired) */}
                <div style={styles.zone6Wrap as any}>
                  <button
                    type="button"
                    onClick={() => onPressListToggle(flight)}
                    disabled={isActionDisabled(flight)}
                    style={{
                      ...(styles.actionBtn as any),
                      ...(actionStyleFor(flight) as any),
                      opacity: isActionDisabled(flight) ? 0.55 : 1,
                    }}
                  >
                    {actionLabelFor(flight)}
                  </button>
                </div>

                <div style={styles.zoneDivider as any} />

                {/* Zone 7 — Other info */}
                <div style={styles.zone7Wrap as any}>
                  <div style={styles.zone7Header as any}>Other information</div>

                  <div style={{ marginTop: 8 }}>
                    <DetailLine label="Aircraft config" value={null} />
                    <DetailLine label="WiFi" value={null} />

                    <div style={styles.detailsDivider as any} />

                    <DetailLine label="Departure Terminal" value={flight.depTerminal} />
                    <DetailLine label="Departure Gate" value={flight.depGate} />

                    <div style={styles.detailsDivider as any} />

                    <DetailLine label="Arrival Terminal" value={flight.arrTerminal} />
                    <DetailLine label="Arrival Gate" value={flight.arrGate} />
                    <DetailLine label="ETA (local)" value={flight.etaLocal} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ----------------------------- styles (JS parity) ----------------------------- */

const styles: Record<string, React.CSSProperties> = {
  scroll: { padding: 16, paddingBottom: 40 },

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

  card: {
    background: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    border: "2px solid #d9e2ee",
  },

  detailsDivider: { height: 10 },

  detailLine: { display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 0", gap: 12 },
  detailLabel: { fontWeight: 700, color: "rgba(19,35,51,0.55)", fontSize: 12 },
  detailValue: { fontWeight: 900, color: "rgba(19,35,51,0.8)", fontSize: 12, textAlign: "right", flexShrink: 1 as any },

  emptyWrap: { marginTop: 40, alignItems: "center" as any },
  emptyTitle: { fontWeight: 900, fontSize: 16, color: "#132333" },
  emptyBody: { marginTop: 6, fontWeight: 700, color: "rgba(19,35,51,0.6)", textAlign: "center" as any },

  zoneDivider: { marginTop: 12, paddingTop: 12, borderTop: "2px solid #eef2f7" },

  zoneSubtitle: { fontWeight: 900, color: "#132333", fontSize: 12 },
  zoneMetaText: { marginTop: 6, fontWeight: 700, color: "rgba(19,35,51,0.6)", fontSize: 12 },

  zone3Wrap: {},
  zone3Row2: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },

  zone4Wrap: {},
  zone4Row2: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },

  zone5Wrap: {},
  zone5Header: { fontWeight: 700, color: "#132333", fontSize: 12 },
  zone5Row: { display: "flex", alignItems: "flex-start", gap: 8, padding: "3px 0" },
  zone5Pos: { width: 28, fontWeight: 700, color: "rgba(19,35,51,0.55)", fontSize: 12, paddingTop: 1 },
  zone5Name: { flex: 1, minWidth: 0, fontWeight: 700, color: "rgba(19,35,51,0.8)", fontSize: 12 },
  zone5NameSelf: { fontWeight: 900, color: "#b91c1c" },
  zone5Staff: { width: 84, textAlign: "right", fontWeight: 700, color: "rgba(19,35,51,0.7)", fontSize: 12 },
  zone5Group: { width: 44, textAlign: "right", fontWeight: 700, color: "rgba(19,35,51,0.7)", fontSize: 12 },

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
  actionBtnAmber: { background: "rgba(217,119,6,0.16)", borderColor: "rgba(217,119,6,0.55)" },

  zone7Wrap: {},
  zone7Header: { fontWeight: 700, color: "#132333", fontSize: 12 },

  // Footer-right (3:3): P?/total left, icon right
  footerRightRow: { display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 10 },
  footerRightPos: { fontWeight: 700, color: "rgba(19,35,51,0.70)" },
  footerRightIcon: { width: 20, height: 20, objectFit: "contain" as any },
};
