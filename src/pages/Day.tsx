// src/pages/Day.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../app/authStore";

import FlightCard3x3 from "../components/FlightCard3x3";
import BackButton from "../components/BackButton";
import AirportInfoModal from "../components/AirportInfoModal";
import { getAirportLogo, LISTING_STATUS_ICONS } from "../assets";
import {
  normaliseAirportStatus as normaliseAirportStatusBySource,
  normaliseSchipholPublicState as normaliseSchipholPublicStateBySource,
} from "../utils/airportStatus";
import "../styles/day.css";

import {
  ensureDayStatusFresh,
  getFlightsForDay,
  getBookingsForDay,
  setBookingListed,
} from "../api/flightsApi";

/* ----------------------------- invariants/helpers ----------------------------- */

function invariant(condition: any, message: string) {
  if (!condition) throw new Error(message);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function dateToLocalDateKey(d: Date) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function dateToUtcDateKey(d: Date) {
  const y = d.getUTCFullYear();
  const m = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  return `${y}-${m}-${day}`;
}

function isBefore(a: string, b: string) {
  return String(a) < String(b);
}

function isAfter(a: string, b: string) {
  return String(a) > String(b);
}

function safeUpper(v: unknown) {
  return String(v || "").trim().toUpperCase();
}

function toCleanString(v: unknown) {
  return String(v ?? "").trim();
}

function fmtTimeLocal(dtLike: unknown) {
  if (!dtLike) return "";
  const d = new Date(String(dtLike));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Airport overlay local-time display helper.
 *
 * LOCKED DISPLAY RULE:
 * - Airport overlay rows already expose scheduled_time_local / estimated_time_local / actual_time_local.
 * - These are airport-local display strings.
 * - Do not convert them through browser timezone for the Day airport info panels.
 */
function fmtOverlayLocalTime(dtLike: unknown) {
  const s = String(dtLike || "").trim();
  if (!s) return "";

  const m = s.match(/\b([01]\d|2[0-3]):[0-5]\d\b/);
  return m ? m[0] : "";
}

function normalizeBookingStatusStrict(raw: any): "confirmed" | "sent" | "pending" {
  const s = String(raw || "").trim().toLowerCase();
  invariant(Boolean(s), "Invariant violation: booking row missing status");
  invariant(
    s === "confirmed" || s === "sent" || s === "pending",
    `Invariant violation: unexpected booking status "${s}" (expected confirmed|sent|pending)`
  );
  return s as any;
}

function actionConfigForFlight(airlineIata: any, userListed: boolean) {
  const code = String(airlineIata || "").toUpperCase();
  if (code === "KL") return { show: true, label: userListed ? "Unlist me" : "List me" };
  if (code === "HV") return { show: true, label: userListed ? "Remove me" : "Show me" };
  return { show: false, label: "" };
}

type ApiFlightRow = Record<string, any>;
type BookingRow = Record<string, any>;

type CrewRow = {
  bookingId: any;
  role: string | null;
  fullName: string;
  staffNo: string; // psn
  status: "confirmed" | "sent" | "pending";
  securityNo: string | null;
  listedAt: string | null; // requested_at_utc
};

type LinkedCommuterRow = {
  id: any;
  flight_instance_id: string;
  psn: string;
  employer: string | null;
  x_type: string | null;
  firstname: string | null;
  lastname: string | null;
  status: "confirmed" | "sent" | "pending";
  security_number: string | null;
  dep_airport: string;
  arr_airport: string;
};

const POLL_MS = 2.5 * 60 * 1000;

/* =====================================================================================
   DAY BASE FILTERS
   =====================================================================================

   Week -> Day continuity:
   - Week passes active AMS / RTM / EIN base filters through route state.
   - Day initialises from that incoming state so the opened Day list matches
     the Week count the user tapped.
   - Day still lets the user change the filter locally.
   - The shared localStorage key keeps Week and Day base choices aligned.

   Universal behaviour:
   - Always show AMS / RTM / EIN mini-pills.
   - Default all ON.
   - Click ON -> OFF.
   - Click OFF -> ON.
   - All OFF is allowed and shows "No bases selected".

   Filtering rule:
   - Departures tab: selected airport -> active base airports.
   - Arrivals tab: active base airports -> selected airport.
   ===================================================================================== */

const BASE_FILTER_STORAGE_KEY = "xcmxfa:week:baseFilters";
const BASE_FILTER_CODES = ["AMS", "RTM", "EIN"] as const;

type BaseFilterCode = (typeof BASE_FILTER_CODES)[number];

function normaliseBaseFilterArray(value: unknown): BaseFilterCode[] | null {
  if (!Array.isArray(value)) return null;

  // Empty array is valid: all bases OFF.
  if (value.length === 0) return [];

  const valid = BASE_FILTER_CODES.filter((baseCode) => value.includes(baseCode));

  // Non-empty but no valid base codes = corrupt/invalid.
  if (valid.length === 0) return null;

  // Return in fixed display/order: AMS, RTM, EIN.
  return valid;
}

function readInitialDayBaseFilters(incomingFromRouteState: unknown): BaseFilterCode[] {
  const fromRouteState = normaliseBaseFilterArray(incomingFromRouteState);
  if (fromRouteState !== null) return fromRouteState;

  try {
    const raw = localStorage.getItem(BASE_FILTER_STORAGE_KEY);
    if (!raw) return [...BASE_FILTER_CODES];

    const parsed = JSON.parse(raw);
    const fromStorage = normaliseBaseFilterArray(parsed);

    if (fromStorage !== null) return fromStorage;
  } catch {
    // best-effort only
  }

  return [...BASE_FILTER_CODES];
}

/* =====================================================================================
   DEPARTURE / ARRIVAL OPERATIONAL INFO PANELS - REPLACEABLE BLOCK
   =====================================================================================

   BACKEND CONTRACT - LOCKED:
   - airport_overlay
       = 3x3 card operational overlay.
       = departure-side preferred.
       = kept for FlightCard3x3 compatibility.

   - airport_overlay_dep
       = departure-side airport operational overlay.
       = source for Departure info panel when a departure airport feed exists.

   - airport_overlay_arr
       = arrival-side airport operational overlay.
       = source for Arrival info panel when an arrival airport feed exists.

   - airline_departure_info
       = fallback source for Departure info panel when no departure airport feed exists,
         except HV departures in the two-day operational window.

   - airline_arrival_info
       = fallback source for KLM Arrival info panel when no arrival airport feed exists.
       = HV no-feed arrival fallback must show Unknown + no additional information.

   SOURCE PRIORITY - LOCKED:
   - Departure info:
       1. Schiphol if dep_airport = AMS
       2. airport_overlay_dep
       3. HV today/tomorrow no-feed fallback = Unknown + no additional information
       4. airline_departure_info for non-HV / non-locked fallback cases

   - Arrival info:
       1. Schiphol if arr_airport = AMS
       2. airport_overlay_arr
       3. KLM airline_arrival_info fallback
       4. HV no-feed fallback = Unknown + no additional information

   DISPLAY CONTRACT - LOCKED:
   - 3x3 card remains the overall flight card.
   - 3x3 status/gate authority is handled inside FlightCard3x3.
   - Airport panels are airport-process context only.
   - Panels are shown only when std_utc or sta_utc falls on UTC today or UTC tomorrow.
   - Panel order is always:
       Departure info
       Arrival info
   - Panels sit directly below the 3x3 card and above all member/listing zones.

   DEPARTURE PANEL LAYOUT - LOCKED:
   - Line 1: {AIRPORT} Departure info        [status chip]
   - Line 2: New departure time / delay information
             Only shown if available. No blank placeholder if unavailable.
   - Line 3: Timing / movement information
   - Line 4: Airport handling / location information
             Terminal · Pier/Check-in · Gate
   - If no useful detail beyond the chip:
       "No additional information available"

   ARRIVAL PANEL LAYOUT - CURRENT:
   - Line 1: {AIRPORT} Arrival info        [status chip]
   - Line 2: timing / movement information
   - Line 3: airport handling information
       Arrival: Terminal · Gate · Belt
   - If no useful detail beyond the chip:
       "No additional information available"

   FUTURE COLLAPSE WIRING:
   - AirportOperationalPanels accepts expanded.
   - It is currently always passed true.
   - Later, expanded can be controlled by tapping the 3x3 status/card area without rewriting this block.
   ===================================================================================== */

type OpsPanelModel = {
  key: "departure" | "arrival";
  title: string;
  statusChip: string;
  line2: string;
  line3: string;
  line4: string;
  emptyText: string;
};

function isCancelledFlag(v: unknown) {
  const u = safeUpper(v);
  return u === "1" || u === "TRUE" || u === "YES" || u === "Y" || u === "CANCELLED";
}

function compactJoin(parts: string[]) {
  return parts.map((p) => toCleanString(p)).filter(Boolean).join(" · ");
}

function normalisePublicStatus(raw: unknown) {
  const s = toCleanString(raw);
  if (!s) return "";

  const u = s.toUpperCase().replace(/_/g, " ");

  const map: Record<string, string> = {
    SCHEDULED: "Scheduled",
    UNKNOWN: "Unknown",
    CANCELLED: "Cancelled",
    CANCELED: "Cancelled",
    DELAYED: "Delayed",
    DEPARTED: "Departed",
    ARRIVED: "Arrived",
    LANDED: "Landed",
    "IN FLIGHT": "In flight",
    BOARDING: "Boarding",
    "GATE OPEN": "Gate open",
    "GATE CLOSING": "Gate closing",
    "GATE CLOSED": "Gate closed",
    "FINAL CALL": "Final call",
  };

  return map[u] || s;
}

function normaliseAenaStatus(
  statusText: unknown,
  statusCode: unknown,
  direction: "DEP" | "ARR" = "DEP",
  sourceName: unknown = "AENA_OFFICIAL"
) {
  // Source-scoped airport status display.
  // AENA raw-code diagnostic mode is closed.
  // AENA display now uses mapped labels from src/utils/airportStatus.ts.
  // BOR is direction-sensitive in the helper:
  // - DEP => Departed
  // - ARR => Arrived
  // - missing/unknown direction => Unknown
  return normaliseAirportStatusBySource({
    sourceName,
    statusCode,
    statusText,
    direction,
  });
}

function normaliseSchipholPublicState(raw: unknown) {
  return normaliseSchipholPublicStateBySource(raw);
}

function usefulLineStatus(raw: unknown) {
  const s = normalisePublicStatus(raw);
  const u = safeUpper(s);

  if (!s) return "";
  if (u === "UNKNOWN") return "";
  if (u === "SCHEDULED") return "";

  return s;
}

function normaliseTerminal(raw: unknown) {
  const s = toCleanString(raw);
  const u = s.toUpperCase();

  if (!s) return "";
  if (u === "PAX") return "";
  if (u === "NULL") return "";

  if (u === "NTERM") return "Terminal N";
  if (u.endsWith("TERM") && u.length > 4) return `Terminal ${u.slice(0, -4)}`;
  if (u.startsWith("TERMINAL ")) return s;
  if (u.startsWith("T") && u.length <= 3) return u;

  return `Terminal ${s}`;
}

function normaliseGate(raw: unknown) {
  const s = toCleanString(raw);
  if (!s || s.toUpperCase() === "NULL") return "";

  if (/^[A-Z]$/i.test(s)) return `Area ${s.toUpperCase()}`;
  return `Gate ${s}`;
}

function normalisePier(raw: unknown) {
  const s = toCleanString(raw);
  if (!s || s.toUpperCase() === "NULL") return "";
  return `Pier ${s}`;
}

function normaliseBelt(raw: unknown) {
  const s = toCleanString(raw);
  if (!s || s.toUpperCase() === "NULL") return "";
  return `Belt ${s}`;
}

function normaliseCheckin(raw: unknown) {
  const s = toCleanString(raw);
  if (!s || s.toUpperCase() === "NULL") return "";
  return `Check-in ${s}`;
}

function buildDepartureDelayLine({
  scheduled,
  estimated,
}: {
  scheduled: string;
  estimated: string;
}) {
  if (estimated && (!scheduled || estimated !== scheduled)) {
    return `New departure ${estimated}`;
  }

  return "";
}

function buildDepartureMovementLine({
  actual,
  gateOpen,
  boarding,
  gateClose,
  movementStatus,
  chip,
}: {
  actual?: string;
  gateOpen?: string;
  boarding?: string;
  gateClose?: string;
  movementStatus?: string;
  chip?: string;
}) {
  if (actual) return `Actual dep ${actual}`;

  const processLine = compactJoin([
    gateOpen ? `Gate: Opens ${gateOpen}` : "",
    boarding ? `Boarding ${boarding}` : "",
    gateClose ? `Closes ${gateClose}` : "",
  ]);

  if (processLine) return processLine;

  const movement = usefulLineStatus(movementStatus);
  if (movement && movement !== chip) return movement;

  return "";
}

function buildArrivalTimingLine({
  scheduled,
  estimated,
  actual,
}: {
  scheduled: string;
  estimated: string;
  actual: string;
}) {
  if (actual) return `Actual arr ${actual}`;

  if (estimated && (!scheduled || estimated !== scheduled)) {
    return `Est arr ${estimated}`;
  }

  return "";
}

function isRealOverlay(overlay: any) {
  return Boolean(overlay && typeof overlay === "object" && overlay?.is_fallback !== true);
}

function utcDateKeyFromValue(v: unknown) {
  const s = toCleanString(v);
  if (!s) return "";

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";

  return dateToUtcDateKey(d);
}

function isHvDepartureTwoDayOperationalWindow(row: ApiFlightRow) {
  const airline = safeUpper(row?.airline_iata);
  if (airline !== "HV") return false;

  const stdKey = utcDateKeyFromValue(row?.std_utc);
  if (!stdKey) return false;

  const now = new Date();
  const todayUtc = dateToUtcDateKey(now);

  const tomorrow = new Date(now.getTime());
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowUtc = dateToUtcDateKey(tomorrow);

  return stdKey === todayUtc || stdKey === tomorrowUtc;
}

function buildHvNoFeedDeparturePanel(row: ApiFlightRow): OpsPanelModel | null {
  if (!isHvDepartureTwoDayOperationalWindow(row)) return null;

  const airportCode = safeUpper(row?.dep_airport);
  if (!airportCode) return null;

  // HV two-day departure no-feed fallback - LOCKED:
  // If Schiphol/airport_overlay_dep is unavailable, do NOT present HV
  // airline/canonical status as airport departure information.
  // The departure panel must remain honest: Unknown + no additional information.
  return {
    key: "departure",
    title: `${airportCode} Departure info`,
    statusChip: "Unknown",
    line2: "",
    line3: "",
    line4: "",
    emptyText: "No additional information available",
  };
}

function buildDeparturePanelFromSchiphol(row: ApiFlightRow): OpsPanelModel | null {
  const dep = safeUpper(row?.dep_airport);
  if (dep !== "AMS") return null;

  const s = row?.schiphol ?? null;
  if (!s || typeof s !== "object") return null;

  const chip = normaliseSchipholPublicState(s?.public_flight_state);

  const open = fmtTimeLocal(s?.expected_gate_open_utc);
  const board = fmtTimeLocal(s?.expected_boarding_time_utc);
  const close = fmtTimeLocal(s?.expected_gate_closing_utc);
  const offb = fmtTimeLocal(s?.actual_off_block_time_utc);

  // Schiphol currently does not expose a separate "new departure" field in this object.
  // Therefore Line 2 is only shown when a future backend field is wired.
  const line2 = "";

  const line3 = buildDepartureMovementLine({
    actual: offb,
    gateOpen: open,
    boarding: board,
    gateClose: close,
    chip,
  });

  const line4 = compactJoin([
    normaliseTerminal(s?.terminal),
    normalisePier(s?.pier),
    normaliseGate(s?.gate),
  ]);

  return {
    key: "departure",
    title: "AMS Departure info",
    statusChip: chip,
    line2,
    line3,
    line4,
    emptyText: "No additional information available",
  };
}

function buildArrivalPanelFromSchiphol(row: ApiFlightRow): OpsPanelModel | null {
  const arr = safeUpper(row?.arr_airport);
  if (arr !== "AMS") return null;

  const s = row?.schiphol ?? null;
  if (!s || typeof s !== "object") return null;

  const chip = normaliseSchipholPublicState(s?.public_flight_state);
  const land = fmtTimeLocal(s?.estimated_landing_time_utc);

  const line2 = land ? `Est arr ${land}` : "";

  const line3 = compactJoin([
    normaliseTerminal(s?.terminal),
    normalisePier(s?.pier),
    normaliseGate(s?.gate),
  ]);

  return {
    key: "arrival",
    title: "AMS Arrival info",
    statusChip: chip,
    line2,
    line3,
    line4: "",
    emptyText: "No additional information available",
  };
}

function buildDeparturePanelFromAirportOverlay(row: ApiFlightRow): OpsPanelModel | null {
  const ao = row?.airport_overlay_dep ?? null;
  if (!isRealOverlay(ao)) return null;

  const airportCode = safeUpper(ao?.airport_code || row?.dep_airport);
  if (!airportCode) return null;

  const scheduled = fmtOverlayLocalTime(ao?.scheduled_time_local);
  const estimated = fmtOverlayLocalTime(ao?.estimated_time_local);
  const actual = fmtOverlayLocalTime(ao?.actual_time_local);

  const chip = normaliseAenaStatus(ao?.status_text, ao?.status_code, "DEP", ao?.source_name);

  const line2 = buildDepartureDelayLine({
    scheduled,
    estimated,
  });

  const line3 = buildDepartureMovementLine({
    actual,
    chip,
  });

  const line4 = compactJoin([
    normaliseTerminal(ao?.terminal),
    normaliseCheckin(ao?.checkin_area),
    normaliseGate(ao?.gate),
  ]);

  return {
    key: "departure",
    title: `${airportCode} Departure info`,
    statusChip: chip,
    line2,
    line3,
    line4,
    emptyText: "No additional information available",
  };
}

function buildArrivalPanelFromAirportOverlay(row: ApiFlightRow): OpsPanelModel | null {
  const ao = row?.airport_overlay_arr ?? null;
  if (!isRealOverlay(ao)) return null;

  const airportCode = safeUpper(ao?.airport_code || row?.arr_airport);
  if (!airportCode) return null;

  const scheduled = fmtOverlayLocalTime(ao?.scheduled_time_local);
  const estimated = fmtOverlayLocalTime(ao?.estimated_time_local);
  const actual = fmtOverlayLocalTime(ao?.actual_time_local);

  const chip = normaliseAenaStatus(ao?.status_text, ao?.status_code, "ARR", ao?.source_name);

  const line2 = buildArrivalTimingLine({
    scheduled,
    estimated,
    actual,
  });

  const line3 = compactJoin([
    normaliseTerminal(ao?.terminal),
    normaliseGate(ao?.gate),
    normaliseBelt(ao?.belt),
  ]);

  return {
    key: "arrival",
    title: `${airportCode} Arrival info`,
    statusChip: chip,
    line2,
    line3,
    line4: "",
    emptyText: "No additional information available",
  };
}

function buildDeparturePanelFromAirlineFallback(row: ApiFlightRow): OpsPanelModel | null {
  // HV two-day departure panels must never fall through to airline/canonical fallback.
  // Airport source or Unknown only.
  if (isHvDepartureTwoDayOperationalWindow(row)) return null;

  const info = row?.airline_departure_info ?? null;
  if (!info || typeof info !== "object") return null;

  const airportCode = safeUpper(info?.airport_code || row?.dep_airport);
  if (!airportCode) return null;

  const boardingStatus = normalisePublicStatus(info?.boarding_status_text);
  const flightStatus = normalisePublicStatus(info?.status_text);

  const chip = isCancelledFlag(info?.cancelled)
    ? "Cancelled"
    : boardingStatus || flightStatus;

  const scheduled = fmtOverlayLocalTime(info?.scheduled_time_local);
  const estimated = fmtOverlayLocalTime(info?.estimated_time_local);
  const actual = fmtOverlayLocalTime(info?.actual_time_local);

  const line2 = buildDepartureDelayLine({
    scheduled,
    estimated,
  });

  const line3 = buildDepartureMovementLine({
    actual,
    movementStatus: flightStatus,
    chip,
  });

  const line4 = compactJoin([
    normaliseTerminal(info?.terminal),
    normaliseCheckin(info?.checkin_area),
    normaliseGate(info?.gate),
  ]);

  return {
    key: "departure",
    title: `${airportCode} Departure info`,
    statusChip: chip,
    line2,
    line3,
    line4,
    emptyText: "No additional information available",
  };
}

function buildArrivalPanelFromAirlineFallback(row: ApiFlightRow): OpsPanelModel | null {
  const info = row?.airline_arrival_info ?? null;
  if (!info || typeof info !== "object") return null;

  const airportCode = safeUpper(info?.airport_code || row?.arr_airport);
  if (!airportCode) return null;

  // HV no-feed arrival fallback - LOCKED:
  // If there is no Schiphol/airport_overlay_arr arrival feed, do not present
  // HV airline/canonical status as airport arrival information.
  // The arrival panel must remain honest: Unknown + no additional information.
  if (safeUpper(row?.airline_iata) === "HV") {
    return {
      key: "arrival",
      title: `${airportCode} Arrival info`,
      statusChip: "Unknown",
      line2: "",
      line3: "",
      line4: "",
      emptyText: "No additional information available",
    };
  }

  const flightStatus = normalisePublicStatus(info?.status_text);

  const chip = isCancelledFlag(info?.cancelled)
    ? "Cancelled"
    : flightStatus;

  const scheduled = fmtOverlayLocalTime(info?.scheduled_time_local);
  const estimated = fmtOverlayLocalTime(info?.estimated_time_local);
  const actual = fmtOverlayLocalTime(info?.actual_time_local);

  const line2 = buildArrivalTimingLine({
    scheduled,
    estimated,
    actual,
  });

  const line3 = compactJoin([
    normaliseTerminal(info?.terminal),
    normaliseGate(info?.gate),
    normaliseBelt(info?.belt),
  ]);

  return {
    key: "arrival",
    title: `${airportCode} Arrival info`,
    statusChip: chip,
    line2,
    line3,
    line4: "",
    emptyText: "No additional information available",
  };
}

function buildDeparturePanelModel(row: ApiFlightRow): OpsPanelModel | null {
  return (
    buildDeparturePanelFromSchiphol(row) ||
    buildDeparturePanelFromAirportOverlay(row) ||
    buildHvNoFeedDeparturePanel(row) ||
    buildDeparturePanelFromAirlineFallback(row)
  );
}

function buildArrivalPanelModel(row: ApiFlightRow): OpsPanelModel | null {
  return (
    buildArrivalPanelFromSchiphol(row) ||
    buildArrivalPanelFromAirportOverlay(row) ||
    buildArrivalPanelFromAirlineFallback(row)
  );
}

function shouldShowOperationalPanels(row: ApiFlightRow) {
  const now = new Date();
  const todayUtc = dateToUtcDateKey(now);

  const tomorrow = new Date(now.getTime());
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowUtc = dateToUtcDateKey(tomorrow);

  const stdKey = utcDateKeyFromValue(row?.std_utc);
  const staKey = utcDateKeyFromValue(row?.sta_utc);

  return (
    stdKey === todayUtc ||
    stdKey === tomorrowUtc ||
    staKey === todayUtc ||
    staKey === tomorrowUtc
  );
}

function routeAccentClass(row: ApiFlightRow) {
  const dep = safeUpper(row?.dep_airport);
  const arr = safeUpper(row?.arr_airport);

  // Deterministic priority: EIN purple wins over RTM orange.
  if (dep === "EIN" || arr === "EIN") return "day-flightCard--ein";
  if (dep === "RTM" || arr === "RTM") return "day-flightCard--rtm";

  return "";
}

function AirportInfoPanelBlock({ model }: { model: OpsPanelModel }) {
  const hasDetail = Boolean(model.line2 || model.line3 || model.line4);

  return (
    <div className={`day-opsPanel day-opsPanel--${model.key}`}>
      <div className="day-opsPanelHeader">
        <div className="day-opsPanelTitle">{model.title}</div>

        {model.statusChip ? (
          <div className="day-opsChip">{model.statusChip}</div>
        ) : null}
      </div>

      {hasDetail ? (
        <>
          {model.line2 ? (
            <div className="day-opsPanelLine">{model.line2}</div>
          ) : null}

          {model.line3 ? (
            <div className="day-opsPanelLine day-opsPanelLine3">{model.line3}</div>
          ) : null}

          {model.line4 ? (
            <div className="day-opsPanelLine day-opsPanelLine4">{model.line4}</div>
          ) : null}
        </>
      ) : (
        <div className="day-opsPanelEmpty">{model.emptyText}</div>
      )}
    </div>
  );
}

function AirportOperationalPanels({
  row,
  expanded,
}: {
  row: ApiFlightRow;
  expanded: boolean;
}) {
  if (!expanded) return null;
  if (!shouldShowOperationalPanels(row)) return null;

  const departurePanel = buildDeparturePanelModel(row);
  const arrivalPanel = buildArrivalPanelModel(row);

  if (!departurePanel && !arrivalPanel) return null;

  return (
    <>
      {departurePanel ? (
        <>
          <div className="day-zoneDivider" />
          <AirportInfoPanelBlock model={departurePanel} />
        </>
      ) : null}

      {arrivalPanel ? (
        <>
          <div className="day-zoneDivider" />
          <AirportInfoPanelBlock model={arrivalPanel} />
        </>
      ) : null}
    </>
  );
}

/* ----------------------------- AMS previous duty modal (NEW, LOCKED RULE) ----------------------------- */

type PrevDutyChoice = "Flight duty" | "Training" | "Simulator" | "Office duty" | "Other";

const PREV_DUTY_CHOICES: PrevDutyChoice[] = ["Flight duty", "Training", "Simulator", "Office duty", "Other"];

function requiresDetails(choice: PrevDutyChoice) {
  return choice === "Flight duty" || choice === "Other";
}

export default function Day() {
  const nav = useNavigate();
  const loc = useLocation();
  const { auth } = useAuth();
  const { dateKey: dateKeyParam } = useParams();

	const airport = (loc.state as any)?.airport;
	invariant(Boolean(airport), "Day: missing airport in navigation state");
	const airportCode = String(airport).toUpperCase();

	// Inherited from Week when the user opens Day from a filtered Week count.
	// If absent, Day falls back to the shared persisted base-filter preference.
	const incomingBaseFilters = (loc.state as any)?.baseFilters;

	const [activeBaseCodes, setActiveBaseCodes] = useState<BaseFilterCode[]>(() =>
	  readInitialDayBaseFilters(incomingBaseFilters)
	);

	const activeBaseSet = useMemo(() => new Set<string>(activeBaseCodes), [activeBaseCodes]);
	const noBasesSelected = activeBaseCodes.length === 0;

	const toggleBaseFilter = (baseCode: BaseFilterCode) => {
	  setActiveBaseCodes((current) => {
		if (current.includes(baseCode)) {
		  return current.filter((item) => item !== baseCode);
		}

		// Keep output order stable as AMS / RTM / EIN.
		return BASE_FILTER_CODES.filter((item) => item === baseCode || current.includes(item));
	  });
	};

const resolvedIsLoggedIn = auth?.mode === "member";

  const psn = useMemo(() => {
    if (!resolvedIsLoggedIn) return null;

    const raw =
      (auth as any)?.user?.staffNo ??
      (auth as any)?.user?.staff_number ??
      (auth as any)?.user?.staff_identity ??
      (auth as any)?.user?.username ??
      null;

    const v = String(raw || "").trim();
    invariant(Boolean(v), "Invariant violation: missing psn (canonical) for member in Day");
    return v;
  }, [resolvedIsLoggedIn, auth]);

  invariant(Boolean(dateKeyParam), "Day: missing :dateKey param");
  const [dateKey, setDateKey] = useState<string>(String(dateKeyParam));
  useEffect(() => setDateKey(String(dateKeyParam)), [dateKeyParam]);

  const initialTab = useMemo(() => {
    const qs = new URLSearchParams(loc.search || "");
    const t = String(qs.get("tab") || "").trim().toLowerCase();
    if (t === "arrivals") return "arrivals";
    if (t === "departures") return "departures";
    return "departures";
  }, [loc.search]);

  const [tab, setTab] = useState<"departures" | "arrivals">(initialTab);
  useEffect(() => setTab(initialTab), [initialTab]);
  
	useEffect(() => {
	  try {
		localStorage.setItem(BASE_FILTER_STORAGE_KEY, JSON.stringify(activeBaseCodes));
	  } catch {
		// best-effort only
	  }
	}, [activeBaseCodes]);

  const minDateKey = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return dateToLocalDateKey(d);
  }, []);

  const maxDateKey = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 8);
    return dateToLocalDateKey(d);
  }, []);

  const canGoPrev = useMemo(
    () => !isBefore(dateKey, minDateKey) && dateKey !== minDateKey,
    [dateKey, minDateKey]
  );

  const canGoNext = useMemo(
    () => !isAfter(dateKey, maxDateKey) && dateKey !== maxDateKey,
    [dateKey, maxDateKey]
  );

  const [dateBoundMsg, setDateBoundMsg] = useState("");

  const flashBoundMsg = (msg: string) => {
    setDateBoundMsg(msg);
    window.setTimeout(() => setDateBoundMsg(""), 1200);
  };

  const dateLabel = useMemo(() => {
    const d = new Date(`${dateKey}T00:00:00`);
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [dateKey]);

  const shortDateForModal = useMemo(() => {
    const d = new Date(`${dateKey}T00:00:00`);
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [dateKey]);

  const prevDowShort = useMemo(() => {
    try {
      const d = new Date(`${dateKey}T00:00:00`);
      d.setDate(d.getDate() - 1);
      return d.toLocaleDateString("en-GB", { weekday: "short" });
    } catch {
      return "−";
    }
  }, [dateKey]);

  const nextDowShort = useMemo(() => {
    try {
      const d = new Date(`${dateKey}T00:00:00`);
      d.setDate(d.getDate() + 1);
      return d.toLocaleDateString("en-GB", { weekday: "short" });
    } catch {
      return "+";
    }
  }, [dateKey]);

  const stepDateKey = (deltaDays: number) => {
    try {
      const d = new Date(`${dateKey}T00:00:00`);
      if (Number.isNaN(d.getTime())) return;
      d.setDate(d.getDate() + deltaDays);
      const nextKey = dateToLocalDateKey(d);

      if (isBefore(nextKey, minDateKey)) {
        flashBoundMsg("You can’t go earlier than yesterday.");
        return;
      }
      if (isAfter(nextKey, maxDateKey)) {
        flashBoundMsg("No more days available.");
        return;
      }

      const qs = tab === "arrivals" ? "tab=arrivals" : "tab=departures";
		nav(`/day/${nextKey}?${qs}`, {
		  state: {
			airport: airportCode,
			baseFilters: activeBaseCodes,
		  },
		});
    } catch {
      // ignore
    }
  };

  // ---- API state ----
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [lastStatusUpdatedUtc, setLastStatusUpdatedUtc] = useState<string | null>(null);
  const [lastScheduleUpdatedUtc, setLastScheduleUpdatedUtc] = useState<string | null>(null);

  const [rawRows, setRawRows] = useState<any>({
    departures: [],
    arrivals: [],
    flights: [],
  });

  const [bookingsByFlight, setBookingsByFlight] = useState<Record<string, BookingRow[]>>({});
  
  const [linkedVisibilityByFlight, setLinkedVisibilityByFlight] = useState<Record<string, LinkedCommuterRow[]>>({});

  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshInFlightRef = useRef(false);
  const pollTimerRef = useRef<number | null>(null);

  const startAutoRefreshTimer = () => {
    if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    pollTimerRef.current = window.setInterval(() => {
      refreshDay({ showLoading: false });
    }, POLL_MS);
  };

  async function refreshDay({ showLoading = false }: { showLoading?: boolean } = {}) {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;

    try {
      setErrorText("");
      if (showLoading) setLoading(true);

      // 1) ensure fresh (ignore errors per RN)
      try {
        const ensureResp: any = await ensureDayStatusFresh({ airportCode, dateKey });
        const last =
          ensureResp?.last_updated_utc ??
          ensureResp?.lastUpdatedUtc ??
          ensureResp?.status_last_updated_utc ??
          ensureResp?.meta?.status_last_updated_utc ??
          null;
        if (last) setLastStatusUpdatedUtc(String(last));
      } catch {
        // ignore
      }

      // 2) flights
      const dayResp: any = await getFlightsForDay({ airportCode, dateKey });

      const depRows = Array.isArray(dayResp?.departures) ? dayResp.departures : [];
      const arrRows = Array.isArray(dayResp?.arrivals) ? dayResp.arrivals : [];
      const flatRows = Array.isArray(dayResp?.flights) ? dayResp.flights : [];

      setRawRows({
        departures: depRows,
        arrivals: arrRows,
        flights: flatRows,
      });

      const last2 =
        dayResp?.status_last_updated_utc ??
        dayResp?.meta?.status_last_updated_utc ??
        dayResp?.last_updated_utc ??
        dayResp?.meta?.last_updated_utc ??
        dayResp?.lastUpdatedUtc ??
        null;
      if (last2) setLastStatusUpdatedUtc(String(last2));

      const sched =
        dayResp?.schedule_last_updated_utc ??
        dayResp?.meta?.schedule_last_updated_utc ??
        dayResp?.scheduleLastUpdatedUtc ??
        dayResp?.meta?.scheduleLastUpdatedUtc ??
        null;
      if (sched) setLastScheduleUpdatedUtc(String(sched));

      // 3) bookings (ALWAYS load)
      try {
        const bookingsResp: any = await getBookingsForDay({ airportCode, dateKey, staffNo: psn });

        const by = bookingsResp?.by_flight_instance_id;

        invariant(
          Boolean(by && typeof by === "object"),
          "Invariant violation: bookings response missing by_flight_instance_id"
        );

        Object.keys(by).forEach((k) => {
          invariant(
            Boolean(String(k).trim()),
            "Invariant violation: bookingsByFlight contains empty flight_instance_id key"
          );
        });

        setBookingsByFlight(by);

		const linked = bookingsResp?.linked_visibility_by_flight_instance_id;

		setLinkedVisibilityByFlight(
		  linked && typeof linked === "object" && !Array.isArray(linked)
			? linked
			: {}
		);		
					
		
      } catch (e: any) {
        setErrorText(e?.message || "Failed to load commuter list");
        setBookingsByFlight({});
		setLinkedVisibilityByFlight({});
      }

      setLoading(false);
    } catch (e: any) {
      setErrorText(e?.message || "Failed to load flights");
      setLoading(false);
    } finally {
      refreshInFlightRef.current = false;
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    let alive = true;

    async function start() {
      await refreshDay({ showLoading: true });
      if (!alive) return;
      startAutoRefreshTimer();
    }

    start();

    return () => {
      alive = false;
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airportCode, dateKey, psn]);

  type FlightItem = {
    flightInstanceId: string;
    uiKey: string;
    row: ApiFlightRow;
  };

  const flights: FlightItem[] = useMemo(() => {
  const airport = String(airportCode || "").toUpperCase();

  // All OFF is a valid state. Return no rows.
  if (activeBaseSet.size === 0) return [];

  const fromApiDepartures = Array.isArray(rawRows?.departures) ? rawRows.departures : null;
  const fromApiArrivals = Array.isArray(rawRows?.arrivals) ? rawRows.arrivals : null;

  const matchesDepartureFilter = (r: ApiFlightRow) => {
    const dep = safeUpper(r?.dep_airport);
    const arr = safeUpper(r?.arr_airport);

    // Departures tab: selected airport -> active base.
    return dep === airport && activeBaseSet.has(arr);
  };

  const matchesArrivalFilter = (r: ApiFlightRow) => {
    const dep = safeUpper(r?.dep_airport);
    const arr = safeUpper(r?.arr_airport);

    // Arrivals tab: active base -> selected airport.
    return arr === airport && activeBaseSet.has(dep);
  };

  let filtered: ApiFlightRow[] = [];

  if (tab === "departures") {
    filtered = (fromApiDepartures || []).filter(matchesDepartureFilter);
  } else {
    filtered = (fromApiArrivals || []).filter(matchesArrivalFilter);
  }

  // Legacy / fallback shape: some API responses expose only a flat flights array.
  if ((!fromApiDepartures || !fromApiArrivals) && Array.isArray(rawRows?.flights)) {
    const legacyRows: ApiFlightRow[] = rawRows.flights;

    filtered =
      tab === "departures"
        ? legacyRows.filter(matchesDepartureFilter)
        : legacyRows.filter(matchesArrivalFilter);
  }

  return filtered.map((r) => {
    const flightInstanceId = String(r?.flight_instance_id || "").trim();
    invariant(Boolean(flightInstanceId), "Invariant violation: flight row missing flight_instance_id in Day");

    return {
      flightInstanceId,
      uiKey: `flight-${flightInstanceId}`,
      row: r,
    };
  });
}, [rawRows, tab, airportCode, activeBaseSet]);

  function formatListedAtDisplay(raw: string | null | undefined): string {
    if (!raw) return "--";

    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "--";

    const day = d.toLocaleDateString("en-GB", { day: "2-digit" });
    const month = d.toLocaleDateString("en-GB", { month: "short" });
    const time = d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    return `${day} ${month} / ${time}`;
  }

  function crewListForFlight(flightInstanceId: string): CrewRow[] {
    const rows = Array.isArray(bookingsByFlight?.[flightInstanceId])
      ? bookingsByFlight[flightInstanceId]
      : [];

    return rows
      .slice()
      .sort((a, b) => {
        const pa = Number(a?.listing_prio);
        const pb = Number(b?.listing_prio);

        const na = Number.isNaN(pa) ? 9999 : pa;
        const nb = Number.isNaN(pb) ? 9999 : pb;
        if (na !== nb) return na - nb;

        const ta = String(a?.requested_at_utc || "");
        const tb = String(b?.requested_at_utc || "");
        if (ta !== tb) return ta.localeCompare(tb);

        const ia = Number(a?.id) || 0;
        const ib = Number(b?.id) || 0;
        return ia - ib;
      })
      .map((b) => {
        const rowPsn = String(b?.psn || "").trim();
        invariant(Boolean(rowPsn), "Invariant violation: booking row missing psn");

        const first = String(b?.firstname || "").trim();
        const last = String(b?.lastname || "").trim();
        const fullName = `${first} ${last}`.trim();
        invariant(Boolean(fullName), "Invariant violation: booking row missing firstname/lastname");

        const status = normalizeBookingStatusStrict(b?.status);

        return {
          bookingId: b?.id,
          role: b?.x_type || null,
          fullName,
          staffNo: rowPsn,
          status,
          securityNo: b?.security_number || null,
          listedAt: b?.requested_at_utc || null,
        };
      });
  }

  
function linkedCommutersForFlight(flightInstanceId: string): LinkedCommuterRow[] {
  const rows = Array.isArray(linkedVisibilityByFlight?.[flightInstanceId])
    ? linkedVisibilityByFlight[flightInstanceId]
    : [];

  // LINKED 3-HOEK VISIBILITY - FRONTEND CONTRACT:
  // - Informational only.
  // - Not ranked.
  // - Not merged into Listed commuters.
  // - Not included in commuter summary or X-staff totals.
  // - Not used for can_unlist / unlist_mode.
  return rows
    .slice()
    .sort((a, b) => {
      const ar = `${String(a?.dep_airport || "")}-${String(a?.arr_airport || "")}`;
      const br = `${String(b?.dep_airport || "")}-${String(b?.arr_airport || "")}`;
      if (ar !== br) return ar.localeCompare(br);

      const an = `${String(a?.lastname || "")} ${String(a?.firstname || "")}`;
      const bn = `${String(b?.lastname || "")} ${String(b?.firstname || "")}`;
      return an.localeCompare(bn);
    });
}  
  
  
  function isUserListed(flightInstanceId: string) {
    if (!resolvedIsLoggedIn) return false;
    const rows = bookingsByFlight?.[flightInstanceId] || [];
    return rows.some((b) => String(b?.psn || "").trim() === String(psn || "").trim());
  }

  function getMyBookingRow(flightInstanceId: string): BookingRow | null {
    if (!resolvedIsLoggedIn) return null;
    const rows = bookingsByFlight?.[flightInstanceId] || [];
    return rows.find((b) => String(b?.psn || "").trim() === String(psn || "").trim()) || null;
  }

  function canShowUnlistButton(flightInstanceId: string): boolean {
    const myRow = getMyBookingRow(flightInstanceId);
    return myRow?.can_unlist === true;
  }

  function getUnlistModeForFlight(flightInstanceId: string): "type1" | "type2" | "none" {
    const myRow = getMyBookingRow(flightInstanceId);
    const mode = String(myRow?.unlist_mode || "").trim().toLowerCase();
    if (mode === "type1") return "type1";
    if (mode === "type2") return "type2";
    return "none";
  }

  // ---- confirm modal ----
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmMode, setConfirmMode] = useState<"list" | "unlist">("list");
  const [confirmMeta, setConfirmMeta] = useState<{ flightInstanceId: string; row: ApiFlightRow } | null>(null);
  const [confirmErrorText, setConfirmErrorText] = useState("");

  const [actionBusyByFlight, setActionBusyByFlight] = useState<Record<string, "list" | "unlist" | null>>({});
  const [actionSuccessByFlight, setActionSuccessByFlight] = useState<Record<string, "listed" | "unlisted" | null>>(
    {}
  );

  // ---- AMS previous duty modal state (only used when dep_airport === AMS and listing) ----
  const [amsDutyVisible, setAmsDutyVisible] = useState(false);
  const [amsDutyFlightMeta, setAmsDutyFlightMeta] = useState<{ flightInstanceId: string; row: ApiFlightRow } | null>(
    null
  );
  const [amsDutyChoice, setAmsDutyChoice] = useState<PrevDutyChoice>("Flight duty");
  const [amsDutyDetails, setAmsDutyDetails] = useState("");
  const [amsDutyError, setAmsDutyError] = useState("");

  // ---- Info modal (for ALL listed commuters) ----
  type InfoMeta = {
    fullName: string;
    staffNo: string;
    role: string | null;
    listedAt: string | null;
    status: "confirmed" | "sent" | "pending";
    flightNo: string;
  };

  const [infoVisible, setInfoVisible] = useState(false);
  const [infoMeta, setInfoMeta] = useState<InfoMeta | null>(null);

  const [airportInfoOpen, setAirportInfoOpen] = useState(false);
  const [airportInfoCode, setAirportInfoCode] = useState<string | null>(null);

  function openConfirm(mode: "list" | "unlist", args: { flightInstanceId: string; row: ApiFlightRow }) {
    setConfirmMode(mode);
    setConfirmErrorText("");
    setConfirmMeta({ flightInstanceId: args.flightInstanceId, row: args.row });
    setConfirmVisible(true);
  }

  function openAmsDutyModal(args: { flightInstanceId: string; row: ApiFlightRow }) {
    setAmsDutyFlightMeta(args);
    setAmsDutyChoice("Flight duty");
    setAmsDutyDetails("");
    setAmsDutyError("");
    setAmsDutyVisible(true);
  }

  function openInfoModal(meta: InfoMeta) {
    setInfoMeta(meta);
    setInfoVisible(true);
  }

  function openAirportInfo(codeLike: string | null | undefined) {
    const code = String(codeLike || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 3);

    if (!code) return;

    setAirportInfoCode(code);
    setAirportInfoOpen(true);
  }

  function closeAirportInfo() {
    setAirportInfoOpen(false);
    setAirportInfoCode(null);
  }

  function mapBackendErrorToUserMessage(e: any): string {
    // We expect backend to return { ok:false, code, message } and requestJson throws message
    const msg = String(e?.message || "Request failed");

    // Make the known rule failures explicit to the user
    if (msg.toLowerCase().includes("not allowed to have 2 listings")) {
      return "Not allowed to have 2 listings from the same airport on the same day.";
    }
    if (msg.toLowerCase().includes("cutoff")) {
      return "Listing cutoff has passed for this departure station.";
    }
    if (msg.toLowerCase().includes("day of travel")) {
      return "Listing is not allowed on the day of travel.";
    }
    if (msg.toLowerCase().includes("00:30 local")) {
      return "Unlisting is not available after station cutoff until 00:30 local on the day of travel.";
    }
    if (msg.toLowerCase().includes("60 minutes")) {
      return "Unlisting is not allowed within 60 minutes of departure (or after departure).";
    }
    if (msg.toLowerCase().includes("cancelled flight")) {
      return "Action not available: flight is cancelled.";
    }
    return msg;
  }

  async function commitConfirm(extra?: { previous_duty?: string; previous_duty_details?: string }) {
    if (!confirmMeta?.flightInstanceId) {
      setConfirmVisible(false);
      return;
    }

    const flightInstanceId = confirmMeta.flightInstanceId;
    const mode = confirmMode;

    invariant(
      Boolean(String(flightInstanceId || "").trim()),
      "Invariant violation: missing flight_instance_id at Day write-path"
    );
    invariant(Boolean(psn), "Invariant violation: missing psn at Day write-path");

    setActionBusyByFlight((prev) => ({ ...prev, [flightInstanceId]: mode }));

    try {
      await setBookingListed({
        mode,
        flightInstanceId,
        staffNo: psn,
        ...(mode === "list" ? extra : null),
      });

      setConfirmVisible(false);
      await refreshDay();

      setActionSuccessByFlight((prev) => ({ ...prev, [flightInstanceId]: mode === "list" ? "listed" : "unlisted" }));
      window.setTimeout(() => {
        setActionSuccessByFlight((prev) => {
          const next = { ...prev };
          delete next[flightInstanceId];
          return next;
        });
      }, 1200);
    } catch (e: any) {
      setConfirmErrorText(mapBackendErrorToUserMessage(e));
    } finally {
      setActionBusyByFlight((prev) => {
        const next = { ...prev };
        delete next[flightInstanceId];
        return next;
      });
    }
  }

  const onManualRefresh = async () => {
    if (isRefreshing || refreshInFlightRef.current) return;
    setIsRefreshing(true);
    await refreshDay({ showLoading: false });
    startAutoRefreshTimer();
  };

  const databaseLabel = useMemo(() => {
    if (!lastScheduleUpdatedUtc) return "";
    return new Date(lastScheduleUpdatedUtc).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }, [lastScheduleUpdatedUtc]);

  const refreshedLabel = useMemo(() => {
    if (!lastStatusUpdatedUtc) return "";
    return new Date(lastStatusUpdatedUtc).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }, [lastStatusUpdatedUtc]);

  const airportLogoSrc = getAirportLogo(airportCode);

  const metaD = databaseLabel ? `D: ${databaseLabel}` : "";
  const metaR = refreshedLabel ? `R: ${refreshedLabel}` : "";

  const metaHelpText =
    "D = Schedule refresh: when the backend last refreshed scheduled times.\n" +
    "R = Status refresh: when the backend last refreshed live status.";

  return (
    <div className="app-screen">
      <div className="day-sticky">
        <div className="app-container">
          <section className="day-headerCard">
            <div className="day-headerTopRow">
              <div className="day-metaLeft">
                <div className="day-metaHead">
                  <div className="day-metaLines">
                    {loading || isRefreshing ? (
                      <div className="day-metaLine">
                        <span className="day-spinner" aria-label="Updating" />
                      </div>
                    ) : errorText ? (
                      <div className="day-metaLine" title={errorText}>
                        {errorText}
                      </div>
                    ) : (
                      <>
                        {!!metaD && <div className="day-metaLine">{metaD}</div>}
                        {!!metaR && <div className="day-metaLine">{metaR}</div>}
                        {!metaD && !metaR ? <div className="day-metaLine"> </div> : null}
                      </>
                    )}

                    {dateBoundMsg ? (
                      <div className="day-metaLine day-metaLineWarn" title={dateBoundMsg}>
                        {dateBoundMsg}
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    className="day-metaInfo"
                    aria-label="What are D and R?"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.alert(metaHelpText);
                    }}
                  >
                    i
                  </button>
                </div>
              </div>

              <div className="day-logoCenter">
                {airportLogoSrc ? (
                  <button
                    type="button"
                    className="day-airportLogoBtn"
                    onClick={() => openAirportInfo(airportCode)}
                    aria-label={`Open airport info for ${airportCode}`}
                    title="Airport info"
                  >
                    <img src={airportLogoSrc} alt={`${airportCode} logo`} className="day-airportLogo" />
                  </button>
                ) : null}
              </div>

              <div className="day-backRight">
                <BackButton onClick={() => nav(-1)} ariaLabel="Back" size={38} />
              </div>
            </div>

            <div className="day-tabsWrap">
              <button
                type="button"
                onClick={() => {
				  setTab("departures");
				  nav(`/day/${dateKey}?tab=departures`, {
					state: {
					  airport: airportCode,
					  baseFilters: activeBaseCodes,
					},
					replace: true,
				  });
				}}
                className={`day-tabBtn ${tab === "departures" ? "day-tabBtnActive" : ""}`}
              >
                Departures
              </button>

              <button
                type="button"
                onClick={() => {
				  setTab("arrivals");
				  nav(`/day/${dateKey}?tab=arrivals`, {
					state: {
					  airport: airportCode,
					  baseFilters: activeBaseCodes,
					},
					replace: true,
				  });
				}}
                className={`day-tabBtn ${tab === "arrivals" ? "day-tabBtnActive" : ""}`}
              >
                Arrivals
              </button>
            </div>
            <div className="day-baseFilterRow" aria-label="Flight base filters">
              {BASE_FILTER_CODES.map((baseCode) => {
                const isActive = activeBaseSet.has(baseCode);

                return (
                  <button
                    key={baseCode}
                    type="button"
                    className={`day-baseMiniPill ${
                      isActive ? "day-baseMiniPillActive" : "day-baseMiniPillInactive"
                    }`}
                    onClick={() => toggleBaseFilter(baseCode)}
                    aria-pressed={isActive}
                    aria-label={`${baseCode} base filter ${isActive ? "on" : "off"}`}
                  >
                    {baseCode}
                  </button>
                );
              })}
            </div>

            {noBasesSelected && <div className="day-baseFilterEmpty">No bases selected</div>}
            <div className="day-dateStepperRow">
              <button
                type="button"
                onClick={() => stepDateKey(-1)}
                disabled={!canGoPrev}
                className="day-dateStepperBtn"
                style={{ opacity: canGoPrev ? 1 : 0.35 }}
              >
                {prevDowShort}
              </button>

              <div className="day-dateLabel">{dateLabel}</div>

              <button
                type="button"
                onClick={() => stepDateKey(1)}
                disabled={!canGoNext}
                className="day-dateStepperBtn"
                style={{ opacity: canGoNext ? 1 : 0.35 }}
              >
                {nextDowShort}
              </button>
            </div>
          </section>
        </div>
      </div>

      <div className="app-container day-body">
        {flights.map((f) => {
          const fid = f.flightInstanceId;
          const row = f.row || {};

          const userListed = resolvedIsLoggedIn ? isUserListed(fid) : false;

          const xStaff = Array.isArray(bookingsByFlight?.[fid]) ? bookingsByFlight[fid].length : 0;
          const crew = resolvedIsLoggedIn ? crewListForFlight(fid) : [];
		  const linkedCrew = resolvedIsLoggedIn && userListed ? linkedCommutersForFlight(fid) : [];
          const actionCfg = actionConfigForFlight(row?.airline_iata, userListed);

          const busyMode = actionBusyByFlight?.[fid] || null;
          const successState = actionSuccessByFlight?.[fid] || null;

          const canUnlist = canShowUnlistButton(fid);
          const unlistMode = getUnlistModeForFlight(fid);

          const todayKey = dateToLocalDateKey(new Date());
          const isDayOfTravel = dateKey === todayKey;

          const opStatusKey = String(row?.op_status || "").trim().toUpperCase();

          const showActionButton =
            actionCfg.show &&
            (userListed ? canUnlist : !isDayOfTravel);

          const disableActionButton =
            opStatusKey === "CANCELLED" ||
            busyMode !== null;

          const actionLabel = (() => {
            if (opStatusKey === "CANCELLED") return "Flight cancelled";
            if (busyMode === "list") return "Listing…";
            if (busyMode === "unlist") return "Unlisting…";
            if (successState === "listed") return "Listed me";
            if (successState === "unlisted") return "Unlisted me";

            if (userListed) {
              if (unlistMode === "type1") return "Unlist from flight";
              if (unlistMode === "type2") return "Cancel flight listing";
            }

            return actionCfg.label;
          })();

          const cardFlight = row;

          const xcm = crew.filter((u) => u.role === "XCM").length;
          const xfa = crew.filter((u) => u.role === "XFA").length;
          const other = crew.filter((u) => u.role !== "XCM" && u.role !== "XFA").length;

          const isDepAMS = safeUpper(row?.dep_airport) === "AMS";

          const flightNo = `${String(row?.airline_iata || "").toUpperCase()}${String(row?.flight_number || "").trim()}`.trim();

          // Background wiring for later collapsible operational panels.
          // Current agreed behaviour: always expanded.
          // Later this can become per-flight state toggled from the 3x3 status/card area.
          const airportOpsPanelsExpanded = true;

          const accentClass = routeAccentClass(row);

          return (
            <div
              key={f.uiKey}
              className={`card day-flightCard ${accentClass}`.trim()}
            >
              <div className="day-publicSection">
                <FlightCard3x3
                  flight={cardFlight}
                  showHeader={false}
                  footerRightContent={<span className="flightCard-xstaff">X-staff: {xStaff}</span>}
                />

                <AirportOperationalPanels
                  row={row}
                  expanded={airportOpsPanelsExpanded}
                />
              </div>

              {resolvedIsLoggedIn ? (
                <div className="day-memberArea">
                  {xStaff > 0 ? (
                    <div>
                      <div className="day-zoneSubtitle">Commuter summary</div>

                      <div className="day-zoneRow2">
                        <div className="day-zoneMetaText">XCM : {xcm}</div>
                        <div className="day-zoneMetaText">XFA : {xfa}</div>
                        <div className="day-zoneMetaText">Other : {other}</div>
                      </div>
                    </div>
                  ) : null}

                  {/* Listing information block removed (per confirmed scope) */}

                  {userListed && crew.length > 0 ? (
                    <>
                      <div className="day-zoneDivider" />

                      <div>
                        <div className="day-zoneSubtitle">Listed commuters: {crew.length}</div>

                        <div style={{ marginTop: 8 }}>
                          {crew.map((u, idx) => {
                            const isSelf = String(u.staffNo || "").trim() === String(psn || "").trim();

                            const statusIcon =
                              u.status === "confirmed"
                                ? LISTING_STATUS_ICONS.booked
                                : u.status === "sent"
                                ? LISTING_STATUS_ICONS.sent
                                : LISTING_STATUS_ICONS.pending;

                            return (
                              <div
                                key={`${u.staffNo}-${u.listedAt}-${idx}`}
                                onClick={() =>
                                  openInfoModal({
                                    fullName: u.fullName,
                                    staffNo: u.staffNo,
                                    role: u.role || null,
                                    listedAt: u.listedAt || null,
                                    status: u.status,
                                    flightNo,
                                  })
                                }
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: 10,
                                  padding: "8px 8px",
                                  borderRadius: 12,
                                  background: "transparent",
                                  border: "0",
                                  borderBottom: "1px solid rgba(19,35,51,0.06)",
                                  marginBottom: 8,
                                  WebkitTapHighlightColor: "rgba(0,0,0,0)",
                                }}
                                aria-label={`Open info for ${u.fullName}`}
                              >
                                <div
                                  style={{
                                    width: 28,
                                    fontWeight: 700,
                                    color: "rgba(19,35,51,0.55)",
                                    fontSize: 12,
                                    paddingTop: 2,
                                    flexShrink: 0,
                                  }}
                                >
                                  {`P${idx + 1}.`}
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontWeight: isSelf ? 900 : 800,
                                      color: isSelf ? "#b91c1c" : "rgba(19,35,51,0.86)",
                                      fontSize: 12,
                                      lineHeight: "16px",
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    {u.fullName}
                                  </div>

                                  <div
                                    style={{
                                      marginTop: 2,
                                      fontWeight: 800,
                                      color: "rgba(19,35,51,0.62)",
                                      fontSize: 12,
                                      lineHeight: "16px",
                                      display: "flex",
                                      gap: 10,
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <span title={u.staffNo}>{u.staffNo}</span>
                                    <span title={u.role || "Other"}>{u.role || "Other"}</span>
                                  </div>
                                </div>

                                <div style={{ width: 22, flexShrink: 0, paddingTop: 1 }}>
                                  <img
                                    src={statusIcon}
                                    alt={u.status}
                                    style={{ width: 20, height: 20, display: "block" }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : null}

				  
{userListed && linkedCrew.length > 0 ? (
  <>
    <div className="day-zoneDivider" />

    <div>
      <div className="day-zoneSubtitle">Linked commuters</div>

      <div
        style={{
          marginTop: 6,
          fontWeight: 700,
          fontSize: 12,
          lineHeight: "17px",
          color: "rgba(19,35,51,0.62)",
        }}
      >
        Shown on 3-hoek flights only - for awareness!
      </div>

      <div style={{ marginTop: 8 }}>
        {linkedCrew.map((u, idx) => {
          const first = String(u?.firstname || "").trim();
          const last = String(u?.lastname || "").trim();
          const fullName = `${first} ${last}`.trim() || "Commuter";

          const status = normalizeBookingStatusStrict(u?.status);

          const statusIcon =
            status === "confirmed"
              ? LISTING_STATUS_ICONS.booked
              : status === "sent"
              ? LISTING_STATUS_ICONS.sent
              : LISTING_STATUS_ICONS.pending;

          return (
            <div
              key={`${u.flight_instance_id}-${u.psn}-${idx}`}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                padding: "7px 8px",
                borderRadius: 12,
                background: "rgba(19,35,51,0.025)",
                border: "1px solid rgba(19,35,51,0.05)",
                marginBottom: 8,
              }}
              aria-label={`Linked commuter ${fullName}`}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: "rgba(19,35,51,0.35)",
                  marginTop: 4,
                  flexShrink: 0,
                }}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 800,
                    color: "rgba(19,35,51,0.86)",
                    fontSize: 12,
                    lineHeight: "16px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {fullName}
                </div>

                <div
                  style={{
                    marginTop: 2,
                    fontWeight: 800,
                    color: "rgba(19,35,51,0.62)",
                    fontSize: 12,
                    lineHeight: "16px",
                    display: "flex",
                    gap: 18,
                    flexWrap: "wrap",
                  }}
                >
                  <span title={u.psn}>{u.psn}</span>
                  <span title={u.x_type || "Other"}>{u.x_type || "Other"}</span>
                  <span>
                    {safeUpper(u.dep_airport)}-{safeUpper(u.arr_airport)}
                  </span>
                </div>
              </div>

              <div style={{ width: 22, flexShrink: 0, paddingTop: 1 }}>
                <img
                  src={statusIcon}
                  alt={status}
                  style={{ width: 20, height: 20, display: "block" }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </>
) : null}				  
				  
                  {showActionButton ? (
                    <>
                      <div className="day-zoneDivider" />

                      <button
                        type="button"
                        onClick={() => {
                          // CANCELLED: no action at all (server also enforces)
                          if (opStatusKey === "CANCELLED") return;

                          if (!userListed && isDepAMS) {
                            // Step 1: open AMS duty modal, which will then open Confirm
                            openAmsDutyModal({ flightInstanceId: fid, row });
                            return;
                          }

                          // Normal flow: confirm list/unlist
                          openConfirm(userListed ? "unlist" : "list", { flightInstanceId: fid, row });
                        }}
                        disabled={disableActionButton || busyMode !== null}
                        className={`day-actionBtn ${userListed ? "day-actionBtnAmber" : "day-actionBtnGreen"}`}
                        style={{
                          width: "70%",
                          alignSelf: "center",
                          opacity: disableActionButton || busyMode !== null ? 0.45 : 1,
                        }}
                      >
                        {actionLabel}
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* AMS previous duty modal */}
      {amsDutyVisible ? (
        <div
          className="day-overlay"
          onClick={() => {
            setAmsDutyVisible(false);
            setAmsDutyError("");
          }}
        >
          <div className="day-modalCard" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 900, fontSize: 16, color: "#132333" }}>Previous duty (AMS)</div>

            <div style={{ marginTop: 10, color: "rgba(19,35,51,0.75)", fontWeight: 700, lineHeight: "18px" }}>
              Required for Amsterdam departures.
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 12, color: "rgba(19,35,51,0.75)", marginBottom: 6 }}>Select duty</div>
              <select
                className="select"
                value={amsDutyChoice}
                onChange={(e) => {
                  const v = e.target.value as PrevDutyChoice;
                  setAmsDutyChoice(v);
                  setAmsDutyError("");
                }}
                style={{ width: "100%" }}
              >
                {PREV_DUTY_CHOICES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {requiresDetails(amsDutyChoice) ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 12, color: "rgba(19,35,51,0.75)", marginBottom: 6 }}>
                  {amsDutyChoice === "Flight duty" ? "Flight number" : "More details"}
                </div>
                <input
                  className="input"
                  value={amsDutyDetails}
                  onChange={(e) => {
                    setAmsDutyDetails(e.target.value);
                    setAmsDutyError("");
                  }}
                  placeholder={amsDutyChoice === "Flight duty" ? "e.g. KL1234" : "Type details"}
                  style={{ width: "100%" }}
                />
              </div>
            ) : null}

            {amsDutyError ? <div style={{ marginTop: 10, fontWeight: 900, color: "#b91c1c" }}>{amsDutyError}</div> : null}

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
                  setAmsDutyVisible(false);
                  setAmsDutyError("");
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
                }}
                onClick={() => {
                  // Local validation mirrors server expectation (server is authoritative)
                  if (requiresDetails(amsDutyChoice) && String(amsDutyDetails || "").trim() === "") {
                    setAmsDutyError(amsDutyChoice === "Flight duty" ? "Flight number required." : "Details required.");
                    return;
                  }

                  // Close this modal, then open confirm in LIST mode for that flight
                  const meta = amsDutyFlightMeta;
                  if (!meta?.flightInstanceId) {
                    setAmsDutyVisible(false);
                    return;
                  }

                  setAmsDutyVisible(false);

                  // Open confirm explicitly as LIST
                  setConfirmMode("list");
                  setConfirmErrorText("");
                  setConfirmMeta({ flightInstanceId: meta.flightInstanceId, row: meta.row });
                  setConfirmVisible(true);
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Confirm modal */}
      {confirmVisible ? (
        <div
          className="day-overlay"
          onClick={() => {
            setConfirmVisible(false);
            setConfirmErrorText("");
          }}
        >
          <div className="day-modalCard" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 900, fontSize: 16, color: "#132333" }}>
              {confirmMode === "list"
                ? "Confirm listing"
                : confirmMeta?.row && getUnlistModeForFlight(confirmMeta.flightInstanceId) === "type2"
                ? "Cancel flight listing"
                : "Unlist from flight"}
            </div>

            {/* ============================================================
               THIS CHANGE ONLY
               - Branch modal body by unlist type
               - Type 1 → internal only warning
               - Type 2 → destructive + airport notification
               - If backend returns an error, suppress normal modal body and show only the error
               ============================================================ */}
            {!confirmErrorText ? (
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
                  : (() => {
                      const mode = confirmMeta?.flightInstanceId
                        ? getUnlistModeForFlight(confirmMeta.flightInstanceId)
                        : "none";

                      if (mode === "type2") {
                        return `\u2022 This will cancel your check-in and flight listing for this flight.\n\n\u2022 The airport will be notified of your cancellation.\n\n\u2022 This action cannot be undone.`;
                      }

                      // default = type1
                      return `\u2022 You will be removed from this flight’s commuter list.\n\n\u2022 Your current position will be lost and may change if you re-list later.`;
                    })()}
              </div>
            ) : null}

            {confirmErrorText ? (
              <div style={{ marginTop: 10, fontWeight: 900, color: "#b91c1c", lineHeight: "20px" }}>
                {confirmErrorText}
              </div>
            ) : null}

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
                  setConfirmErrorText("");
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
                    confirmMeta?.flightInstanceId &&
                      actionBusyByFlight?.[confirmMeta.flightInstanceId]
                  )
                    ? 0.55
                    : 1,
                }}
                disabled={Boolean(
                  confirmMeta?.flightInstanceId &&
                    actionBusyByFlight?.[confirmMeta.flightInstanceId]
                )}
                onClick={() => {
                  const meta = confirmMeta;
                  if (!meta?.flightInstanceId) {
                    setConfirmVisible(false);
                    return;
                  }

                  const dep = safeUpper(meta.row?.dep_airport);
                  if (confirmMode === "list" && dep === "AMS") {
                    commitConfirm({
                      previous_duty: amsDutyChoice,
                      previous_duty_details: amsDutyDetails,
                    });
                    return;
                  }

                  commitConfirm();
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Airport info modal */}
      <AirportInfoModal
        isOpen={airportInfoOpen}
        airportCode={airportInfoCode}
        onClose={closeAirportInfo}
      />

      {/* Info modal (updated per confirmed scope) */}
      {infoVisible ? (
        <div
          className="day-overlay"
          onClick={() => {
            setInfoVisible(false);
            setInfoMeta(null);
          }}
        >
          <div className="day-modalCard" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 900, fontSize: 16, color: "#132333" }}>
              {(infoMeta?.fullName || "").trim() || "Commuter"}{" "}
              <span style={{ fontWeight: 800, color: "rgba(19,35,51,0.70)", fontSize: 13 }}>
                — {infoMeta?.flightNo || ""} — {shortDateForModal}
              </span>
            </div>

            <div style={{ height: 12 }} />

            <div style={{ fontWeight: 800, color: "rgba(19,35,51,0.78)", lineHeight: "18px" }}>
              PSN: <span style={{ fontWeight: 900 }}>{infoMeta?.staffNo || "--"}</span>
            </div>

            <div style={{ height: 8 }} />

            <div style={{ fontWeight: 800, color: "rgba(19,35,51,0.78)", lineHeight: "18px" }}>
              Role: <span style={{ fontWeight: 900 }}>{infoMeta?.role || "Other"}</span>
            </div>

            <div style={{ height: 8 }} />

            <div style={{ fontWeight: 800, color: "rgba(19,35,51,0.78)", lineHeight: "18px" }}>
              Requested: <span style={{ fontWeight: 900 }}>{formatListedAtDisplay(infoMeta?.listedAt || null)}</span>
            </div>

            <div style={{ height: 8 }} />

            <div style={{ fontWeight: 800, color: "rgba(19,35,51,0.78)", lineHeight: "18px" }}>
              Status:{" "}
              <span style={{ fontWeight: 900, textTransform: "capitalize" }}>{infoMeta?.status || "--"}</span>
              {infoMeta?.status ? (
                <img
                  src={
                    infoMeta.status === "confirmed"
                      ? LISTING_STATUS_ICONS.booked
                      : infoMeta.status === "sent"
                      ? LISTING_STATUS_ICONS.sent
                      : LISTING_STATUS_ICONS.pending
                  }
                  alt={infoMeta.status}
                  style={{ width: 20, height: 20, marginLeft: 8, verticalAlign: "middle" }}
                />
              ) : null}
            </div>

            <button
              type="button"
              style={{
                marginTop: 14,
                borderRadius: 14,
                padding: "12px 0",
                fontWeight: 900,
                background: "#e8f0ff",
                cursor: "pointer",
                fontSize: 14,
                width: "100%",
                border: "1px solid transparent",
              }}
              onClick={() => {
                setInfoVisible(false);
                setInfoMeta(null);
              }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
