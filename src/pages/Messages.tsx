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

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/authStore";

type MessageType = "listing" | "flight" | "commuter" | "system" | "account";

type Message = {
  id: string;
  type: MessageType;
  title: string;
  body: string;
  created_at_utc: string;
  read_at_utc?: string | null;

  flight_instance_id?: string | null;
  airport_code?: string | null;
  date_key?: string | null;
};

function fmtWhen(utc: string) {
  const d = new Date(String(utc || ""));
  if (Number.isNaN(d.getTime())) return "";
  // Compact: "Sat 14 Feb · 14:45"
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const day = d.toLocaleDateString("en-GB", { day: "2-digit" });
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${weekday} ${day} ${month} · ${time}`;
}

function typeLabel(t: MessageType) {
  if (t === "listing") return "Listing update";
  if (t === "flight") return "Flight update";
  if (t === "commuter") return "Commuter activity";
  if (t === "account") return "Account";
  return "System";
}

function typeIcon(t: MessageType) {
  // Display-only icon glyphs for now (no new assets introduced here).
  // If you want UI_ICONS later, we swap these without changing layout.
  if (t === "listing") return "🧾";
  if (t === "flight") return "✈️";
  if (t === "commuter") return "👥";
  if (t === "account") return "🔐";
  return "📣";
}

export default function Messages() {
  const nav = useNavigate();
  const { auth } = useAuth();

  const isMember = auth?.mode === "member";

  // TODO (API wiring):
  // Replace this with server-fetched messages.
  // For now: empty list to keep “no invention” discipline.
  const [messages] = useState<Message[]>([]);

  // Display rule guess:
  // - guests see only "system"
  // - members see all
  const visibleMessages = useMemo(() => {
    const rows = Array.isArray(messages) ? messages : [];
    if (isMember) return rows;
    return rows.filter((m) => m.type === "system");
  }, [messages, isMember]);

  const grouped = useMemo(() => {
    // Simple grouping: Today / Earlier (no fancy date buckets yet)
    const todayKey = new Date().toISOString().slice(0, 10);
    const today: Message[] = [];
    const earlier: Message[] = [];

    visibleMessages.forEach((m) => {
      const k = String(m.created_at_utc || "").slice(0, 10);
      if (k === todayKey) today.push(m);
      else earlier.push(m);
    });

    // Newest first
    const byNewest = (a: Message, b: Message) => String(b.created_at_utc).localeCompare(String(a.created_at_utc));

    return {
      today: today.sort(byNewest),
      earlier: earlier.sort(byNewest),
    };
  }, [visibleMessages]);

  const onOpenMessage = (m: Message) => {
    // Navigation rule (GUESS):
    // Prefer Day if airport_code + date_key exist; else go to My Flights if flight_instance_id exists; else do nothing.
    if (m.airport_code && m.date_key) {
      nav(`/day/${m.date_key}?tab=departures`, { state: { airport: String(m.airport_code).toUpperCase() } });
      return;
    }
    if (m.flight_instance_id) {
      nav("/my-flights");
      return;
    }
    // No target; stay put (display-only).
  };

  const styles: Record<string, React.CSSProperties> = {
    screen: { minHeight: "100vh", background: "#f6f7f9" },
	
    body: {
	  padding: 16,
	  paddingBottom: 40,
	  paddingTop: "calc(var(--appheader-sticky-offset, 86px) + 12px)",
	  maxWidth: 760,
	  margin: "0 auto",
	},

    headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 },
    pageTitle: { fontWeight: 900, fontSize: 20, color: "#132333" },
    backBtn: {
      height: 36,
      minWidth: 84,
      borderRadius: 999,
      border: "1px solid #d9e2ee",
      background: "#ffffff",
      fontWeight: 900,
      color: "#132333",
      cursor: "pointer",
      fontSize: 14,
      padding: "0 14px",
    },

    sectionTitle: { marginTop: 10, fontWeight: 900, fontSize: 12, color: "rgba(19,35,51,0.55)" },

    card: {
      marginTop: 10,
      background: "#ffffff",
      borderRadius: 16,
      border: "2px solid #d9e2ee",
      padding: 14,
      cursor: "pointer",
    },
    cardUnread: {
      background: "rgba(185,28,28,0.04)",
      borderColor: "rgba(185,28,28,0.18)",
    },

    topRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
    typeLeft: { display: "flex", alignItems: "center", gap: 8, minWidth: 0 },
    typeIcon: { fontSize: 16 },
    typeText: { fontWeight: 900, fontSize: 12, color: "#132333" },

    whenText: { fontWeight: 800, fontSize: 12, color: "rgba(19,35,51,0.55)", whiteSpace: "nowrap" as const },

    title: { marginTop: 10, fontWeight: 900, fontSize: 14, color: "#132333" },
    bodyText: { marginTop: 6, fontWeight: 700, fontSize: 12, color: "rgba(19,35,51,0.75)", lineHeight: "18px" },

    actionsRow: { marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 10 },
    viewBtn: {
      borderRadius: 14,
      padding: "10px 14px",
      fontWeight: 900,
      fontSize: 13,
      border: "1px solid #d9e2ee",
      background: "#ffffff",
      cursor: "pointer",
      color: "#132333",
    },

    emptyWrap: { marginTop: 50, textAlign: "center" as const },
    emptyTitle: { fontWeight: 900, fontSize: 16, color: "#132333" },
    emptyBody: { marginTop: 6, fontWeight: 700, color: "rgba(19,35,51,0.6)" },
  };

  const renderMessage = (m: Message) => {
    const unread = !m.read_at_utc;
    return (
      <div
        key={m.id}
        style={{ ...styles.card, ...(unread ? styles.cardUnread : null) }}
        onClick={() => onOpenMessage(m)}
        role="button"
        tabIndex={0}
      >
        <div style={styles.topRow}>
          <div style={styles.typeLeft}>
            <span style={styles.typeIcon}>{typeIcon(m.type)}</span>
            <div style={styles.typeText}>{typeLabel(m.type)}</div>
          </div>

          <div style={styles.whenText}>{fmtWhen(m.created_at_utc)}</div>
        </div>

        <div style={styles.title}>{m.title}</div>
        <div style={styles.bodyText}>{m.body}</div>

        <div style={styles.actionsRow}>
          <button type="button" style={styles.viewBtn} onClick={(e) => { e.stopPropagation(); onOpenMessage(m); }}>
            View
          </button>
        </div>
      </div>
    );
  };

  const hasAny = visibleMessages.length > 0;

  return (
    <div style={styles.screen}>
      <div style={styles.body}>
        <div style={styles.headerRow}>
          <div style={styles.pageTitle}>Messages</div>
          <button type="button" style={styles.backBtn} onClick={() => nav(-1)}>
            Back
          </button>
        </div>

        {!hasAny ? (
          <div style={styles.emptyWrap}>
            <div style={styles.emptyTitle}>No messages</div>
            <div style={styles.emptyBody}>
              {isMember
                ? "When push notifications are enabled, your listing and flight updates will appear here."
                : "System updates will appear here."}
            </div>
          </div>
        ) : (
          <>
            {grouped.today.length > 0 ? (
              <>
                <div style={styles.sectionTitle}>Today</div>
                {grouped.today.map(renderMessage)}
              </>
            ) : null}

            {grouped.earlier.length > 0 ? (
              <>
                <div style={styles.sectionTitle}>Earlier</div>
                {grouped.earlier.map(renderMessage)}
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
