// src/pages/MyFlights.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/authStore";
import FlightCard3x3 from "../components/FlightCard3x3";
import { getMyFlights, setBookingListed } from "../api/flightsApi";
import { LISTING_STATUS_ICONS, UI_ICONS } from "../assets";

// ✅ Standard back icon button (same component Week uses)
import BackButton from "../components/BackButton";

import "../styles/myFlights.css";

/* ----------------------------- small helpers ----------------------------- */

function safeUpper(v: unknown) {
  return String(v || "").trim().toUpperCase();
}

function safeLower(v: unknown) {
  return String(v || "").trim().toLowerCase();
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
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
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
    <div className="myFlights-detailLine">
      <div className="myFlights-detailLabel">{label}</div>
      <div className="myFlights-detailValue">{String(value)}</div>
    </div>
  );
}

/* ----------------------------- schiphol overlay (LOCKED CONTRACT) ----------------------------- */

/**
 * Idiot guide:
 * - Schiphol overlay is additive-only. It never alters FlightCard3x3 fields.
 * - We show a dedicated zone ONLY when:
 *    - dep_airport === "AMS"  -> "Departure information"
 *    - arr_airport === "AMS"  -> "Arrival information"
 * - If flight.row0.schiphol is null -> render nothing (even if AMS).
 */
function SchipholOverlayZone({ flight }: { flight: CardVM }) {
  const r0 = flight?.row0 || {};
  const dep = safeUpper(r0?.dep_airport);
  const arr = safeUpper(r0?.arr_airport);

  const isDepAMS = dep === "AMS";
  const isArrAMS = !isDepAMS && arr === "AMS"; // dep takes priority if somehow both match (shouldn't happen)

  if (!isDepAMS && !isArrAMS) return null;

  const s = r0?.schiphol ?? null;
  if (!s || typeof s !== "object") return null;

  const title = isDepAMS ? "AMS Departure info" : "AMS Arrival info";

  // Row 1: Location (T · Pier · Gate)
  const terminalRaw = String((s as any)?.terminal ?? "").trim();
  const pierRaw = String((s as any)?.pier ?? "").trim();
  const gateRaw = String((s as any)?.gate ?? "").trim();

  const locationParts: string[] = [];
  if (terminalRaw) {
    const t = terminalRaw.toUpperCase().startsWith("T") ? terminalRaw.toUpperCase() : `Terminal ${terminalRaw}`;
    locationParts.push(t);
  }
  if (pierRaw) locationParts.push(`Pier ${pierRaw}`);
  if (gateRaw) locationParts.push(`Gate ${gateRaw}`);

  const locationLine = locationParts.join(" · ");

  // Row 2: Times
  const timeParts: string[] = [];

  if (isDepAMS) {
    const open = fmtTimeLocal((s as any)?.expected_gate_open_utc);
    const board = fmtTimeLocal((s as any)?.expected_boarding_time_utc);
    const close = fmtTimeLocal((s as any)?.expected_gate_closing_utc);
    const offb = fmtTimeLocal((s as any)?.actual_off_block_time_utc);

    if (open) timeParts.push(`Open: ${open}`);
    if (board) timeParts.push(`Boarding: ${board}`);
    if (close) timeParts.push(`Close: ${close}`);
    if (offb) timeParts.push(`Off-block ${offb}`);
  } else {
    const land = fmtTimeLocal((s as any)?.estimated_landing_time_utc);
    if (land) timeParts.push(`Est. landing ${land}`);
  }

  const timesLine = timeParts.join(" · ");

  // Optional freshness (tiny)
  const updated = fmtTimeLocal((s as any)?.updated_at_utc);
  const showFreshness = Boolean(updated);

  // If there's literally nothing useful, don't show the zone.
  if (!locationLine && !timesLine && !showFreshness) return null;

  return (
    <div className="myFlights-zone">
      <div className="myFlights-zoneTitle">{title}</div>

      {locationLine ? <div className="myFlights-zoneMeta">{locationLine}</div> : null}
      {timesLine ? <div className="myFlights-zoneMeta">{timesLine}</div> : null}

      {/* {showFreshness ? <div className="myFlights-zoneMeta">Schiphol updated: {updated}</div> : null} */}
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
  const [actionSuccessByFlight, setActionSuccessByFlight] = useState<Record<string, "listed" | "unlisted" | null>>(
    {}
  );

  // =====================================================================================
  // COLLAPSE ENGINE (per-card)
  //
  // Locked decisions:
  // - Header right = MENU icon (menu.webp via UI_ICONS.MENU)
  // - MENU toggles per-card collapse/expand
  // - Collapsed:
  //    - Header + 3x3 card visible
  //    - All zones below 3x3 hidden
  //    - Action button ALWAYS visible when backend capability allows
  // - Expanded:
  //    - Everything visible
  //
  // Additive only:
  // - No deletions of existing logic or notes
  // - No refactors
  // - No API/behaviour changes outside collapse feature
  // =====================================================================================
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

  // =====================================================================================
  // CONFIRM MODAL (THIS CHANGE ONLY)
  //
  // PURPOSE
  // - Prevent accidental unlist / cancel taps from My Flights.
  // - Mirror the same wording model already agreed for Day:
  //    * Type 1 -> "Unlist from flight"
  //    * Type 2 -> "Cancel flight listing"
  //
  // SCOPE
  // - Frontend only
  // - No backend change
  // - No action logic change beyond adding a confirmation gate
  // =====================================================================================
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmMode, setConfirmMode] = useState<"list" | "unlist">("list");
  const [confirmFlight, setConfirmFlight] = useState<CardVM | null>(null);

  function toggleExpanded(flightId: string) {
    setExpandedMap((prev) => ({
      ...prev,
      [flightId]: !prev[flightId],
    }));
  }

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

      const sortedCards = cards.slice().sort((a, b) => {
        const aMs = Date.parse(String(a?.row0?.std_utc || ""));
        const bMs = Date.parse(String(b?.row0?.std_utc || ""));

        const aValid = Number.isFinite(aMs);
        const bValid = Number.isFinite(bMs);

        // invalid UTC goes to bottom
        if (!aValid && !bValid) return 0;
        if (!aValid) return 1;
        if (!bValid) return -1;

        const nowMs = Date.now();
        const aFuture = aMs >= nowMs;
        const bFuture = bMs >= nowMs;

        // upcoming first, past after
        if (aFuture && !bFuture) return -1;
        if (!aFuture && bFuture) return 1;

        // both upcoming -> soonest first
        if (aFuture && bFuture) return aMs - bMs;

        // both past -> most recent first
        return bMs - aMs;
      });

      setApiFlights(sortedCards);
      return sortedCards;
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
    const s = String(flight?.listingStatus || "").toLowerCase().trim();
    return s === "pending" || s === "sent" || s === "booked";
  };

  const canShowUnlistButton = (flight: CardVM) => {
    return flight?.row0?.can_unlist === true;
  };

  const unlistModeForFlight = (flight: CardVM): "type1" | "type2" | "none" => {
    const mode = String(flight?.row0?.unlist_mode || "").trim().toLowerCase();
    if (mode === "type1") return "type1";
    if (mode === "type2") return "type2";
    return "none";
  };

  function openConfirm(mode: "list" | "unlist", flight: CardVM) {
    setConfirmMode(mode);
    setConfirmFlight(flight);
    setConfirmVisible(true);
  }

  async function commitConfirm() {
    if (!confirmFlight) {
      setConfirmVisible(false);
      return;
    }

    const flight = confirmFlight;
    const flightId = String(flight?.flightInstanceId || "").trim();
    const listed = isUserListedOnFlight(flight);
    const mode: "list" | "unlist" = listed ? "unlist" : "list";

    if (!canShowUnlistButton(flight)) {
      setConfirmVisible(false);
      return;
    }
    if (!flightId) {
      setConfirmVisible(false);
      setErrorText("Missing flight instance id. Please refresh.");
      return;
    }
    if (!staffNo) {
      setConfirmVisible(false);
      setErrorText("Missing psn. Please log out/in and try again.");
      return;
    }

    setErrorText("");
    setActionBusyByFlight((prev) => ({ ...prev, [flightId]: mode }));
    setConfirmVisible(false);

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
      setConfirmFlight(null);
    }
  }

  function onPressActionButton(flight: CardVM) {
    const listed = isUserListedOnFlight(flight);
    const mode: "list" | "unlist" = listed ? "unlist" : "list";
    openConfirm(mode, flight);
  }

  const actionLabelFor = (flight: CardVM) => {
    const flightId = String(flight?.flightInstanceId || "").trim();
    const busy = actionBusyByFlight?.[flightId] || null;
    const success = actionSuccessByFlight?.[flightId] || null;
    const listed = isUserListedOnFlight(flight);
    const unlistMode = unlistModeForFlight(flight);

    if (busy === "list") return "Listing…";
    if (busy === "unlist") return "Unlisting…";
    if (success === "listed") return "Listed me";
    if (success === "unlisted") return "Unlisted me";

    if (listed) {
      if (unlistMode === "type1") return "Unlist from flight";
      if (unlistMode === "type2") return "Cancel flight listing";
      return "";
    }

    return "List me";
  };

  const actionVariantFor = (flight: CardVM) => {
    const listed = isUserListedOnFlight(flight);
    return listed ? "amber" : "green";
  };

  const isActionDisabled = (flight: CardVM) => {
    const flightId = String(flight?.flightInstanceId || "").trim();
    return Boolean(actionBusyByFlight?.[flightId]);
  };

  // member-only route behaviour (should not normally be hit due to RequireMember, but keep safe)
  if (!isMember) {
    return (
      <div className="myFlights-page myFlights-page--guest">
        <div className="myFlights-titleRow">
          <div className="myFlights-titleCol">
            <div className="myFlights-title">My flights</div>
            <div className="myFlights-status">Member-only page.</div>
          </div>

          {/* ✅ Standard back icon (Week parity) */}
          <BackButton onClick={() => nav(-1)} ariaLabel="Back" size={38} />
        </div>
      </div>
    );
  }

  return (
    <div className="myFlights-page">
      <div className="myFlights-scroll">
        <div className="myFlights-titleRow">
          <div className="myFlights-titleCol">
            <div className="myFlights-title">My flights</div>

            {loading ? (
              <div className="myFlights-status">Loading your flights…</div>
            ) : errorText ? (
              <div className="myFlights-status">{errorText}</div>
            ) : null}
          </div>

          {/* ✅ Standard back icon (Week parity) */}
          <BackButton onClick={() => nav(-1)} ariaLabel="Back" size={38} />
        </div>

        {flightsForRender.length === 0 ? (
          <div className="myFlights-emptyWrap">
            <div className="myFlights-emptyTitle">No flights found</div>
            <div className="myFlights-emptyBody">You haven’t requested any flights yet.</div>
          </div>
        ) : (
          flightsForRender.map((flight) => {
            // Per-card collapse state (default collapsed)
            const expanded = expandedMap[String(flight.flightInstanceId || "").trim()] ?? false;

            const footerRight = (() => {
              const posRaw =
                flight.listPos !== undefined && flight.listPos !== null ? String(flight.listPos).trim() : "";

              const totalRaw =
                flight.listTotal !== undefined && flight.listTotal !== null ? String(flight.listTotal).trim() : "";

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
                <div className="myFlights-footerRightRow">
                  <div className="myFlights-footerRightPos">{listPosDisplay}</div>
                  {iconSrc ? (
                    <img src={iconSrc} alt={flight.listingStatus || ""} className="myFlights-footerRightIcon" />
                  ) : (
                    <div className="myFlights-footerRightIcon" />
                  )}
                </div>
              );
            })();

            return (
              <div key={flight.id} className="myFlights-card">
                <FlightCard3x3
                  flight={flight.row0}
                  headerLeftLabel={flight.isFuture ? "Upcoming:" : "Past:"}
                  headerDate={flight.depDate}
                  showHeader={true}
                  footerRightContent={footerRight}
                  // =================================================================================
                  // Header right MENU control (per-card collapse engine)
                  // - Menu icon: UI_ICONS.MENU (menu.webp)
                  // - Clicking toggles the card between collapsed/expanded.
                  // =================================================================================
                  headerRightContent={
                    <button
                      type="button"
                      className="myFlights-menuBtn"
                      onClick={() => toggleExpanded(String(flight.flightInstanceId || "").trim())}
                      aria-expanded={expanded}
                      aria-label={expanded ? "Collapse card" : "Expand card"}
                    >
                      <img className="myFlights-menuIcon" src={UI_ICONS.MENU} alt="Menu" />
                    </button>
                  }
                />

                {/* =================================================================================
                    COLLAPSIBLE ZONES (below 3x3)
                    Locked behaviour:
                    - When collapsed: hide ALL zones below the 3x3 card
                    - When expanded: show them exactly as before
                    Additive only: we wrap existing zones; we do NOT alter their logic.
                   ================================================================================= */}
                {expanded ? (
                  <>
                    {/* NEW: Schiphol Ultra overlay zone (ADD-ONLY, AMS only) */}
                    <div className="myFlights-zoneDivider" />
                    <SchipholOverlayZone flight={flight} />

                    {/* If overlay zone rendered, keep the next divider so zones remain visually separated */}
                    <div className="myFlights-zoneDivider" />

                    <div className="myFlights-zone">
                      <div className="myFlights-zoneTitle">Listing information</div>
                      <div className="myFlights-zoneRow">
                        <div className="myFlights-zoneMeta">Requested: {flight.requestedAt || "--"}</div>
                        <div className="myFlights-zoneMeta">Status: {flight.listingStatus || "--"}</div>
                      </div>
                    </div>

                    <div className="myFlights-zoneDivider" />

                    <div className="myFlights-zone">
                      <div className="myFlights-zoneTitle">Commuter summary</div>
                      <div className="myFlights-zoneRow">
                        <div className="myFlights-zoneMeta">XCM : {String(flight.commuterSummary?.XCM ?? 0)}</div>
                        <div className="myFlights-zoneMeta">XFA : {String(flight.commuterSummary?.XFA ?? 0)}</div>
                        <div className="myFlights-zoneMeta">Other : {String(flight.commuterSummary?.Other ?? 0)}</div>
                      </div>
                    </div>

                    <div className="myFlights-zoneDivider" />

                    {Array.isArray(flight.listedCommuters) && flight.listedCommuters.length > 0 ? (
                      <div className="myFlights-zone">
                        <div className="myFlights-zoneHeaderStrong">
                          All listed commuters: {flight.listedCommuters.length}
                        </div>

                        <div className="myFlights-commuterList">
                          {flight.listedCommuters.map((p, idx) => {
                            const posLabel =
                              p.pos !== undefined && p.pos !== null && String(p.pos).trim() !== ""
                                ? `P${String(p.pos).trim()}.`
                                : "P—.";

                            return (
                              <div key={`${p.staffNo}-${idx}`} className="myFlights-commuterRow">
                                <div className="myFlights-commuterPos">{posLabel}</div>

                                <div className={`myFlights-commuterName ${p.isSelf ? "is-self" : ""}`}>{p.name}</div>

                                <div className="myFlights-commuterStaff" title={p.staffNo}>
                                  {p.staffNo}
                                </div>

                                <div className="myFlights-commuterGroup" title={p.group}>
                                  {p.group}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="myFlights-zone">
                        <div className="myFlights-zoneHeaderStrong">All listed commuters: --</div>
                      </div>
                    )}
                  </>
                ) : null}

                {/* =================================================================================
                    ACTION BUTTON (ALWAYS VISIBLE WHEN BACKEND CAPABILITY ALLOWS)
                    Locked behaviour:
                    - Must remain visible when collapsed and expanded if allowed
                    - Visibility now comes from backend capability flags
                    - THIS CHANGE ONLY:
                    - Action now opens a confirmation modal first
                   ================================================================================= */}

                {canShowUnlistButton(flight) && (
                  <>
                    <div className="myFlights-zoneDivider" />

                    <div className="myFlights-actionWrap">
                      <button
                        type="button"
                        onClick={() => onPressActionButton(flight)}
                        disabled={isActionDisabled(flight)}
                        className={`myFlights-actionBtn variant-${actionVariantFor(flight)} ${
                          isActionDisabled(flight) ? "is-disabled" : ""
                        }`}
                      >
                        {actionLabelFor(flight)}
                      </button>
                    </div>
                  </>
                )}

                {/* =================================================================================
                    COLLAPSIBLE ZONES CONTINUED (below action button)
                    Locked behaviour:
                    - Other information must also collapse
                    Additive only: wrap, do not edit internals
                   ================================================================================= */}
                {expanded ? (
                  <>
                    <div className="myFlights-zoneDivider" />

                    <div className="myFlights-zone">
                      <div className="myFlights-zoneHeaderStrong">Other information</div>

                      <div className="myFlights-detailsBlock">
                        <DetailLine label="Aircraft config" value={null} />
                        <DetailLine label="WiFi" value={null} />

                        <div className="myFlights-detailsDivider" />

                        <DetailLine label="Departure Terminal" value={flight.depTerminal} />
                        <DetailLine label="Departure Gate" value={flight.depGate} />

                        <div className="myFlights-detailsDivider" />

                        <DetailLine label="Arrival Terminal" value={flight.arrTerminal} />
                        <DetailLine label="Arrival Gate" value={flight.arrGate} />
                        <DetailLine label="ETA (local)" value={flight.etaLocal} />
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {/* =================================================================================
          CONFIRM MODAL (THIS CHANGE ONLY)
          - Same wording model as agreed for Day
          - Type 1 = internal-only unlist warning
          - Type 2 = destructive cancel + airport notification warning
         ================================================================================= */}
      {confirmVisible && confirmFlight ? (
        <div
          className="day-overlay"
          onClick={() => {
            setConfirmVisible(false);
            setConfirmFlight(null);
          }}
        >
          <div className="day-modalCard" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 900, fontSize: 16, color: "#132333" }}>
              {confirmMode === "list"
                ? "Confirm listing"
                : unlistModeForFlight(confirmFlight) === "type2"
                ? "Cancel flight listing"
                : "Unlist from flight"}
            </div>

            <div
              style={{
                marginTop: 10,
                color: "rgba(19,35,51,0.75)",
                fontWeight: 700,
                lineHeight: "18px",
                whiteSpace: "pre-line",
              }}
            >
              {confirmMode === "list"
                ? "You will be added to the commuter list in order of priority. Your position may change as other xcm/xfa list on the flight."
                : unlistModeForFlight(confirmFlight) === "type2"
                ? `\u2022 This will cancel your check-in and flight listing for this flight.\n\n\u2022 The airport will be notified of your cancellation.\n\n\u2022 This action cannot be undone.`
                : `\u2022 You will be removed from this flight’s commuter list.\n\n\u2022 Your current position will be lost and may change if you re-list later.`}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                type="button"
                style={{
                  flex: 1,
                  borderRadius: 14,
                  padding: "12px 0",
                  fontWeight: 900,
                  cursor: "pointer",
                  border: "1px solid #d9e2ee",
                  fontSize: 14,
                  background: "#fff",
                  color: "#132333",
                }}
                onClick={() => {
                  setConfirmVisible(false);
                  setConfirmFlight(null);
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                style={{
                  flex: 1,
                  borderRadius: 14,
                  padding: "12px 0",
                  fontWeight: 900,
                  cursor: "pointer",
                  border: "1px solid transparent",
                  fontSize: 14,
                  background: "#132333",
                  color: "#ffffff",
                  opacity: Boolean(
                    confirmFlight?.flightInstanceId &&
                      actionBusyByFlight?.[String(confirmFlight.flightInstanceId || "").trim()]
                  )
                    ? 0.55
                    : 1,
                }}
                disabled={Boolean(
                  confirmFlight?.flightInstanceId &&
                    actionBusyByFlight?.[String(confirmFlight.flightInstanceId || "").trim()]
                )}
                onClick={() => {
                  void commitConfirm();
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}