// src/pages/MyFlights.tsx
//
// PURPOSE
// - Member-facing My Flights screen
//
// MY FLIGHTS OPERATIONAL PANEL UPDATE
// - Uses the same locked Departure + Arrival information model as Day screen.
// - Collapsed My Flights card shows:
//     3x3 card
//     Departure info panel, if UTC today/tomorrow
//     Arrival info panel, if UTC today/tomorrow
//     Action button, if available
// - Expanded card additionally shows:
//     Listing information
//     Commuter summary
//     Listed commuters
//     Other information
//
// BACKEND CONTRACT EXPECTED
// - /api/bookings/my_flights.php returns:
//     schiphol
//     airport_overlay
//     airport_overlay_dep
//     airport_overlay_arr
//     airline_departure_info
//     airline_arrival_info
//
// THIS REISSUE
// - Uses source-scoped airport status normalisation.
// - AENA raw-code diagnostic mode is closed; AENA_OFFICIAL now displays mapped labels.
// - Departure panels now use the universal four-line departure contract:
//     Line 1: {DEP} Departure info [status chip]
//     Line 2: new departure / delay information, only when available
//     Line 3: timing / movement information
//     Line 4: airport handling / location information
// - HV no-feed departure airports in the two-day operational window render:
//     {DEP} Departure info [Unknown]
//     No additional information available
//   and never fall back to HV airline/canonical status.
// - HV no-feed arrival airports render:
//     {ARR} Arrival info [Unknown]
//     No additional information available
// - KLM no-feed arrival fallback remains unchanged.

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/authStore";
import FlightCard3x3 from "../components/FlightCard3x3";
import StickyPageHeaderCard from "../components/StickyPageHeaderCard";
import { getMyFlights, setBookingListed } from "../api/flightsApi";
import { LISTING_STATUS_ICONS, UI_ICONS } from "../assets";
import {
  normaliseAirportStatus as normaliseAirportStatusBySource,
  normaliseSchipholPublicState as normaliseSchipholPublicStateBySource,
} from "../utils/airportStatus";

import "../styles/myFlights.css";

/* ----------------------------- small helpers ----------------------------- */

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function dateToUtcDateKey(d: Date) {
  const y = d.getUTCFullYear();
  const m = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  return `${y}-${m}-${day}`;
}

function safeUpper(v: unknown) {
  return String(v || "").trim().toUpperCase();
}

function safeLower(v: unknown) {
  return String(v || "").trim().toLowerCase();
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

function fmtDayLabel(dtLike: unknown) {
  if (!dtLike) return "";
  const d = new Date(String(dtLike));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
}

function fmtRequestedAt(utcLike: unknown) {
  if (!utcLike) return "";
  const d = new Date(String(utcLike));
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date} ${time}`;
}

/**
 * Airport overlay local-time display helper.
 *
 * LOCKED DISPLAY RULE:
 * - Airport overlay rows already expose scheduled_time_local / estimated_time_local / actual_time_local.
 * - These are airport-local display strings.
 * - Do not convert them through browser timezone for My Flights operational panels.
 */
function fmtOverlayLocalTime(dtLike: unknown) {
  const s = String(dtLike || "").trim();
  if (!s) return "";

  const m = s.match(/\b([01]\d|2[0-3]):[0-5]\d\b/);
  return m ? m[0] : "";
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

function fmtListingStatusLabel(s: "" | "pending" | "sent" | "booked") {
  if (s === "pending") return "Pending";
  if (s === "sent") return "Sent";
  if (s === "booked") return "Booked";
  return "--";
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

  // For FlightCard3x3: we pass the RAW row through.
  row0: RawMyFlightRow;

  depDate: string;

  requestedAtDisplay: string;
  securityNumber: string | null;

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

/* =====================================================================================
   DEPARTURE / ARRIVAL OPERATIONAL INFO PANELS - REPLACEABLE BLOCK
   =====================================================================================

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
   - Panels are shown only when std_utc or sta_utc falls on UTC today or UTC tomorrow.
   - Panel order is always:
       Departure info
       Arrival info
   - Panels sit directly below the 3x3 card.
   - In My Flights, panels remain visible even when the rest of the card is collapsed.

   UNIVERSAL DEPARTURE PANEL LAYOUT - LOCKED:
   - Line 1: {AIRPORT} Departure info        [status chip]
   - Line 2: New departure time / delay information, only if available
   - Line 3: Timing / movement information
   - Line 4: Airport handling / location information
       Terminal · Pier/Check-in · Gate
   - If Lines 2, 3, and 4 are all empty:
       "No additional information available"

   ARRIVAL PANEL LAYOUT - CURRENT CONTRACT:
   - Line 1: {AIRPORT} Arrival info        [status chip]
   - Line 2: arrival timing information
   - Line 3: airport handling information
       Terminal · Gate · Belt
   - If no useful detail beyond the chip:
       "No additional information available"
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
    gateOpen ? `Gate Opens ${gateOpen}` : "",
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

function isHvDepartureTwoDayOperationalWindow(row: RawMyFlightRow) {
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

function buildHvNoFeedDeparturePanel(row: RawMyFlightRow): OpsPanelModel | null {
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

function buildDeparturePanelFromSchiphol(row: RawMyFlightRow): OpsPanelModel | null {
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

function buildArrivalPanelFromSchiphol(row: RawMyFlightRow): OpsPanelModel | null {
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

function buildDeparturePanelFromAirportOverlay(row: RawMyFlightRow): OpsPanelModel | null {
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

function buildArrivalPanelFromAirportOverlay(row: RawMyFlightRow): OpsPanelModel | null {
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

function buildDeparturePanelFromAirlineFallback(row: RawMyFlightRow): OpsPanelModel | null {
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

function buildArrivalPanelFromAirlineFallback(row: RawMyFlightRow): OpsPanelModel | null {
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

function buildDeparturePanelModel(row: RawMyFlightRow): OpsPanelModel | null {
  const schipholPanel = buildDeparturePanelFromSchiphol(row);
  if (schipholPanel) return schipholPanel;

  const airportPanel = buildDeparturePanelFromAirportOverlay(row);
  if (airportPanel) return airportPanel;

  const hvNoFeedDeparturePanel = buildHvNoFeedDeparturePanel(row);
  if (hvNoFeedDeparturePanel) return hvNoFeedDeparturePanel;

  return buildDeparturePanelFromAirlineFallback(row);
}

function buildArrivalPanelModel(row: RawMyFlightRow): OpsPanelModel | null {
  const schipholPanel = buildArrivalPanelFromSchiphol(row);
  if (schipholPanel) return schipholPanel;

  const airportPanel = buildArrivalPanelFromAirportOverlay(row);
  if (airportPanel) return airportPanel;

  // CRITICAL:
  // This branch is required for no-feed arrival airports such as AMS -> LCY.
  // It must still render a panel when the airline only provides public status.
  return buildArrivalPanelFromAirlineFallback(row);
}

function utcDateKeyFromValue(v: unknown) {
  const s = toCleanString(v);
  if (!s) return "";

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";

  return dateToUtcDateKey(d);
}

function shouldShowOperationalPanels(row: RawMyFlightRow) {
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

function routeAccentClass(row: RawMyFlightRow) {
  const dep = safeUpper(row?.dep_airport);
  const arr = safeUpper(row?.arr_airport);

  // Deterministic priority: EIN purple wins over RTM orange.
  if (dep === "EIN" || arr === "EIN") return "myFlights-card--ein";
  if (dep === "RTM" || arr === "RTM") return "myFlights-card--rtm";

  return "";
}

function MyFlightsInfoPanelBlock({ model }: { model: OpsPanelModel }) {
  const hasDetail = Boolean(model.line2 || model.line3 || model.line4);

  return (
    <div className={`myFlights-opsPanel myFlights-opsPanel--${model.key}`}>
      <div className="myFlights-opsPanelHeader">
        <div className="myFlights-opsPanelTitle">{model.title}</div>

        {model.statusChip ? (
          <div className="myFlights-opsChip">{model.statusChip}</div>
        ) : null}
      </div>

      {hasDetail ? (
        <>
          {model.line2 ? (
            <div className="myFlights-opsPanelLine">{model.line2}</div>
          ) : null}

          {model.line3 ? (
            <div className="myFlights-opsPanelLine myFlights-opsPanelLine3">{model.line3}</div>
          ) : null}

          {model.line4 ? (
            <div className="myFlights-opsPanelLine myFlights-opsPanelLine4">{model.line4}</div>
          ) : null}
        </>
      ) : (
        <div className="myFlights-opsPanelEmpty">{model.emptyText}</div>
      )}
    </div>
  );
}

function MyFlightsOperationalPanels({ flight }: { flight: CardVM }) {
  const row = flight?.row0 || {};
  
  
/*  
console.log("MYFLIGHTS PANEL DEBUG", {
  flight_instance_id: row?.flight_instance_id,
  route: `${row?.dep_airport}->${row?.arr_airport}`,
  show_panels: shouldShowOperationalPanels(row),

  airline_arrival_info_type: typeof row?.airline_arrival_info,
  airline_arrival_info_present: Boolean(row?.airline_arrival_info),
  airline_arrival_airport: row?.airline_arrival_info?.airport_code,
  airline_arrival_status: row?.airline_arrival_info?.status_text,

  airport_overlay_arr_present: Boolean(row?.airport_overlay_arr),
  schiphol_present: Boolean(row?.schiphol),

  departurePanel: buildDeparturePanelModel(row),
  arrivalPanel: buildArrivalPanelModel(row),
});
 */
  
  
  
  
  if (!shouldShowOperationalPanels(row)) return null;

  const departurePanel = buildDeparturePanelModel(row);
  const arrivalPanel = buildArrivalPanelModel(row);

  if (!departurePanel && !arrivalPanel) return null;

  return (
    <>
      {departurePanel ? (
        <>
          <div className="myFlights-zoneDivider" />
          <MyFlightsInfoPanelBlock model={departurePanel} />
        </>
      ) : null}

      {arrivalPanel ? (
        <>
          <div className="myFlights-zoneDivider" />
          <MyFlightsInfoPanelBlock model={arrivalPanel} />
        </>
      ) : null}
    </>
  );
}

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

  const requestedAtDisplay = fmtRequestedAt(myRow?.requested_at_utc);
  const securityNumber = String(myRow?.security_number || "").trim() || null;

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
    const utcRaw = String(r0.std_utc || "").trim();
    const localRaw = String(stdLocal || "").trim();

    const utcMs = utcRaw ? Date.parse(utcRaw) : NaN;
    const localMs = localRaw ? Date.parse(localRaw) : NaN;

    if (Number.isFinite(utcMs)) {
      isFuture = utcMs >= Date.now();
    } else if (Number.isFinite(localMs)) {
      isFuture = localMs >= Date.now();
    }
  } catch {
    // ignore
  }

  return {
    id: flightInstanceId,
    flightInstanceId,

    row0: {
      ...r0,

      // keep op_status key aligned for FlightCard3x3 display
      op_status: opStatus,

      // IMPORTANT:
      // MyFlights groups multiple commuter rows per flight.
      // r0 is only the first row in the group and may NOT be the logged-in user's row.
      // Unlist capability is user-specific, so promote it from myRow.
      can_unlist: myRow?.can_unlist === true,
      unlist_mode: String(myRow?.unlist_mode || "").trim().toLowerCase(),
    },

    depDate: fmtDayLabel(stdLocal),
    requestedAtDisplay,
    securityNumber,
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
  //    - Departure/Arrival operational panels visible for UTC today/tomorrow flights
  //    - Action button ALWAYS visible when backend capability allows
  // - Expanded:
  //    - Everything visible
  //
  // Additive only:
  // - No API/behaviour changes outside collapse feature and operational panel display
  // =====================================================================================
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

  // =====================================================================================
  // CONFIRM MODAL
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
      if (!isMember) return;
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

      void res;
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

  return (
    <div className="myFlights-page">
      {!isMember ? (
        <>
          <StickyPageHeaderCard
            leftContent={
              <img
                src={UI_ICONS.flight_blue}
                alt="My profile"
                style={{
                  width: 52,
                  height: 52,
                  objectFit: "contain",
                  borderRadius: 14,
                }}
              />
            }
            title="My flights"
            subtitle="Member-only page."
            onBack={() => nav(-1)}
            backAriaLabel="Back"
          />

          <div className="myFlights-scroll">
            <div className="myFlights-emptyWrap">
              <div className="myFlights-emptyTitle">Members only</div>
              <div className="myFlights-emptyBody">Sign in to view your requested flights.</div>
            </div>
          </div>
        </>
      ) : (
        <>
          <StickyPageHeaderCard
            leftContent={
              <img
                src={UI_ICONS.flight_blue}
                alt="My profile"
                style={{
                  width: 52,
                  height: 52,
                  objectFit: "contain",
                  borderRadius: 14,
                }}
              />
            }
            title="My flights"
            onBack={() => nav(-1)}
            backAriaLabel="Back"
          />

          <div className="myFlights-scroll">
            {loading ? (
              <div className="myFlights-inlineStatus">Loading your flights…</div>
            ) : errorText ? (
              <div className="myFlights-inlineStatus myFlights-inlineStatus--error">{errorText}</div>
            ) : null}

            {flightsForRender.length === 0 ? (
              <div className="myFlights-emptyWrap">
                <div className="myFlights-emptyTitle">No flights found</div>
                <div className="myFlights-emptyBody">You haven’t requested any flights yet.</div>
              </div>
            ) : (
              flightsForRender.map((flight) => {
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

                const accentClass = routeAccentClass(flight.row0);

                return (
					<div
					  key={flight.id}
					  className={`myFlights-card ${accentClass}`.trim()}
					>
                    <FlightCard3x3
                      flight={flight.row0}
                      headerLeftLabel={flight.isFuture ? "Upcoming:" : "Past:"}
                      headerDate={flight.depDate}
                      showHeader={true}
                      footerRightContent={footerRight}
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

                    <MyFlightsOperationalPanels flight={flight} />

                    {expanded ? (
                      <>
                        <div className="myFlights-zoneDivider" />

                        <div className="myFlights-zone">
                          <div className="myFlights-zoneTitle">Listing information</div>

                          <div className="myFlights-zoneMeta">
                            Requested: {flight.requestedAtDisplay || "--"} UTC
                          </div>

                          <div className="myFlights-zoneRow">
                            <div className="myFlights-zoneMeta">
                              Status: {fmtListingStatusLabel(flight.listingStatus)}
                            </div>

                            <div
                              className="myFlights-zoneMeta"
                              style={{ textAlign: "right" }}
                            >
                              Security No.: {flight.securityNumber || "--"}
                            </div>
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
        </>
      )}

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