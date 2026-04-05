/**
 * Idiot-guide:
 * This file is the single source of truth for web API endpoint URLs.
 * Web app must call the SAME backend endpoints as RN.
 *
 * - Crew/member endpoints live under /api (NOT /auth)
 * - Login endpoints live under /auth
 *
 * We implement postJson() and getJson() here:
 * - postJson sends JSON, reads text first, parses JSON if possible, throws rich error
 * - getJson does the same but with GET
 */

//====================================//
// Vite reads .env vars as import.meta.env.*
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
if (!API_BASE_URL) {
  throw new Error("VITE_API_BASE_URL is not defined");
}

console.log("API_BASE_URL =", API_BASE_URL);
//====================================//

// ===============================
// Member/Crew endpoints (NOT /auth)
// ===============================
export const CREW_GET_URL = `${API_BASE_URL}/api/members/get.php`;
export const CREW_EXISTS_URL = `${API_BASE_URL}/api/members/exists.php`;
export const MEMBERS_STATUS_URL = `${API_BASE_URL}/api/members/status.php`;

// ===============================
// Auth endpoints
// ===============================
export const AUTH_LOGIN_URL = `${API_BASE_URL}/auth/login/login.php`;
export const AUTH_REFRESH_URL = `${API_BASE_URL}/auth/login/refresh.php`;
export const AUTH_LOGOUT_URL = `${API_BASE_URL}/auth/login/logout.php`;
export const AUTH_PASSWORD_REQUEST_RESET_URL = `${API_BASE_URL}/auth/password/request-reset.php`;
export const AUTH_PASSWORD_CONFIRM_RESET_URL = `${API_BASE_URL}/auth/password/confirm-reset.php`;

// ===============================
// Crew Lockers (managed) — V2
// ===============================
export const CREW_LOCKERS_LIST_URL = `${API_BASE_URL}/api/crew_lockers/list.php`;
export const CREW_LOCKERS_NOTIFICATIONS_LIST_URL = `${API_BASE_URL}/api/crew_lockers/notifications_list.php`;
export const CREW_LOCKERS_NOTIFICATIONS_MARK_READ_URL = `${API_BASE_URL}/api/crew_lockers/notifications_mark_read.php`;
export const CREW_LOCKERS_REMOVE_URL = `${API_BASE_URL}/api/crew_lockers/remove.php`;

// ===============================
// Messages / Notifications
// ===============================
export const MESSAGES_LIST_URL = `${API_BASE_URL}/api/messages/list.php`;
export const MESSAGES_UNREAD_COUNT_URL = `${API_BASE_URL}/api/messages/unread_count.php`;
export const MESSAGES_MARK_READ_URL = `${API_BASE_URL}/api/messages/mark_read.php`;

// ADDED FOR THIS REVISION:
// Member-facing dismiss for normal message cards.
export const MESSAGES_DISMISS_MESSAGE_URL = `${API_BASE_URL}/api/messages/dismiss.php`;

// ===============================
// Message popups / announcements
// ===============================
export const MESSAGES_ACTIVE_POPUP_URL = `${API_BASE_URL}/api/messages/active_popup.php`;
export const MESSAGES_DISMISS_POPUP_URL = `${API_BASE_URL}/api/messages/dismiss_popup.php`;

export const MESSAGES_SUMMARY_URL = `${API_BASE_URL}/api/messages/summary.php`;

export type Json = Record<string, any>;

async function readJsonOrThrow<T>(res: Response, url: string): Promise<T> {
  const text = await res.text();

  let data: any = null;
  let parseError = false;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    parseError = true;
  }

  if (!res.ok) {
    const err: any = new Error(`Request failed (${res.status})`);
    err.status = res.status;
    err.url = url;
    err.body = text;
    err.data = data;
    err.parseError = parseError;
    throw err;
  }

  return data as T;
}

export async function postJson<T>(url: string, body: Json, authHeader?: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authHeader || {}),
    },
    body: JSON.stringify(body || {}),
  });

  return readJsonOrThrow<T>(res, url);
}

export async function getJson<T>(url: string, authHeader?: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      ...(authHeader || {}),
    },
  });

  return readJsonOrThrow<T>(res, url);
}