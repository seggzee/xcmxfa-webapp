import {
  CREW_LOCKERS_LIST_URL,
  CREW_LOCKERS_NOTIFICATIONS_LIST_URL,
  CREW_LOCKERS_NOTIFICATIONS_MARK_READ_URL,
  getJson,
  postJson,
} from "../app/api";

export async function getCrewLockers(psn: string) {
  const url = `${CREW_LOCKERS_LIST_URL}?psn=${encodeURIComponent(psn)}`;
  return getJson<{ ok: boolean; lockers: any[] }>(url);
}

export async function getCrewLockerNotifications(psn: string) {
  const url = `${CREW_LOCKERS_NOTIFICATIONS_LIST_URL}?psn=${encodeURIComponent(psn)}`;
  return getJson<{ ok: boolean; messages: any[] }>(url);
}

export async function markCrewLockerNotificationRead(psn: string, id: number) {
  // This endpoint is form-post style in PHP; we use postJson for consistency with your tooling.
  // If you prefer $_POST instead of JSON, we can swap to FormData later.
  // For now, we’ll accept JSON and decode it server-side only if you update PHP.
  // Since your PHP currently reads $_POST, we must use FormData here.

  const form = new FormData();
  form.append("psn", psn);
  form.append("id", String(id));

  const res = await fetch(CREW_LOCKERS_NOTIFICATIONS_MARK_READ_URL, {
    method: "POST",
    body: form,
  });

  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch {}

  if (!res.ok || data?.ok !== true) {
    const err: any = new Error(`Request failed (${res.status})`);
    err.status = res.status;
    err.url = CREW_LOCKERS_NOTIFICATIONS_MARK_READ_URL;
    err.body = text;
    err.data = data;
    throw err;
  }
}
