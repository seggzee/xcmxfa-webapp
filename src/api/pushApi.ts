// FILE: src/api/pushApi.ts
//
// =====================================================================================
// PUSH NOTIFICATIONS API (WEB)
// =====================================================================================
//
// PURPOSE
// - Register / unregister the browser/device for push notifications using Firebase Messaging.
//
// IMPORTANT DESIGN RULES
// - App boot / login MUST NOT trigger a permission prompt.
// - Permission requests must only occur after an explicit user action
//   (e.g. Messages page CTA or Profile preference switch).
//
// Therefore this file exposes FOUR functions:
//
// 1) syncPushDeviceIfPermitted(psn)
//    - silent background sync
//    - runs only if permission is already "granted"
//    - used by routes.tsx
//    - IMPORTANT: does NOT override an explicit OFF state for this device
//
// 2) requestPushPermissionAndRegister(psn)
//    - explicitly asks user for permission
//    - used by Messages CTA / Profile preference switch
//
// 3) unregisterPushDevice(psn)
//    - deactivates the current device token in backend
//    - used when user turns push OFF in Profile
//
// 4) getPushDeviceStatus(psn)
//    - used by Profile page to set initial toggle position from DB truth
//
// =====================================================================================

import { messaging } from "../app/firebase";
import { getToken } from "firebase/messaging";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const REGISTER_URL = `${API_BASE_URL}/api/push/register_device.php`;
const UNREGISTER_URL = `${API_BASE_URL}/api/push/unregister_device.php`;
const DEVICE_STATUS_URL = `${API_BASE_URL}/api/push/device_status.php`;

/* =====================================================================================
   Helper: register current device token with backend
===================================================================================== */
async function registerDevice(psn: string, token: string) {
  const res = await fetch(REGISTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      psn,
      platform: "ios", // web push routed through FCM for current first pass
      device_token: token,
      device_name: "Web Browser",
      //device_name: `${navigator.platform} | ${navigator.userAgent.slice(0, 40)}`,
      app_version: "web",
      os_version: navigator.platform,
    }),
  });

  if (!res.ok) {
    throw new Error(`Push register failed (${res.status})`);
  }

  const text = await res.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {}

  if (!data?.ok) {
    throw new Error(data?.message || "Push register failed");
  }
}

/* =====================================================================================
   Helper: unregister current device token from backend
===================================================================================== */
async function unregisterDevice(psn: string, token: string) {
  const res = await fetch(UNREGISTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      psn,
      device_token: token,
    }),
  });

  if (!res.ok) {
    throw new Error(`Push unregister failed (${res.status})`);
  }

  const text = await res.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {}

  if (!data?.ok) {
    throw new Error(data?.message || "Push unregister failed");
  }
}

/* =====================================================================================
   GET DEVICE STATUS FOR PROFILE PAGE TOGGLE SWITCH POSITION
===================================================================================== */
/**
 * Used by Profile notification preference switch.
 *
 * Behaviour:
 * - Reads current-device DB truth for this exact token.
 * - true  => current device row exists and is_active = 1
 * - false => missing row OR inactive row OR error
 *
 * IMPORTANT:
 * - Must NEVER trigger a permission prompt on page load.
 * - Therefore if permission is not already granted, return false immediately.
 */
export async function getPushDeviceStatus(psn: string) {
  if (!("Notification" in window)) return false;

  if (Notification.permission !== "granted") {
    return false;
  }

  try {
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    });

    if (!token) return false;

    const res = await fetch(DEVICE_STATUS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        psn,
        device_token: token,
      }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    return !!data?.push_enabled;
  } catch {
    return false;
  }
}

/* =====================================================================================
   SILENT SYNC
===================================================================================== */
/**
 * Used by AppRoutes.
 * Runs only if permission is already granted.
 * NEVER prompts the user.
 *
 * IMPORTANT:
 * - Must NOT override an explicit OFF state for this current device.
 * - Therefore:
 *   1. get current token
 *   2. check current-device DB status
 *   3. if inactive/missing => do NOT auto-register
 *   4. only explicit user action should turn it ON again
 */
export async function syncPushDeviceIfPermitted(psn: string) {
  if (!("Notification" in window)) return;

  if (Notification.permission !== "granted") {
    return;
  }

  try {
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    });

    if (!token) return;

    // IMPORTANT:
    // Silent sync must not re-enable a device the user explicitly turned OFF.
    // If backend says current device is not enabled, we leave it alone.
    const enabled = await getPushDeviceStatus(psn);
    if (!enabled) {
      return;
    }

    await registerDevice(psn, token);
  } catch {
    // silent by design
  }
}

/* =====================================================================================
   EXPLICIT USER PERMISSION REQUEST
===================================================================================== */
/**
 * Used by Messages CTA or Profile switch.
 * This is the ONLY place permission should be requested.
 */
export async function requestPushPermissionAndRegister(psn: string) {
  if (!("Notification" in window)) return;

  let permission = Notification.permission;

  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    return;
  }

  try {
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    });

    if (!token) return;

    await registerDevice(psn, token);
  } catch {
    // silent by design
  }
}

/* =====================================================================================
   EXPLICIT USER TURN-OFF
===================================================================================== */
/**
 * Used by Profile notification preference switch.
 *
 * Behaviour:
 * - If browser permission is not granted, there is nothing to unregister.
 * - If granted, get the current FCM token and deactivate it in backend.
 */
export async function unregisterPushDevice(psn: string) {
  if (!("Notification" in window)) return;

  if (Notification.permission !== "granted") {
    return;
  }

  try {
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    });

    if (!token) return;

    await unregisterDevice(psn, token);
  } catch {
    // silent by design
  }
}