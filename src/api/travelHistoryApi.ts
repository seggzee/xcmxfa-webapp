// FILE: src/api/travelHistoryApi.ts
//
// =====================================================================================
// PERSONAL TRAVEL HISTORY API
// =====================================================================================
//
// PURPOSE
// - Client adapter for personal travel/listing history reporting.
// - Current backend V1 uses GET ?psn=...
//
// ENDPOINTS
// - /api/reports/my_travel_history.php
// - /api/reports/my_travel_history_reports.php
//
// =====================================================================================

import { API_BASE_URL } from "../config/api";

export type TravelHistoryRow = {
  flight_instance_id: string;
  source_system: "klm" | "hv" | string;

  airline_iata: string;
  flight_number: string;
  flight_label: string;

  dep_airport: string;
  arr_airport: string;
  route_label: string;

  std_utc: string | null;
  std_local: string | null;

  booking_status: string;
  booking_status_label: string;

  requested_at_utc: string | null;
  confirmed_at_utc: string | null;
  security_number: string | null;
};

export type TravelHistoryResponse = {
  ok?: boolean;

  range_mode?: "preset" | "custom" | string;
  range_days?: number | null;
  range_label?: string;
  from_date?: string | null;
  to_date?: string | null;

  window_start_utc?: string;
  window_end_utc?: string;
  generated_at_utc?: string;

  disclaimer?: string;
  empty_message?: string;

  rows?: TravelHistoryRow[];

  error?: string;
  message?: string;
};

export type TravelHistoryQuarterlyReport = {
  report_id: number;
  quarter_year: number;
  quarter_number: number;
  label: string;

  period_start_utc: string | null;
  period_end_utc: string | null;
  generated_at_utc: string | null;
  expires_at_utc: string | null;

  row_count: number;

  has_pdf: boolean;
  has_csv: boolean;

  status: string;
};

export type TravelHistoryReportsResponse = {
  ok?: boolean;
  generated_at_utc?: string;
  empty_message?: string;
  reports?: TravelHistoryQuarterlyReport[];
  error?: string;
  message?: string;
};

export type TravelHistoryApiError = Error & {
  status?: number;
  url?: string;
  body?: unknown;
};

function requirePsnStrict(psn: unknown, ctx = "travel history"): string {
  const v = String(psn ?? "").trim().toUpperCase();

  if (!v) {
    throw new Error(`Missing PSN for ${ctx}.`);
  }

  return v;
}

async function requestJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const text = await res.text();

  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok || !json || json.ok !== true) {
    const msg =
      json?.error ||
      json?.message ||
      `${res.status} ${res.statusText}` ||
      "Travel history request failed";

    const err: TravelHistoryApiError = new Error(String(msg));
    err.status = res.status;
    err.url = url;
    err.body = json ?? text;
    throw err;
  }

  return json as T;
}

export async function getMyTravelHistory(args: {
  staffNo: unknown;
  rangeDays?: 7 | 28 | 90;
  from?: string;
  to?: string;
}): Promise<TravelHistoryResponse> {
  const psn = requirePsnStrict(args.staffNo, "getMyTravelHistory");

  const q = new URLSearchParams({ psn });

  if (args.from || args.to) {
    if (args.from) q.set("from", args.from);
    if (args.to) q.set("to", args.to);
  } else {
    q.set("range_days", String(args.rangeDays || 90));
  }

  const url = `${API_BASE_URL}/api/reports/my_travel_history.php?${q.toString()}`;

  const json = await requestJson<TravelHistoryResponse>(url);

  return {
    ...json,
    rows: Array.isArray(json.rows) ? json.rows : [],
  };
}

export async function getMyTravelHistoryReports(args: {
  staffNo: unknown;
}): Promise<TravelHistoryReportsResponse> {
  const psn = requirePsnStrict(args.staffNo, "getMyTravelHistoryReports");
  const q = new URLSearchParams({ psn }).toString();
  const url = `${API_BASE_URL}/api/reports/my_travel_history_reports.php?${q}`;

  const json = await requestJson<TravelHistoryReportsResponse>(url);

  return {
    ...json,
    reports: Array.isArray(json.reports) ? json.reports : [],
  };
}