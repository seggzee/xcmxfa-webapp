/**
 * Idiot-guide:
 * This file is the single source of truth for web API endpoint URLs.
 * Web app must call the SAME backend endpoints as RN.
 *
 * - Crew/member endpoints live under /api (NOT /auth)
 * - Login endpoints live under /auth
 *
 * We also implement postJson() here:
 * - Sends JSON
 * - Reads response text first (debug-friendly)
 * - Parses JSON if possible
 * - Throws a rich error if HTTP status is not OK
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

export type Json = Record<string, any>;

export async function postJson<T>(
  url: string,
  body: Json,
  authHeader?: Record<string, string>,
): Promise<T> {



	
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Idiot-guide: authHeader usually = { Authorization: "Bearer <token>" }
      ...(authHeader || {}),
    },
    body: JSON.stringify(body || {}),
  });

  
  

  // Idiot-guide: read as text first so server errors are visible even if JSON is broken
  const text = await res.text();

  let data: any = null;
  let parseError = false;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    parseError = true;
  }

  if (!res.ok) {
    // Idiot-guide: throw a rich error object for debugging
    const err: any = new Error(`Request failed (${res.status})`);
    err.status = res.status;
    err.url = url;
    err.body = text;      // raw server response text
    err.data = data;      // parsed JSON if parse worked
    err.parseError = parseError;
    throw err;
  }

  return data as T;
}
