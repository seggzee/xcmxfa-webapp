// src/api/passwordResetApi.ts
//
// PURPOSE:
// - Thin API wrapper for self-service password reset flow
// - No business logic here
// - Uses canonical API_BASE_URL-backed endpoints from app/api.ts

import {
  postJson,
  AUTH_PASSWORD_REQUEST_RESET_URL,
  AUTH_PASSWORD_CONFIRM_RESET_URL,
} from "../app/api";

export type RequestPasswordResetResponse = {
  ok: boolean;
  message?: string;
  error?: string;
};

export type ConfirmPasswordResetResponse = {
  ok: boolean;
  message?: string;
  error?: string;
};

export async function requestPasswordReset(username: string) {
  const normalizedUsername = String(username || "").trim().toUpperCase();

  return postJson<RequestPasswordResetResponse>(
    AUTH_PASSWORD_REQUEST_RESET_URL,
    { username: normalizedUsername }
  );
}

export async function confirmPasswordReset(token: string, password: string) {
  return postJson<ConfirmPasswordResetResponse>(
    AUTH_PASSWORD_CONFIRM_RESET_URL,
    {
      token: String(token || "").trim(),
      password: String(password || ""),
    }
  );
}