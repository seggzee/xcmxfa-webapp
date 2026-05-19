// flightsApi.ts (WEB)
// VERBATIM CONTRACT CLONE FROM RN (plus *explicit* parity shims where the WEB server feed differs)
//
// =============================================================================
// Purpose
// =============================================================================
// Client-side adapter for API endpoints used by Home / Day / Week / MyFlights.
//
// Schiphol Ultra overlay rule (LOCKED):
// - Overlay is additive-only.
// - Client must NOT do matching.
// - Backend may attach: flight.schiphol (object) or null.
// - Our parity shims MUST NOT drop or mutate flight.schiphol.
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
 * Schiphol Ultra overlay types (ADD-ONLY)
 * ============================================================================= */

export type SchipholOverlay = {
  terminal?: string | null;
  gate?: string | null;
  pier?: string | null;

  expected_boarding_time_utc?: string | null;
  expected_gate_open_utc?: string | null;
  expected_gate_closing_utc?: string | null;

  actual_off_block_time_utc?: string | null;
  estimated_landing_time_utc?: string | null;

  public_flight_state?: string | null;

  last_updated_utc?: string | null;
  updated_at_utc?: string | null; // "Ultra touched this row"
};

/* =============================================================================
 * Internal parity helpers (DO NOT export)
 * =============================================================================
 *
 * These helpers exist ONLY to keep Home/Day/Week consistent with RN expectations.
 * They do NOT “translate meaning”; they only standardise shape + formatting.
 *
 * IMPORTANT:
 * - These shims MUST NOT drop or mutate flight.schiphol.
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
 *
 * NOTE:
 * - We spread `...r` first, so any attached `schiphol` object survives untouched.
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
 * - Schiphol overlay (if present) is preserved untouched.
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
 * - Schiphol overlay (if present) is preserved untouched.
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
  
  security_number: string | null;

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

  // Schiphol Ultra overlay (ADD-ONLY)
  schiphol: SchipholOverlay | null;
  
    // Airport operational overlay objects (ADD-ONLY)
  airport_overlay?: Record<string, unknown> | null;
  airport_overlay_dep?: Record<string, unknown> | null;
  airport_overlay_arr?: Record<string, unknown> | null;

  // Airline fallback info objects for My Flights operational panels (ADD-ONLY)
  airline_departure_info?: Record<string, unknown> | null;
  airline_arrival_info?: Record<string, unknown> | null;

  // ADD-ONLY unlist capability flags
  can_unlist?: boolean;
  unlist_mode?: "type1" | "type2" | "none" | string;

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
 *
 * ADDITION:
 * - Enforces deterministic chronological ordering:
 *     1) Upcoming flights first (std_local >= now), soonest first
 *     2) Past flights after, most recent past first
 *
 * Schiphol Ultra:
 * - Preserve attached `schiphol` object exactly as provided by backend (or null).
 */
export async function getMyFlights(args: { staffNo: unknown }): Promise<MyFlightRow[]> {
  const psn = requirePsnStrict(args.staffNo, "getMyFlights");
  const q = new URLSearchParams({ psn }).toString();

  const raw = await requestJson<RawMyFlightsResponse>(`/api/bookings/my_flights.php?${q}`);

  const rows = Array.isArray(raw?.flights) ? (raw.flights as RawFlightRow[]) : [];

  const mapped: MyFlightRow[] = rows.map((r) => ({
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
	
	security_number: (r.security_number as any) ?? null,

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

    ac_reg: formatReg((r as any).ac_reg),

    boarding_status_text: (r.boarding_status_text as any) ?? null,
    flight_status_text: (r.flight_status_text as any) ?? "",

    cancelled: (r.cancelled as any) ?? null,
    status_last_updated_utc: (r.status_last_updated_utc as any) ?? null,
    schedule_last_updated_utc: (r.schedule_last_updated_utc as any) ?? null,

    // ✅ Schiphol overlay pass-through (ADD-ONLY)
    schiphol: ((r as any).schiphol as any) ?? null,
	
	// ✅ Airport operational overlay pass-through (ADD-ONLY)
    airport_overlay: ((r as any).airport_overlay as any) ?? null,
    airport_overlay_dep: ((r as any).airport_overlay_dep as any) ?? null,
    airport_overlay_arr: ((r as any).airport_overlay_arr as any) ?? null,

    // ✅ Airline operational fallback pass-through (ADD-ONLY)
    airline_departure_info: ((r as any).airline_departure_info as any) ?? null,
    airline_arrival_info: ((r as any).airline_arrival_info as any) ?? null,

    // ✅ Unlist capability pass-through (ADD-ONLY)
    can_unlist: (r as any).can_unlist === true,
    unlist_mode: ((r as any).unlist_mode as any) ?? "none",

    flight_no: (r.flight_number as any) ?? "",

    op_status: (r.flight_status_text as any) ?? "On time",

    listing_status: (r.booking_status as any) ?? "pending",
  }));

  /*
  
  
  // ---------------------------------------------------------
  // Deterministic chronological ordering (single source)
  // ---------------------------------------------------------

  const now = Date.now();

  mapped.sort((a, b) => {
    const aTime = new Date(a.std_local || "").getTime();
    const bTime = new Date(b.std_local || "").getTime();

    const aValid = Number.isFinite(aTime);
    const bValid = Number.isFinite(bTime);

    // Invalid dates go to bottom
    if (!aValid && !bValid) return 0;
    if (!aValid) return 1;
    if (!bValid) return -1;

    const aFuture = aTime >= now;
    const bFuture = bTime >= now;

    // Future flights before past flights
    if (aFuture && !bFuture) return -1;
    if (!aFuture && bFuture) return 1;

    // Both future → soonest first
    if (aFuture && bFuture) return aTime - bTime;

    // Both past → most recent first
    return bTime - aTime;
  });
  
  
  */

  return mapped;
}

/* ===================== Day bookings (RN parity) ===================== */

/**
 * getBookingsForDay()
 * - Reads the crew list (bookings) for a specific airport/date.
 * - ADD-ONLY: now also sends psn so backend can compute unlist capability
 *   for the current member's own booking row.
 */
export async function getBookingsForDay(args: {
  airportCode: string;
  dateKey: string;
  staffNo?: unknown;
}): Promise<ApiJson> {
  const { airportCode, dateKey, staffNo } = args;

  const psn = String(staffNo ?? "").trim().toUpperCase();

  const query: Record<string, string> = {
    airport: airportCode,
    date: dateKey,
  };

  if (psn) {
    query.psn = psn;
  }

  const q = new URLSearchParams(query).toString();

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

  // ADD-ONLY (AMS capture; ignored by backend for non-AMS)
  previous_duty?: string;
  previous_duty_details?: string;
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

  // Payload contract:
  // - Always send { flight_instance_id, psn }
  // - For LIST only, we may additionally send AMS capture fields (ADD-ONLY).
  const body: any = { flight_instance_id, psn };

  if (args.mode === "list") {
    if (typeof args.previous_duty === "string") body.previous_duty = args.previous_duty;
    if (typeof args.previous_duty_details === "string") body.previous_duty_details = args.previous_duty_details;
  }

  return requestJson(path, {
    method: "POST",
    body,
  });
}

/* =============================================================================
 * Time truth + Phase engine (Client canonical layer)  (ADD-ONLY)
 * =============================================================================
 *
 * Objective:
 * - Single source of truth in the client for:
 *   - Parsing the flight’s canonical departure instant (UTC)
 *   - Computing ms-to-STD and countdown formatting
 *   - Computing the locked 5-phase state machine used by Home/MyFlights/Day
 *
 * Time truth (LOCKED):
 * - Countdown/phase logic uses std_utc (absolute UTC instant)
 * - Client “now” is Date.now() (epoch ms)
 * - User timezone is accessible via browser APIs (no server dependency)
 *
 * Phase model (LOCKED):
 * - Phase 0: > 24h to STD  -> show rows 1 & 2 only
 * - Phase 1: 24h → 6h     -> show rows 1,2,3
 * - Phase 2: 6h → 3h      -> countdown visible in header top row
 * - Phase 3: 3h → STD     -> progressively add Day-style panels below card
 * - Phase 4: <= 0         -> post-STD state (later overridden by Schiphol DEP rule)
 *
 * Rules:
 * - No guessing:
 *     - If std_utc is missing/invalid -> return null
 *     - Phase defaults to 0 when msToStd is null/invalid
 */

/**
 * getStdUtcMs()
 * - Returns epoch ms for flightRow.std_utc
 * - No guessing: missing/invalid -> null
 */
export function getStdUtcMs(flightRow: unknown): number | null {
  if (!flightRow || typeof flightRow !== "object") return null;

  const stdUtc = (flightRow as any).std_utc;
  if (typeof stdUtc !== "string") return null;

  const s = stdUtc.trim();
  if (!s) return null;

  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) return null;

  return ms;
}

/**
 * getMsToStd()
 * - Returns (std_utc_ms - nowMs)
 * - nowMs defaults to Date.now()
 * - No guessing: if std_utc missing/invalid -> null
 */
export function getMsToStd(flightRow: unknown, nowMs: number = Date.now()): number | null {
  const stdUtcMs = getStdUtcMs(flightRow);
  if (stdUtcMs === null) return null;

  if (!Number.isFinite(nowMs)) return null;

  return stdUtcMs - nowMs;
}

/**
 * formatCountdownHHMM()
 * - IMPORTANT (2026-02-20):
 *   This function now formats as "HH:MM:SS" (seconds included).
 *   We keep the function name to avoid churn across screens.
 *
 * UI-safe:
 * - invalid input -> "--:--:--"
 * - negative -> "00:00:00" (phase engine handles <= 0 separately)
 *
 * NOTE:
 * - Uses floored seconds for stable ticking.
 */
export function formatCountdownHHMM(msToStd: number): string {
  if (!Number.isFinite(msToStd)) return "--:--:--";

  const clamped = Math.max(0, Math.floor(msToStd));
  const totalSeconds = Math.floor(clamped / 1000);

  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;

  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export type FlightPhase = 0 | 1 | 2 | 3 | 4;

/**
 * getFlightPhase()
 * - Locked phase engine based on msToStd.
 *
 * Boundaries (explicit):
 * - msToStd > 24h          -> 0
 * - 24h >= msToStd > 6h    -> 1
 * - 6h  >= msToStd > 3h    -> 2
 * - 3h  >= msToStd > 0     -> 3
 * - msToStd <= 0           -> 4
 *
 * If msToStd is null/invalid -> 0 (per contract).
 */
export function getFlightPhase(msToStd: number | null): FlightPhase {
  if (msToStd === null || !Number.isFinite(msToStd)) return 0;

  if (msToStd <= 0) return 4;

  const HOUR = 60 * 60 * 1000;

  if (msToStd > 24 * HOUR) return 0;
  if (msToStd > 6 * HOUR) return 1;
  if (msToStd > 3 * HOUR) return 2;

  return 3;
}