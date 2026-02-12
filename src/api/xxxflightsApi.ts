

/* -------------------------- shared row normalisers ------------------------- */

type AnyObj = Record<string, any>;

/**
 * RN/Home parity:
 * - If server row lacks `op_status`, derive it from raw `flight_status_text`.
 * - We do NOT invent statuses. We only copy the server field across.
 */
function ensureOpStatus(row: any): any {
  if (!row || typeof row !== "object") return row;

  const r = row as AnyObj;

  // If already present, leave it alone.
  if (Object.prototype.hasOwnProperty.call(r, "op_status")) return r;

  // Derive from server raw field (can be null/undefined; that's still "truth").
  return {
    ...r,
    op_status: r.flight_status_text ?? null,
  };
}

function mapRowsEnsureOpStatus(v: any): any[] {
  return Array.isArray(v) ? v.map(ensureOpStatus) : [];
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

  // NOTE: leaving as-is unless you explicitly want op_status enforcement here too.
  return requestJson(`/api/flights/window.php?${q}`);
}

/**
 * IMPORTANT (Day parity):
 * - This function MUST provide `op_status` on rows (same as Home pipeline expectation),
 *   derived from server `flight_status_text` when missing.
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

  // Preserve top-level fields, only normalise row arrays.
  return {
    ...(raw && typeof raw === "object" ? raw : {}),
    departures: mapRowsEnsureOpStatus(raw?.departures),
    arrivals: mapRowsEnsureOpStatus(raw?.arrivals),
    flights: mapRowsEnsureOpStatus(raw?.flights),
  };
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

/* ===================== Day bookings (RN parity) ===================== */

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

  return requestJson(`/api/bookings/set_listed.php`, {
    method: "POST",
    body: { mode: args.mode, flight_instance_id, psn },
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
    // Home/RN parity: op_status derived from flight_status_text
    op_status: (r.flight_status_text as any) ?? "On time",
    listing_status: (r.booking_status as any) ?? "pending",
  }));
}
