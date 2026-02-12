// flightsApi.ts (WEB)
// VERBATIM CONTRACT CLONE FROM RN (plus *explicit* parity shims where the WEB server feed differs)
//
// =============================================================================
// Purpose
// =============================================================================
// Client-side adapter for API endpoints used by Home / Day / Week.
//
// The UI components (especially FlightCard3x3) have a strict expectation about
// certain fields existing *by specific names*.
//
// Key rule for this file:
// - Do NOT “invent” data.
// - Do NOT translate meaning.
// - ONLY do deterministic, RN-parity *shape* shims where the server feed uses
//   different field names or formatting.
//
// =============================================================================
// “Idiot guide” (read this when you touch anything)
// =============================================================================
// 1) requestJson() is the only place that does fetch + error normalisation.
// 2) Identity invariants are enforced BEFORE network calls (requirePsnStrict).
// 3) Flights payload parity shims live in one place (mapFlightsPayloadFor3x3):
//    - Ensure flight.op_status exists (derived from flight_status_text when needed)
//    - Ensure flight.ac_reg is formatted consistently (PH- / D- / G- / N- rules)
// 4) Any endpoint that returns flight rows for FlightCard3x3 MUST pass through the
//    same parity shim, so Home/Day/Week all behave identically.
//
// =============================================================================
// What FlightCard3x3 expects from a “raw flight row”
// =============================================================================
// At minimum (for the 3×3 head zone):
// - airline_iata
// - flight_number
// - dep_airport / arr_airport
// - std_local / sta_local
// - dep_gate (optional)
// - ac_typecode (optional)
// - ac_reg (optional BUT should be formatted consistently when present)
// - op_status  ✅ (MUST exist; FlightCard3x3 maps label/colour locally)
//
// Server reality (what we actually get sometimes):
// - flight_status_text exists
// - op_status may NOT exist
//
// RN parity decision we already use in getMyFlights():
// - op_status := flight_status_text (fallback "On time")
//
// This file applies the same shim for day/window feeds too.
//
// =============================================================================

import { API_BASE_URL } from "../config/api";

type HttpMethod = "GET" | "POST" | "OPTIONS";

export type ApiJson = unknown;

export type ApiError = Error & {
  status?: number;
  url?: string;
  body?: unknown;
};

/* --------------------------- identity validators --------------------------- */
/**
 * requirePsnStrict()
 * - Enforces the “identity invariants” rule:
 *   - must exist
 *   - no cleanup
 *   - no replace(/\D/g/)
 * - If it’s missing -> hard throw (fail loud).
 */
function requirePsnStrict(psn: unknown, ctx = "psn"): string {
  const v = String(psn ?? "").trim();

  if (!v) {
    throw new Error(`Missing psn for ${ctx}.`);
  }

  return v;
}

/* -------------------------------------------------------------------------- */

type RequestJsonOptions = {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
};

/**
 * requestJson()
 * - Single network gateway
 * - Always returns parsed JSON on 2xx
 * - Throws ApiError on non-2xx (and preserves body for debugging)
 */
async function requestJson<T = ApiJson>(
  path: string,
  { method = "GET", headers = {}, body }: RequestJsonOptions = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const init: RequestInit = {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  const res = await fetch(url, init);
  const text = await res.text();

  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg =
      (json &&
        typeof json === "object" &&
        json !== null &&
        ("error" in json || "message" in json) &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((json as any).error || (json as any).message)) ||
      `${res.status} ${res.statusText}` ||
      "Request failed";

    const err: ApiError = new Error(String(msg));
    err.status = res.status;
    err.url = url;
    err.body = json ?? text;
    throw err;
  }

  return json as T;
}

/* =============================================================================
 * Internal parity helpers (DO NOT export)
 * =============================================================================
 *
 * These helpers exist ONLY to keep Home/Day/Week consistent with RN expectations.
 * They do NOT “translate meaning”; they only standardise shape + formatting.
 */

type AnyRow = Record<string, any>;

/**
 * formatReg()
 * RN/Home parity formatting for aircraft registration:
 * - "" when missing (so FlightCard3x3 shows "N/A")
 * - If already contains "-" -> keep as-is
 * - PHXXXX -> PH-XXXX
 * - DXXXX / GXXXX / NXXXX -> D-XXXX / G-XXXX / N-XXXX
 *
 * IMPORTANT:
 * - deterministic formatting only
 * - no guessing
 */
function formatReg(raw: unknown): string {
  const regRaw = String(raw || "").trim().toUpperCase();
  if (!regRaw) return "";

  // Already formatted like PH-XXX
  if (regRaw.includes("-")) return regRaw;

  // PHAXG -> PH-AXG
  if (regRaw.startsWith("PH") && regRaw.length > 2) {
    return `${regRaw.slice(0, 2)}-${regRaw.slice(2)}`;
  }

  // DXXXX / GXXXX / NXXXX -> D-XXXX etc
  if (
    (regRaw.startsWith("D") || regRaw.startsWith("G") || regRaw.startsWith("N")) &&
    regRaw.length > 1
  ) {
    return `${regRaw.slice(0, 1)}-${regRaw.slice(1)}`;
  }

  return regRaw;
}

/**
 * with3x3ParityFields()
 * Applies *only* the two RN/Home parity shims needed by FlightCard3x3:
 *
 * 1) op_status:
 *    - If server already provides op_status -> keep it untouched.
 *    - Else derive op_status from flight_status_text (fallback "On time").
 *
 * 2) ac_reg formatting:
 *    - Standardise aircraft registration formatting via formatReg().
 *    - Missing becomes "" (not null), allowing FlightCard3x3 to render "N/A".
 */
function with3x3ParityFields(r: AnyRow): AnyRow {
  if (!r || typeof r !== "object") return r;

  const hasOp = typeof r.op_status !== "undefined" && r.op_status !== null;

  return {
    ...r,

    // RN/Home parity: ensure op_status exists for FlightCard3x3
    ...(hasOp ? null : { op_status: r?.flight_status_text ?? "On time" }),

    // RN/Home parity: consistent aircraft registration formatting
    ...(typeof r?.ac_reg !== "undefined" ? { ac_reg: formatReg(r.ac_reg) } : null),
  };
}

/**
 * mapFlightsArrayFor3x3()
 * Safely maps an array of flight rows through with3x3ParityFields().
 */
function mapFlightsArrayFor3x3(arr: any): any {
  if (!Array.isArray(arr)) return arr;
  return arr.map((row) => (row && typeof row === "object" ? with3x3ParityFields(row as AnyRow) : row));
}

/**
 * mapFlightsPayloadFor3x3()
 * Handles the typical payload shapes returned by:
 * - /api/flights/window.php
 * - /api/flights/day.php
 *
 * Supported shapes:
 * - { departures: [], arrivals: [], flights: [] }
 * - { flights: [] }
 *
 * Anything else is returned untouched.
 */
function mapFlightsPayloadFor3x3(payload: any): any {
  if (!payload || typeof payload !== "object") return payload;

  const next: any = { ...(payload as any) };

  if ("departures" in next) next.departures = mapFlightsArrayFor3x3(next.departures);
  if ("arrivals" in next) next.arrivals = mapFlightsArrayFor3x3(next.arrivals);
  if ("flights" in next) next.flights = mapFlightsArrayFor3x3(next.flights);

  return next;
}

/* ----------------------------- schedule helpers ---------------------------- */
/**
 * ensureScheduleFresh()
 * - POST helper for schedule refresh jobs
 * - Used by Week-ish flows
 * - Returns whatever backend returns (no mapping)
 */
export async function ensureScheduleFresh(args: {
  airportCode: string;
  startLocalDate?: string;
  days?: number;
  trigger?: string;
}): Promise<ApiJson> {
  const { airportCode, startLocalDate, days, trigger } = args;

  const body = {
    airport: airportCode,
    ...(startLocalDate ? { start_local: startLocalDate } : {}),
    ...(days ? { days } : {}),
    ...(trigger ? { trigger } : {}),
  };

  return requestJson(`/api/schedule/ensure-fresh.php`, {
    method: "POST",
    body,
  });
}

/**
 * getAirportWindowFlights()
 * - Home uses this “window” endpoint.
 * - MUST return flight rows compatible with FlightCard3x3:
 *   - ensures op_status exists
 *   - formats ac_reg
 */
export async function getAirportWindowFlights(args: {
  airportCode: string;
  startLocalDate: string;
  days: number;
}): Promise<ApiJson> {
  const { airportCode, startLocalDate, days } = args;

  const q = new URLSearchParams({
    airport: airportCode,
    start_local: startLocalDate,
    days: String(days),
  }).toString();

  const raw = await requestJson<any>(`/api/flights/window.php?${q}`);
  return mapFlightsPayloadFor3x3(raw);
}

/**
 * getFlightsForDay()
 * - Day screen uses this “day” endpoint.
 * - MUST behave identically to Home’s flight rows for the 3x3 card.
 * - Therefore it uses the same payload parity shim.
 */
export async function getFlightsForDay(args: {
  airportCode: string;
  dateKey: string;
}): Promise<ApiJson> {
  const { airportCode, dateKey } = args;

  const q = new URLSearchParams({
    airport: airportCode,
    date: dateKey,
  }).toString();

  const raw = await requestJson<any>(`/api/flights/day.php?${q}`);
  return mapFlightsPayloadFor3x3(raw);
}

/**
 * ensureDayStatusFresh()
 * - POST helper for day-status refresh jobs
 * - Returns backend response untouched (no mapping)
 */
export async function ensureDayStatusFresh(args: {
  airportCode: string;
  dateKey: string;
  trigger?: string;
}): Promise<ApiJson> {
  const { airportCode, dateKey, trigger } = args;

  return requestJson(`/api/status/ensure-fresh.php`, {
    method: "POST",
    body: { airport: airportCode, date: dateKey, ...(trigger ? { trigger } : {}) },
  });
}

/* ===================== getMyFlights (VERBATIM + RN/Home parity fields) ===================== */

type RawMyFlightsResponse = {
  flights?: unknown;
};

type RawFlightRow = Record<string, unknown>;

export type MyFlightRow = {
  flight_instance_id: string | number | null;
  psn: string | null;

  firstname: string | null;
  lastname: string | null;
  x_type: string | null;

  booking_status: string;
  requested_at_utc: string | null;
  listing_prio: number | string | null;

  list_position: number | string | null;
  list_total: number | string | null;

  airline_iata: string;
  flight_number: string;

  dep_airport: string;
  dep_terminal: string | null;
  dep_gate: string | null;

  std_utc: string | null;
  std_local: string;

  arr_airport: string;
  arr_terminal: string | null;
  arr_gate: string | null;

  sta_utc: string | null;
  sta_local: string;

  ac_typecode: string | null;
  ac_typename: string | null;

  // NOTE: allow "" because we intentionally format and return "" when missing
  ac_reg: string | null;

  boarding_status_text: string | null;
  flight_status_text: string;

  cancelled: boolean | number | string | null;
  status_last_updated_utc: string | null;
  schedule_last_updated_utc: string | null;

  flight_no: string;
  op_status: string;
  listing_status: string;
};

/**
 * getMyFlights()
 * - Adapter for /api/bookings/my_flights.php
 * - This already contains the RN/Home parity derivation:
 *   op_status := flight_status_text
 * - Now also standardises aircraft registration formatting via formatReg()
 */
export async function getMyFlights(args: { staffNo: unknown }): Promise<MyFlightRow[]> {
  const psn = requirePsnStrict(args.staffNo, "getMyFlights");
  const q = new URLSearchParams({ psn }).toString();

  const raw = await requestJson<RawMyFlightsResponse>(`/api/bookings/my_flights.php?${q}`);

  const rows = Array.isArray(raw?.flights) ? (raw.flights as RawFlightRow[]) : [];

  return rows.map((r) => ({
    flight_instance_id: (r.flight_instance_id as any) ?? null,
    psn: (r.psn as any) ?? null,

    firstname: (r.firstname as any) ?? null,
    lastname: (r.lastname as any) ?? null,
    x_type: (r.x_type as any) ?? null,

    booking_status: (r.booking_status as any) ?? "pending",
    requested_at_utc: (r.requested_at_utc as any) ?? null,
    listing_prio: (r.listing_prio as any) ?? null,

    list_position: (r.list_position as any) ?? null,
    list_total: (r.list_total as any) ?? null,

    airline_iata: (r.airline_iata as any) ?? "",
    flight_number: (r.flight_number as any) ?? "",

    dep_airport: (r.dep_airport as any) ?? "",
    dep_terminal: (r.dep_terminal as any) ?? null,
    dep_gate: (r.dep_gate as any) ?? null,

    std_utc: (r.std_utc as any) ?? null,
    std_local: (r.std_local as any) ?? "",

    arr_airport: (r.arr_airport as any) ?? "",
    arr_terminal: (r.arr_terminal as any) ?? null,
    arr_gate: (r.arr_gate as any) ?? null,

    sta_utc: (r.sta_utc as any) ?? null,
    sta_local: (r.sta_local as any) ?? "",

    ac_typecode: (r.ac_typecode as any) ?? null,
    ac_typename: (r.ac_typename as any) ?? null,

    // RN/Home parity: consistent aircraft registration formatting
    // IMPORTANT: "" when missing so FlightCard3x3 can show "N/A"
    ac_reg: formatReg((r as any).ac_reg),

    boarding_status_text: (r.boarding_status_text as any) ?? null,
    flight_status_text: (r.flight_status_text as any) ?? "",

    cancelled: (r.cancelled as any) ?? null,
    status_last_updated_utc: (r.status_last_updated_utc as any) ?? null,
    schedule_last_updated_utc: (r.schedule_last_updated_utc as any) ?? null,

    flight_no: (r.flight_number as any) ?? "",

    // Home/RN parity: op_status derived from flight_status_text
    op_status: (r.flight_status_text as any) ?? "On time",

    listing_status: (r.booking_status as any) ?? "pending",
  }));
}

/* ===================== Day bookings (RN parity) ===================== */

/**
 * getBookingsForDay()
 * - Reads the crew list (bookings) for a specific airport/date.
 * - No mapping required here (Day groups/sorts on the screen).
 */
export async function getBookingsForDay(args: {
  airportCode: string;
  dateKey: string;
}): Promise<ApiJson> {
  const { airportCode, dateKey } = args;

  const q = new URLSearchParams({
    airport: airportCode,
    date: dateKey,
  }).toString();

  return requestJson(`/api/bookings/day.php?${q}`);
}

/**
 * setBookingListed()
 * - Writes “list/unlist me” for a given flight_instance_id + psn.
 * - Identity invariants enforced BEFORE network call.
 *
 * Backend source-of-truth endpoints:
 * - list   -> /api/bookings/list.php   (create/reactivate)
 * - unlist -> /api/bookings/unlist.php (soft-cancel)
 *
 * IMPORTANT:
 * - Do NOT invent endpoint names.
 * - Payload MUST match backend contract: { psn, flight_instance_id } only.
 */
export async function setBookingListed(args: {
  mode: "list" | "unlist";
  flightInstanceId: string;
  staffNo: unknown;
}): Promise<ApiJson> {
  const psn = requirePsnStrict(args.staffNo, "setBookingListed");
  const flight_instance_id = String(args.flightInstanceId || "").trim();

  if (!flight_instance_id) {
    throw new Error("Missing flight_instance_id for setBookingListed.");
  }

  const path =
    args.mode === "list"
      ? `/api/bookings/list.php`
      : `/api/bookings/unlist.php`;

  return requestJson(path, {
    method: "POST",
    body: { flight_instance_id, psn },
  });
}
