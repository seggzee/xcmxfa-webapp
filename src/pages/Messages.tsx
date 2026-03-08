// src/pages/Messages.tsx
//
// ==========================================================================================
// MESSAGES SCREEN (GENERIC MESSAGING VERSION)
// ==========================================================================================
//
// PURPOSE
// - Full member-facing in-app notification history screen
// - Consumes canonical messaging API (not locker-specific API)
// - Uses normalized message records from backend
// - Supports mark-as-read + navigation via link contract
//
// LOCKED FIRST-PASS RULES
// - Member-only
// - No dropdown logic here
// - No payload parsing
// - No route guessing
// - No feature-specific API coupling
// ==========================================================================================

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/authStore";
import { getMessages, markMessageRead } from "../api/messagesApi";
import BackButton from "../components/BackButton";
import "../styles/messages.css";

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
  if (t === "listing") return "Listing update";
  if (t === "flight") return "Flight update";
  if (t === "account") return "Account";
  if (t === "admin") return "Admin";
  return "System";
}

function typeIcon(t: MessageType) {
  if (t === "locker") return "🔒";
  if (t === "listing") return "🧾";
  if (t === "flight") return "✈️";
  if (t === "account") return "🔐";
  if (t === "admin") return "📣";
  return "🔔";
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
  const { auth } = useAuth();

  const isMember = auth?.mode === "member";

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingText, setLoadingText] = useState("");
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      setErrorText("");
      setLoadingText("");

      if (!isMember) {
        setMessages([]);
        return;
      }

      setLoadingText("Loading…");

      try {
        const resp: any = await getMessages();
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
  }, [isMember]);

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
      if (!m.read_at_utc) {
        await markMessageRead(Number(m.id));

        setMessages((prev) =>
          prev.map((x) =>
            x.id === m.id
              ? { ...x, read_at_utc: x.read_at_utc || new Date().toISOString() }
              : x
          )
        );
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

  const renderMessage = (m: Message) => {
    const unread = !m.read_at_utc;

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

  const hasAny = messages.length > 0;

  if (!isMember) {
    return (
      <div className="messages-page">
        <div className="messages-scroll">
          <div className="messages-headerRow">
            <div className="messages-pageTitle">Messages</div>
            <BackButton onClick={() => nav(-1)} ariaLabel="Back" size={38} />
          </div>

          <div className="messages-emptyWrap">
            <div className="messages-emptyTitle">Members only</div>
            <div className="messages-emptyBody">
              Sign in to view your messages and notifications.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="messages-page">
      <div className="messages-scroll">
        <div className="messages-headerRow">
          <div className="messages-pageTitle">Messages</div>
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
      </div>
    </div>
  );
}