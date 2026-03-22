// FILE: src/api/messagesApi.ts
// PURPOSE:
// - User-facing messaging API wrapper for the app.
// - This module talks to the /api/messages/* PHP endpoints.
//
// LOCKED CONTRACT:
// - The current member-facing messaging backend is PSN-based.
// - Therefore EVERY user-scoped request in this file must supply psn.
// - Do not mix contracts (no partial auth-derived identity here).
//
// ENDPOINTS USED:
// - GET  /api/messages/list.php?psn=...
// - GET  /api/messages/unread_count.php?psn=...
// - POST /api/messages/mark_read.php
// - GET  /api/messages/active_popup.php?psn=...
// - POST /api/messages/dismiss_popup.php
//
// ADDED FOR THIS REVISION:
// - POST /api/messages/dismiss.php

import {
  MESSAGES_LIST_URL,
  MESSAGES_UNREAD_COUNT_URL,
  MESSAGES_MARK_READ_URL,
  MESSAGES_ACTIVE_POPUP_URL,
  MESSAGES_DISMISS_POPUP_URL,
  MESSAGES_DISMISS_MESSAGE_URL,
  getJson,
} from "../app/api";

/* ---------------------------------------------------------
   Small helpers
--------------------------------------------------------- */

function buildPsnQueryUrl(baseUrl: string, psn: string): string {
  const cleanPsn = String(psn || "").trim().toUpperCase();
  return `${baseUrl}?psn=${encodeURIComponent(cleanPsn)}`;
}

function assertPsn(psn: string): string {
  const cleanPsn = String(psn || "").trim().toUpperCase();

  if (!cleanPsn) {
    throw new Error("messagesApi: psn is required");
  }

  return cleanPsn;
}

async function postFormExpectOk(url: string, form: FormData) {
  const res = await fetch(url, {
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
    err.url = url;
    err.body = text;
    err.data = data;
    throw err;
  }

  return data;
}

/* ---------------------------------------------------------
   GET: list messages
--------------------------------------------------------- */

export async function getMessages(psn: string) {
  const cleanPsn = assertPsn(psn);

  return getJson<{ ok: boolean; messages: any[] }>(
    buildPsnQueryUrl(MESSAGES_LIST_URL, cleanPsn)
  );
}

/* ---------------------------------------------------------
   GET: unread count
--------------------------------------------------------- */

export async function getUnreadMessageCount(psn: string) {
  const cleanPsn = assertPsn(psn);

  return getJson<{ ok: boolean; unread_count: number }>(
    buildPsnQueryUrl(MESSAGES_UNREAD_COUNT_URL, cleanPsn)
  );
}

/* ---------------------------------------------------------
   POST: mark one message read
--------------------------------------------------------- */

export async function markMessageRead(psn: string, id: string | number) {
  const cleanPsn = assertPsn(psn);

  const form = new FormData();
  form.append("psn", cleanPsn);
  form.append("id", String(id));

  return postFormExpectOk(MESSAGES_MARK_READ_URL, form);
}

/* ---------------------------------------------------------
   POST: dismiss one message
--------------------------------------------------------- */

export async function dismissMessage(psn: string, id: string | number) {
  const cleanPsn = assertPsn(psn);

  const form = new FormData();
  form.append("psn", cleanPsn);
  form.append("id", String(id));

  return postFormExpectOk(MESSAGES_DISMISS_MESSAGE_URL, form);
}

/* ---------------------------------------------------------
   GET: active popup
--------------------------------------------------------- */

export async function getActivePopupMessage(psn: string) {
  const cleanPsn = assertPsn(psn);

  return getJson<{ ok: boolean; popup: any | null }>(
    buildPsnQueryUrl(MESSAGES_ACTIVE_POPUP_URL, cleanPsn)
  );
}

/* ---------------------------------------------------------
   POST: dismiss popup
--------------------------------------------------------- */

export async function dismissPopupMessage(psn: string, id: string | number) {
  const cleanPsn = assertPsn(psn);

  const form = new FormData();
  form.append("psn", cleanPsn);
  form.append("id", String(id));

  return postFormExpectOk(MESSAGES_DISMISS_POPUP_URL, form);
}