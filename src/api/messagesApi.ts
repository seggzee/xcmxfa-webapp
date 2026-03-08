// src/api/messagesApi.ts

import {
  MESSAGES_LIST_URL,
  MESSAGES_UNREAD_COUNT_URL,
  MESSAGES_MARK_READ_URL,
  MESSAGES_ACTIVE_POPUP_URL,
  MESSAGES_DISMISS_POPUP_URL,
  getJson,
} from "../app/api";

export async function getMessages() {
  return getJson<{ ok: boolean; messages: any[] }>(MESSAGES_LIST_URL);
}

export async function getUnreadMessageCount() {
  return getJson<{ ok: boolean; unread_count: number }>(MESSAGES_UNREAD_COUNT_URL);
}

export async function markMessageRead(id: string | number) {
  // PHP endpoint uses $_POST, so we must use FormData (same pattern as lockers API)

  const form = new FormData();
  form.append("id", String(id));

  const res = await fetch(MESSAGES_MARK_READ_URL, {
    method: "POST",
    body: form,
  });

  const text = await res.text();

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}

  if (!res.ok || data?.ok !== true) {
    const err: any = new Error(`Request failed (${res.status})`);
    err.status = res.status;
    err.url = MESSAGES_MARK_READ_URL;
    err.body = text;
    err.data = data;
    throw err;
  }
}

export async function getActivePopupMessage() {
  return getJson<{ ok: boolean; popup: any | null }>(MESSAGES_ACTIVE_POPUP_URL);
}

export async function dismissPopupMessage(id: string | number) {
  const form = new FormData();
  form.append("id", String(id));

  const res = await fetch(MESSAGES_DISMISS_POPUP_URL, {
    method: "POST",
    body: form,
  });

  const text = await res.text();

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}

  if (!res.ok || data?.ok !== true) {
    const err: any = new Error(`Request failed (${res.status})`);
    err.status = res.status;
    err.url = MESSAGES_DISMISS_POPUP_URL;
    err.body = text;
    err.data = data;
    throw err;
  }
}