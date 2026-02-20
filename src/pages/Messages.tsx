// src/pages/Messages.tsx
/**
 * ============================== MESSAGES SCREEN (CLEAN SLATE) ==============================
 *
 * PURPOSE (what this page is FOR)
 * - This page is the in-app “notification centre” / message inbox for the web app.
 * - Push notifications are *delivery*. This page is the *persistent truth/log* a user can return to.
 * - It must support deep-links into existing screens (Day / My Flights) using existing identifiers.
 *
 * ------------------------------------------------------------------------------------------
 * ASSUMPTIONS / GUESSES (for the full scope we described earlier)
 *
 * (1) MESSAGE CATEGORIES (items 1–5 we discussed)
 *     We assume 5 categories will exist, because they map directly to your domain:
 *       1) Listing status updates
 *       2) Flight operational changes
 *       3) Commuter activity (optional + throttled)
 *       4) Admin / system messages
 *       5) Security / account messages
 *
 *     Display rules (GUESS):
 *       - Guests: can see only "system" messages (e.g., maintenance, marketing, release notes).
 *       - Members: can see all categories relevant to them.
 *       - The UI should NOT fabricate content. If a message lacks flight_no/route etc, we just show title/body.
 *
 * (2) MESSAGE STORAGE & RETENTION (how messages persist)
 *     GUESS:
 *       - Messages are stored server-side (DB) per-user (psn) + system broadcast messages.
 *       - The app fetches messages on demand (screen load) and optionally polls/refreshes.
 *       - Retention policy likely needed (e.g., 30–90 days) BUT that is backend policy.
 *       - The client must never rely on push payload as the only source of truth.
 *
 * (3) PUSH NOTIFICATION FLOW (how push relates to this screen)
 *     GUESS:
 *       - Push payload contains a message_id and maybe a deep_link hint.
 *       - On receiving push:
 *           a) Service worker shows notification immediately.
 *           b) When user opens the app (tap notification), app deep-links to target screen.
 *           c) The message is already in DB; client fetch will show it here as unread/read.
 *       - “Unread count” should come from server (authoritative), not computed from local-only state.
 *
 * (4) DEEP LINKING TARGETS (what messages can open)
 *     GUESS:
 *       - Listing / flight messages deep-link to:
 *           - Day screen for a flight_instance_id (preferred if you have airport+date available)
 *           - or My Flights (if flight_instance_id is enough to locate the card).
 *       - Minimum safe link field is flight_instance_id (already used everywhere).
 *       - If we don’t have enough info to route precisely, we open My Flights as fallback destination.
 *         (This is a *navigation fallback*, not data fabrication.)
 *
 * (5) READ/UNREAD & USER ACTIONS (scope expectations)
 *     GUESS:
 *       - Each message has created_at_utc and optional read_at_utc.
 *       - Mark-as-read occurs when:
 *           - user opens the message detail (if we add a detail view), OR
 *           - user taps "View" and we navigate to the target (simpler).
 *       - “Mark all as read” is useful but optional. If you want zero surprises, implement later.
 *       - Deleting messages is optional and can be added later (avoid scope creep now).
 *
 * ------------------------------------------------------------------------------------------
 * IMPORTANT GUARDRAILS (matching your project philosophy)
 * - No synthetic fields: we display what we are given.
 * - No “helpful” inferred route/time if not present in message payload.
 * - UI first: keep this screen display-only; do not entangle it with push subscription code.
 * - This file is a PRESENTATION + navigation shell; API wiring can be added in one coherent patch later.
 *
 * ------------------------------------------------------------------------------------------
 * DATA CONTRACT (PROPOSED MINIMUM — matches above assumptions; adjust when backend is ready)
 *
 * type Message = {
 *   id: string;
 *   type: "listing" | "flight" | "commuter" | "system" | "account";
 *   title: string;            // short headline
 *   body: string;             // main text (can be 1–3 lines)
 *   created_at_utc: string;   // ISO string
 *   read_at_utc?: string|null;
 *
 *   // Optional navigation hints (no guesses if missing)
 *   flight_instance_id?: string|null;
 *   airport_code?: string|null;  // if available for Day route
 *   date_key?: string|null;      // YYYY-MM-DD if available for Day route
 * };
 *
 * ------------------------------------------------------------------------------------------
 * STATUS: UI DESIGN IMPLEMENTED; API WIRING IS TODO
 * - Today this page renders an empty list state.
 * - When you later provide an API endpoint, we will replace the local demo data with fetch results.
 * ==========================================================================================
 */



import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/authStore";
import { getCrewLockerNotifications, markCrewLockerNotificationRead } from "../api/crewLockersApi";

// ✅ Standard back icon button (same as Week)
import BackButton from "../components/BackButton";

import "../styles/messages.css";

type MessageType = "listing" | "flight" | "commuter" | "system" | "account" | "locker";

type Message = {
  id: string;
  type: MessageType;
  title: string;
  body: string;
  created_at_utc: string;
  read_at_utc?: string | null;

  // Optional navigation hints (future)
  flight_instance_id?: string | null;
  airport_code?: string | null;
  date_key?: string | null;

  // Locker hint (we route to Crew Lockers)
  locker_uuid?: string | null;
};

function fmtWhen(utc: string) {
  const d = new Date(String(utc || ""));
  if (Number.isNaN(d.getTime())) return "";
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const day = d.toLocaleDateString("en-GB", { day: "2-digit" });
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${weekday} ${day} ${month} · ${time}`;
}

function typeLabel(t: MessageType) {
  if (t === "locker") return "Crew locker";
  if (t === "listing") return "Listing update";
  if (t === "flight") return "Flight update";
  if (t === "commuter") return "Commuter activity";
  if (t === "account") return "Account";
  return "System";
}

function typeIcon(t: MessageType) {
  if (t === "locker") return "🔒";
  if (t === "listing") return "🧾";
  if (t === "flight") return "✈️";
  if (t === "commuter") return "👥";
  if (t === "account") return "🔐";
  return "📣";
}

export default function Messages() {
  const nav = useNavigate();
  const { auth, psn } = useAuth();

  const isMember = auth?.mode === "member";

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingText, setLoadingText] = useState<string>("");
  const [errorText, setErrorText] = useState<string>("");

  useEffect(() => {
    let alive = true;

    (async () => {
      setErrorText("");
      setLoadingText("");

      if (!isMember) {
        setMessages([]);
        return;
      }

      const psnForApi = String(psn || auth?.user?.username || "")
        .trim()
        .toUpperCase();

      if (!psnForApi) {
        setMessages([]);
        return;
      }

      setLoadingText("Loading…");

      try {
        const resp: any = await getCrewLockerNotifications(psnForApi);
        const rows = Array.isArray(resp?.messages) ? resp.messages : [];

        const mapped: Message[] = rows.map((r: any) => {
          const created = String(r?.created_at || "");
          const readAt = r?.read_at ? String(r.read_at) : null;

          // payload_json is useful later for deep-linking; we keep it but don’t invent anything
          let payload: any = null;
          try {
            payload = r?.payload_json ? JSON.parse(String(r.payload_json)) : null;
          } catch {
            payload = null;
          }

          const type: MessageType = String(r?.type) === "locker_expiry" ? "locker" : "system";

          return {
            id: String(r?.id),
            type,
            title: String(r?.title || ""),
            body: String(r?.body || ""),
            created_at_utc: created ? new Date(created.replace(" ", "T") + "Z").toISOString() : new Date().toISOString(),
            read_at_utc: readAt ? new Date(readAt.replace(" ", "T") + "Z").toISOString() : null,
            locker_uuid: payload?.locker_uuid ? String(payload.locker_uuid) : null,
          };
        });

        if (!alive) return;
        setMessages(mapped);
      } catch (e: any) {
        if (!alive) return;
        setErrorText(e?.message || "Failed to load messages");
        setMessages([]);
      } finally {
        if (!alive) return;
        setLoadingText("");
      }
    })();

    return () => {
      alive = false;
    };
  }, [isMember, psn, auth?.user?.username]);

  const visibleMessages = useMemo(() => {
    const rows = Array.isArray(messages) ? messages : [];
    if (isMember) return rows;
    return rows.filter((m) => m.type === "system");
  }, [messages, isMember]);

  const grouped = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const today: Message[] = [];
    const earlier: Message[] = [];

    visibleMessages.forEach((m) => {
      const k = String(m.created_at_utc || "").slice(0, 10);
      if (k === todayKey) today.push(m);
      else earlier.push(m);
    });

    const byNewest = (a: Message, b: Message) => String(b.created_at_utc).localeCompare(String(a.created_at_utc));
    return { today: today.sort(byNewest), earlier: earlier.sort(byNewest) };
  }, [visibleMessages]);

  const onOpenMessage = async (m: Message) => {
    // Mark read (best-effort)
    if (isMember) {
      const psnForApi = String(psn || auth?.user?.username || "").trim().toUpperCase();
      const idNum = Number(m.id);
      if (psnForApi && Number.isFinite(idNum) && idNum > 0) {
        try {
          await markCrewLockerNotificationRead(psnForApi, idNum);
          // optimistic update (don’t refetch)
          setMessages((prev) =>
            prev.map((x) => (x.id === m.id ? { ...x, read_at_utc: x.read_at_utc || new Date().toISOString() } : x))
          );
        } catch {
          // silent (messages screen must not explode)
        }
      }
    }

    // Navigation rules:
    // - Locker messages go to Crew Lockers page (no guessing beyond that).
    if (m.type === "locker") {
      nav("/crew-lockers");
      return;
    }

    // Future: other message deep-links (kept as your original intent)
    if (m.airport_code && m.date_key) {
      nav(`/day/${m.date_key}?tab=departures`, { state: { airport: String(m.airport_code).toUpperCase() } });
      return;
    }
    if (m.flight_instance_id) {
      nav("/myflights");
      return;
    }
  };

  const renderMessage = (m: Message) => {
    const unread = !m.read_at_utc;

    return (
      <div
        key={m.id}
        className={`messages-card ${unread ? "is-unread" : ""}`}
        onClick={() => onOpenMessage(m)}
        role="button"
        tabIndex={0}
      >
        <div className="messages-cardTopRow">
          <div className="messages-typeLeft">
            <span className="messages-typeIcon">{typeIcon(m.type)}</span>
            <div className="messages-typeText">{typeLabel(m.type)}</div>
          </div>

          <div className="messages-whenText">{fmtWhen(m.created_at_utc)}</div>
        </div>

        <div className="messages-title">{m.title}</div>
        <div className="messages-bodyText">{m.body}</div>

        <div className="messages-actionsRow">
          <button
            type="button"
            className="messages-viewBtn"
            onClick={(e) => {
              e.stopPropagation();
              void onOpenMessage(m);
            }}
          >
            View
          </button>
        </div>
      </div>
    );
  };

  const hasAny = visibleMessages.length > 0;

  return (
    <div className="messages-page">
      <div className="messages-scroll">
        <div className="messages-headerRow">
          <div className="messages-pageTitle">Messages</div>

          {/* ✅ Standard icon back button */}
          <BackButton onClick={() => nav(-1)} ariaLabel="Back" size={38} />
        </div>

        {loadingText ? (
          <div className="messages-statusLine">{loadingText}</div>
        ) : errorText ? (
          <div className="messages-statusLine">{errorText}</div>
        ) : null}

        {!hasAny ? (
          <div className="messages-emptyWrap">
            <div className="messages-emptyTitle">No messages</div>
            <div className="messages-emptyBody">
              {isMember
                ? "When push notifications are enabled, your locker and flight updates will appear here."
                : "System updates will appear here."}
            </div>
          </div>
        ) : (
          <>
            {grouped.today.length > 0 ? (
              <>
                <div className="messages-sectionTitle">Today</div>
                {grouped.today.map(renderMessage)}
              </>
            ) : null}

            {grouped.earlier.length > 0 ? (
              <>
                <div className="messages-sectionTitle">Earlier</div>
                {grouped.earlier.map(renderMessage)}
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}