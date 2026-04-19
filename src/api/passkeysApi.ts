// src/api/passkeysApi.ts
//
// PURPOSE
// - Fetch wrapper for passkeys.xcmxfa.com and apps-backend.xcmxfa.com passkey endpoints.
// - Keeps endpoint URLs and fetch options out of components.
//
// PHASE-1 FLOW
// A) PASSKEY AUTH
//    1. passkeys API authenticate/begin
//    2. browser get()
//    3. passkeys API authenticate/finish -> returns short-lived exchange token
//    4. main backend passkey-exchange.php -> returns SAME shape as login.php
//
// B) PASSKEY REGISTRATION
//    1. main backend login.php returns passkeyRegistrationToken after normal password login
//    2. passkeys API register/begin with token
//    3. browser create()
//    4. passkeys API register/finish with same token
//
// IMPORTANT
// - passkeys.xcmxfa.com uses its own session cookie for begin/finish challenge state.
// - Therefore fetches to passkeys.xcmxfa.com must use credentials: 'include'.
// - Main backend exchange endpoint can follow your existing authClient conventions after success.

import type { AuthenticationOptionsJSON, RegistrationOptionsJSON, SerializedCredential } from "../utils/passkeys";

const PASSKEYS_API_BASE = "https://passkeys.xcmxfa.com/api/auth/passkeys";
const MAIN_BACKEND_BASE = "https://apps-backend.xcmxfa.com/auth";

type Ok<T> = T & { ok: true };
type Fail = {
  ok: false;
  error?: string;
  message?: string;
};

export type BeginAuthenticationResponse = Ok<{
  options: AuthenticationOptionsJSON;
}>;

export type FinishAuthenticationResponse = Ok<{
  verified: true;
  exchange: {
    token: string;
    expires_in: number;
    exchange_required: true;
  };
}>;

export type PasskeyExchangeResponse = {
  ok: boolean;
  accessToken?: string;
  accessTokenExpiresAt?: string;
  refreshToken?: string | null;
  refreshTokenExpiresAt?: string | null;
  passkeyRegistrationToken?: string | null;
  passkeyRegistrationExpiresIn?: number;
  user?: {
    id: number;
    company: string;
    job: string;
    staffNo: string;
    username: string;
    email: string;
  };
  deviceId?: string;
  error?: string;
  message?: string;
};

export type BeginRegistrationResponse = Ok<{
  options: RegistrationOptionsJSON;
}>;

export type FinishRegistrationResponse = Ok<{
  passkey: {
    passkey_id: number;
    credential_id: string;
    device_type: "singleDevice" | "multiDevice";
    backed_up: boolean;
    transports: string[];
    authenticator_attachment: string | null;
    created_at_utc: string;
  };
}>;

export async function beginPasskeyAuthentication(username?: string): Promise<BeginAuthenticationResponse> {
  const body: Record<string, unknown> = {};
  if (username && username.trim() !== "") {
    body.username = username.trim().toUpperCase();
  }

  return postJson<BeginAuthenticationResponse>(`${PASSKEYS_API_BASE}/authenticate/begin.php`, body, {
    credentials: "include",
  });
}

export async function finishPasskeyAuthentication(
  credential: SerializedCredential,
): Promise<FinishAuthenticationResponse> {
  return postJson<FinishAuthenticationResponse>(
    `${PASSKEYS_API_BASE}/authenticate/finish.php`,
    { credential },
    { credentials: "include" },
  );
}

export async function exchangeVerifiedPasskeyForAppLogin(
  token: string,
  rememberDevice = true,
  deviceId?: string,
): Promise<PasskeyExchangeResponse> {
  const body: Record<string, unknown> = {
    token,
    rememberDevice,
  };

  if (deviceId && deviceId.trim() !== "") {
    body.device = { deviceId: deviceId.trim() };
  }

  return postJson<PasskeyExchangeResponse>(`${MAIN_BACKEND_BASE}/login/passkey-exchange.php`, body);
}

export async function beginPasskeyRegistration(
  passkeyRegistrationToken: string,
): Promise<BeginRegistrationResponse> {
  return postJson<BeginRegistrationResponse>(
    `${PASSKEYS_API_BASE}/register/begin.php`,
    { token: passkeyRegistrationToken },
    { credentials: "include" },
  );
}

export async function finishPasskeyRegistration(
  passkeyRegistrationToken: string,
  credential: SerializedCredential,
): Promise<FinishRegistrationResponse> {
  return postJson<FinishRegistrationResponse>(
    `${PASSKEYS_API_BASE}/register/finish.php`,
    {
      token: passkeyRegistrationToken,
      credential,
    },
    { credentials: "include" },
  );
}

type FetchOptions = {
  credentials?: RequestCredentials;
};


/*
async function postJson<T>(url: string, body: unknown, options: FetchOptions = {}): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: options.credentials ?? "same-origin",
    body: JSON.stringify(body),
  });

  let json: T | Fail;
  try {
    json = (await response.json()) as T | Fail;
  } catch {
    throw new Error("INVALID_JSON_RESPONSE");
  }

  if (!response.ok || (typeof json === "object" && json !== null && "ok" in json && json.ok === false)) {
    const error = typeof json === "object" && json !== null && "error" in json ? json.error : undefined;
    const message = typeof json === "object" && json !== null && "message" in json ? json.message : undefined;

    throw new Error(error || message || `HTTP_${response.status}`);
  }

  return json as T;
}
*/

async function postJson<T>(url: string, body: unknown, options: FetchOptions = {}): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: options.credentials ?? "same-origin",
    body: JSON.stringify(body),
  });

  const rawText = await response.text();

  let json: T | Fail | null = null;

  try {
    json = rawText ? (JSON.parse(rawText) as T | Fail) : null;
  } catch {
    throw new Error(`NON_JSON_RESPONSE: ${rawText || "<empty>"}`);
  }

  if (
    !response.ok ||
    (typeof json === "object" && json !== null && "ok" in json && json.ok === false)
  ) {
    const error =
      typeof json === "object" && json !== null && "error" in json ? json.error : undefined;
    const message =
      typeof json === "object" && json !== null && "message" in json ? json.message : undefined;

    throw new Error(error || message || `HTTP_${response.status}`);
  }

  return json as T;
}