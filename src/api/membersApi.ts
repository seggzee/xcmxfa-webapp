// membersApi.ts Rev 1 — 2026-02-01
//
// Members/profile API client.
// Mirrors the request/timeout style used in flightsApi.
//
// Endpoints (current):
// - POST /api/members/get.php
// - POST /api/members/member_general.php
// - POST /api/members/member_passport.php
// - POST /api/members/member_esta.php
//
// NOTE: Auth headers are optional and may be supplied by the caller via `headers`.

import { API_BASE_URL } from "../config/api";

type HttpMethod = "GET" | "POST" | "OPTIONS";

export type ApiJson = unknown;

export type ApiError = Error & {
  status?: number;
  url?: string;
  body?: unknown;
};

const DEFAULT_TIMEOUT_MS = 20000;

function withTimeout<T>(promise: Promise<T>, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Request timed out")), timeoutMs);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

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

  const res = await withTimeout(fetch(url, init));
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

export async function getMember(args: {
  psn?: unknown;
  headers?: Record<string, string>;
} = {}): Promise<ApiJson> {
  const clean = String(args.psn ?? "").trim();
  if (!clean) throw new Error("MISSING_PSN");

  return requestJson(`/api/members/get.php`, {
    method: "POST",
    headers: args.headers ?? {},
    body: { psn: clean },
  });
}

export async function saveMemberGeneral(args: {
  payload?: Record<string, unknown>;
  headers?: Record<string, string>;
} = {}): Promise<ApiJson> {
  const payload = args.payload;
  if (!payload || typeof payload !== "object") throw new Error("MISSING_PAYLOAD");

  const psn = String(payload.psn ?? "").trim();
  if (!psn) throw new Error("MISSING_PSN");

  return requestJson(`/api/members/member_general.php`, {
    method: "POST",
    headers: args.headers ?? {},
    body: payload,
  });
}

export async function saveMemberPassport(args: {
  payload?: Record<string, unknown>;
  headers?: Record<string, string>;
} = {}): Promise<ApiJson> {
  const payload = args.payload;
  if (!payload || typeof payload !== "object") throw new Error("MISSING_PAYLOAD");

  const psn = String(payload.psn ?? "").trim();
  if (!psn) throw new Error("MISSING_PSN");

  return requestJson(`/api/members/member_passport.php`, {
    method: "POST",
    headers: args.headers ?? {},
    body: payload,
  });
}

export async function saveMemberEsta(args: {
  payload?: Record<string, unknown>;
  headers?: Record<string, string>;
} = {}): Promise<ApiJson> {
  const payload = args.payload;
  if (!payload || typeof payload !== "object") throw new Error("MISSING_PAYLOAD");

  const psn = String(payload.psn ?? "").trim();
  if (!psn) throw new Error("MISSING_PSN");

  return requestJson(`/api/members/member_esta.php`, {
    method: "POST",
    headers: args.headers ?? {},
    body: payload,
  });
}
