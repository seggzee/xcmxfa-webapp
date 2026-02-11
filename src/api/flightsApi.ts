// flightsApi.ts (WEB)
// VERBATIM CONTRACT CLONE FROM RN
//
// Purpose:
// - Client-side adapter for /api/bookings/my_flights.php
// - Returns EXACT same payload shape as RN getMyFlights
//
// RULES:
// - No coercion
// - No guessing
// - No UI-side inference
// - Identity invariants enforced BEFORE network call

import { API_BASE_URL } from "../config/api";

type HttpMethod = "GET" | "POST" | "OPTIONS";

export type ApiJson = unknown;

export type ApiError = Error & {
  status?: number;
  url?: string;
  body?: unknown;
};

/* --------------------------- identity validators --------------------------- */

function requirePsnStrict(psn: unknown, ctx = "psn"): string {
  const v = String(psn ?? "").trim();

  if (!v) {
    throw new Error(`Missing psn for ${ctx}.`);
  }

  // NOTE: no format cleanup, no replace(/\D/g/)
  return v;
}

/* -------------------------------------------------------------------------- */

type RequestJsonOptions = {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
};

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

/* ----------------------------- schedule helpers ---------------------------- */

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

  return requestJson(`/api/flights/window.php?${q}`);
}

export async function getFlightsForDay(args: {
  airportCode: string;
  dateKey: string;
}): Promise<ApiJson> {
  const { airportCode, dateKey } = args;

  const q = new URLSearchParams({
    airport: airportCode,
    date: dateKey,
  }).toString();

  return requestJson(`/api/flights/day.php?${q}`);
}

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

/* ===================== getMyFlights (VERBATIM) ===================== */

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
    ac_reg: (r.ac_reg as any) ?? null,

    boarding_status_text: (r.boarding_status_text as any) ?? null,
    flight_status_text: (r.flight_status_text as any) ?? "",

    cancelled: (r.cancelled as any) ?? null,
    status_last_updated_utc: (r.status_last_updated_utc as any) ?? null,
    schedule_last_updated_utc: (r.schedule_last_updated_utc as any) ?? null,

    flight_no: (r.flight_number as any) ?? "",
    op_status: (r.flight_status_text as any) ?? "On time",
    listing_status: (r.booking_status as any) ?? "pending",
  }));
}
