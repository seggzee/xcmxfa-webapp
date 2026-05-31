// FILE: src/pages/Messages.tsx
//
// PURPOSE
// - Full member-facing in-app notification history screen
// - Consumes canonical messaging API (not locker-specific API)
// - Uses normalized message records from backend
// - Supports mark-as-read + navigation via link contract
//
// LOCKED CONTRACT
// - Member-facing messaging backend is currently PSN-based
// - Therefore this screen must supply psn to the messages API wrapper
// - No payload parsing here
// - No route guessing here
// - No feature-specific API coupling here
//
// THIS CHANGE ONLY
// - Move page onto reusable StickyPageHeaderCard pattern
// - Keep messages logic / CTA / grouping / actions unchanged
// - Remove old local title-row / back-button shell
//
// ADDED FOR THIS REVISION
// - Show "View" only when a real link exists on the message.
// - Add "Dismiss" button to remove a message from the user's view.
// - After dismiss, dispatch the same global summary refresh event.

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/authStore";
import { getMessages, markMessageRead, dismissMessage } from "../api/messagesApi";
import { requestPushPermissionAndRegister } from "../api/pushApi";
import StickyPageHeaderCard from "../components/StickyPageHeaderCard";
import "../styles/messages.css";
import { UI_ICONS } from "../assets";

type MessageType = "listing" | "flight" | "locker" | "system" | "account" | "admin";

type Message = {
  id: string;
  type: MessageType;
  title: string;
  body: string;
  created_at_utc: string;
  read_at_utc?: string | null;
  link_type?: "internal_route" | "external_url" | "none";
  link_target?: string | null;
  link_fallback?: string | null;
};

function fmtWhen(utc: string) {
  const d = new Date(String(utc || ""));
  if (Number.isNaN(d.getTime())) return "";

  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const day = d.toLocaleDateString("en-GB", { day: "2-digit" });
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${weekday} ${day} ${month} · ${time}`;
}

function typeLabel(t: MessageType) {
	
  if (t === "locker") return "Crew locker";
  if (t === "listing") return "Listing info";
  if (t === "flight") return "Flight update";
  if (t === "account") return "Account";
  if (t === "admin") return "Admin";
  
  return "System";
}

function typeIcon(t: MessageType) {
	
  if (t === "locker") return UI_ICONS.locker_key;
  if (t === "listing") return UI_ICONS.listing;
  if (t === "flight") return UI_ICONS.departures;
  if (t === "account") return UI_ICONS.account;
  if (t === "admin") return UI_ICONS.account;
  
  return UI_ICONS.locker_key;
}

function openExternal(url: string) {
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    // silent
  }
}

export default function Messages() {
  const nav = useNavigate();
  const { auth, psn } = useAuth();

  const isMember = auth?.mode === "member";
  const memberPsn = String(psn || "").trim().toUpperCase();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingText, setLoadingText] = useState("");
  const [errorText, setErrorText] = useState("");

  // THIS CHANGE ONLY:
  // Local state controlling whether the Messages page should show the
  // contextual "Enable notifications" CTA.
  const [showPushCta, setShowPushCta] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      setErrorText("");
      setLoadingText("");

      if (!isMember) {
        setMessages([]);
        return;
      }

      if (!memberPsn) {
        setMessages([]);
        setErrorText("Missing member identity");
        return;
      }

      setLoadingText("Loading…");

      try {
        const resp: any = await getMessages(memberPsn);
        const rows = Array.isArray(resp?.messages) ? resp.messages : [];

        if (!alive) return;
        setMessages(rows);
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
  }, [isMember, memberPsn]);

  // THIS CHANGE ONLY:
  // Decide whether to show the contextual push CTA.
  //
  // Rules:
  // - member only
  // - must have usable PSN
  // - browser must support Notification API
  // - show only while permission state is "default"
  useEffect(() => {
    if (!isMember || !memberPsn) {
      setShowPushCta(false);
      return;
    }

    if (typeof window === "undefined" || !("Notification" in window)) {
      setShowPushCta(false);
      return;
    }

    setShowPushCta(Notification.permission === "default");
  }, [isMember, memberPsn]);

  const grouped = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const today: Message[] = [];
    const earlier: Message[] = [];

    messages.forEach((m) => {
      const k = String(m.created_at_utc || "").slice(0, 10);
      if (k === todayKey) {
        today.push(m);
      } else {
        earlier.push(m);
      }
    });

    const byNewest = (a: Message, b: Message) =>
      String(b.created_at_utc).localeCompare(String(a.created_at_utc));

    return {
      today: today.sort(byNewest),
      earlier: earlier.sort(byNewest),
    };
  }, [messages]);

  const onOpenMessage = async (m: Message) => {
    try {
      if (!m.read_at_utc && memberPsn) {
        await markMessageRead(memberPsn, Number(m.id));

        setMessages((prev) =>
          prev.map((x) =>
            x.id === m.id
              ? { ...x, read_at_utc: x.read_at_utc || new Date().toISOString() }
              : x
          )
        );

        // Immediate global header refresh after successful mark-as-read.
        window.dispatchEvent(new Event("messages:summary-refresh"));
      }
    } catch {
      // silent: opening a message must not explode the page
    }

    const linkType = m.link_type || "none";
    const target = String(m.link_target || "").trim();
    const fallback = String(m.link_fallback || "").trim();

    if (linkType === "internal_route") {
      if (target) {
        nav(target);
        return;
      }
      if (fallback) {
        nav(fallback);
        return;
      }
      return;
    }

    if (linkType === "external_url") {
      if (target) {
        openExternal(target);
        return;
      }
      if (fallback) {
        openExternal(fallback);
        return;
      }
    }
  };

  // ADDED FOR THIS REVISION:
  // Dismiss one message for this member and remove it from local state immediately.
  const onDismissMessage = async (m: Message) => {
    if (!memberPsn) return;

    try {
      await dismissMessage(memberPsn, Number(m.id));

      setMessages((prev) => prev.filter((x) => x.id !== m.id));

      window.dispatchEvent(new Event("messages:summary-refresh"));
    } catch {
      // silent by design
    }
  };

  // THIS CHANGE ONLY:
  // Explicit user-triggered permission request.
  // This is the first allowed moment to ask for push permission.
  const onEnableNotifications = async () => {
    if (!memberPsn || pushBusy) return;

    setPushBusy(true);
    try {
      await requestPushPermissionAndRegister(memberPsn);

      // Re-check actual browser permission after request finishes.
      if (typeof window !== "undefined" && "Notification" in window) {
        setShowPushCta(Notification.permission === "default");
      } else {
        setShowPushCta(false);
      }
    } catch {
      // silent by design
    } finally {
      setPushBusy(false);
    }
  };

  const renderMessage = (m: Message) => {
    const unread = !m.read_at_utc;

    // ADDED FOR THIS REVISION:
    // Only show "View" when there is a real link action available.
    const hasLink =
      m.link_type === "internal_route" || m.link_type === "external_url";

    return (
      <div
        key={m.id}
        className={`messages-card ${unread ? "is-unread" : ""}`}
        onClick={() => void onOpenMessage(m)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            void onOpenMessage(m);
          }
        }}
      >
        <div className="messages-cardTopRow">
		
          <div className="messages-typeLeft">
		  
            <img className="messages-Icon" alt={m.type} src={typeIcon(m.type)} />

            <div className="messages-typeText">{typeLabel(m.type)}</div>
			
          </div>

          <div className="messages-whenText">{fmtWhen(m.created_at_utc)}</div>
		  
        </div>

        <div className="messages-title">{m.title}</div>
        <div className="messages-bodyText">{m.body}</div>

        <div className="messages-actionsRow">
          {hasLink ? (
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
          ) : null}

          <button
            type="button"
            className="messages-dismissBtn"
            onClick={(e) => {
              e.stopPropagation();
              void onDismissMessage(m);
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  };

  const hasAny = messages.length > 0;

  return (
    <div className="messages-page">
      <StickyPageHeaderCard
	    leftContent={
            <img
              src={UI_ICONS.message}
              alt="My profile"
              style={{
                width: 44,
                height: 44,
                objectFit: "contain",
                borderRadius: 14,
              }}
            />
          }
        title="Messages"
        onBack={() => nav(-1)}
        backAriaLabel="Back"
      />

      <div className="messages-scroll">
        {!isMember ? (
          <div className="messages-emptyWrap">
            <div className="messages-emptyTitle">Members only</div>
            <div className="messages-emptyBody">
              Sign in to view your messages and notifications.
            </div>
          </div>
        ) : (
          <>
            {showPushCta ? (
              <div
                style={{
                  marginBottom: 16,
                  border: "1px solid #dbe7ff",
                  background: "#f7faff",
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: "#111827",
                    marginBottom: 8,
                  }}
                >
                  Enable notifications
                </div>

                <div
                  style={{
                    color: "#374151",
                    lineHeight: "20px",
                    marginBottom: 14,
                  }}
                >
                  Receive important alerts about flights, listings, crew lockers, and admin notices.
                </div>

                <button
                  type="button"
                  onClick={() => void onEnableNotifications()}
                  disabled={pushBusy}
                  style={{
                    border: "none",
                    borderRadius: 999,
                    padding: "12px 18px",
                    fontWeight: 900,
                    fontSize: 15,
                    background: "#111827",
                    color: "#ffffff",
                    cursor: pushBusy ? "default" : "pointer",
                    opacity: pushBusy ? 0.7 : 1,
                  }}
                >
                  {pushBusy ? "Please wait…" : "Enable notifications"}
                </button>
              </div>
            ) : null}

            {loadingText ? (
              <div className="messages-statusLine">{loadingText}</div>
            ) : errorText ? (
              <div className="messages-statusLine">{errorText}</div>
            ) : null}

            {!hasAny ? (
              <div className="messages-emptyWrap">
                <div className="messages-emptyTitle">No messages</div>
                <div className="messages-emptyBody">
                  Operational updates, notices, and alerts will appear here.
                </div>
              </div>
            ) : (
              <div className="messages-sections">
                {grouped.today.length > 0 ? (
                  <div className="messages-sectionBlock">
                    <div className="messages-sectionTitle">Today</div>
                    {grouped.today.map(renderMessage)}
                  </div>
                ) : null}

                {grouped.earlier.length > 0 ? (
                  <div className="messages-sectionBlock">
                    <div className="messages-sectionTitle">Earlier</div>
                    {grouped.earlier.map(renderMessage)}
                  </div>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}