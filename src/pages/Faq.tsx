// src/pages/Faq.tsx
//
// =====================================================================================
// FAQ / Info — legacy content modernised (best effort, editable)
// Week-style sticky header junction (bleed-safe)
// =====================================================================================
//
// IDIOT GUIDE:
// - This page is intentionally "dumb": no API calls, no auth requirements.
// - Uses the SAME sticky header junction pattern as Week (week-sticky + app-container + header card).
// - Back control uses the standard BackButton component.
//
// Notes:
// - DIY scans come from assets: DIY_LISTING_SCANS.xcmxfa1..xcmxfa5
// - Search only matches question text + keywords + topic label (we don't stringify ReactNode bodies).
// =====================================================================================

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { DIY_LISTING_SCANS } from "../assets";
import BackButton from "../components/BackButton";

type Topic =
  | "intro"
  | "flights"
  | "listing"
  | "passport"
  | "outstations"
  | "notifications"
  | "lockers"
  | "account"
  | "legal"
  | "troubleshooting";

type FaqItem = {
  id: string;
  topic: Topic;
  q: string;
  a: React.ReactNode;
  keywords?: string[];
};

function normalizeText(v: any) {
  return String(v || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function topicLabel(t: Topic) {
  switch (t) {
    case "intro":
      return "Intro";
    case "flights":
      return "Flights";
    case "listing":
      return "Listing & acceptance";
    case "passport":
      return "Passport";
    case "outstations":
      return "Outstations";
    case "notifications":
      return "Notifications";
    case "lockers":
      return "Lockers";
    case "account":
      return "Account";
    case "legal":
      return "Legal";
    case "troubleshooting":
      return "Troubleshooting";
    default:
      return String(t);
  }
}

function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 12px",
        borderRadius: 999,
        fontWeight: 900,
        border: active ? "2px solid rgba(19,35,51,0.22)" : "2px solid rgba(19,35,51,0.10)",
        background: active ? "rgba(19,35,51,0.06)" : "#fff",
        color: "#132333",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function FaqRow({
  item,
  open,
  onToggle,
}: {
  item: FaqItem;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        border: "1px solid rgba(19,35,51,0.10)",
        borderRadius: 14,
        padding: 14,
        background: "#fff",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          textAlign: "left",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
        aria-expanded={open}
        aria-controls={`faq-${item.id}`}
      >
        <div style={{ fontSize: 14, fontWeight: 950, color: "#132333", lineHeight: 1.25 }}>{item.q}</div>

        <div
          aria-hidden="true"
          style={{
            width: 30,
            height: 30,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid rgba(19,35,51,0.12)",
			fontSize: 14,			
            fontWeight: 950,
            color: "rgba(19,35,51,0.65)",
            flex: "0 0 auto",
          }}
        >
          {open ? "–" : "+"}
        </div>
      </button>

      {open ? (
        <div
          id={`faq-${item.id}`}
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px solid rgba(19,35,51,0.10)",
            color: "rgba(19,35,51,0.86)",
			fontSize: 14,
            fontWeight: 750,
            lineHeight: 1.25,
          }}
        >
          {item.a}
        </div>
      ) : null}
    </div>
  );
}

export default function Faq() {
  const nav = useNavigate();

  const items: FaqItem[] = useMemo(
    () => [
      // INTRO
      {
        id: "unofficial",
        topic: "intro",
        q: "Is this an official KLM app?",
        a: (
          <>
            No. This is a privately developed app used by kind agreement of some outstations to help
            them plan for XCM/XFA travel and reduce day-of-travel friction.
            <br />
            <br />
            There is NO direct link from this app to airline booking systems or KLM IT infrastructure.
          </>
        ),
        keywords: ["official", "klm", "unofficial", "private", "independent"],
      },
      {
        id: "voluntary",
        topic: "intro",
        q: "Do I have to use the app for XCM/XFA flights?",
        a: (
          <>
            No — use of this app is totally voluntary.
            <ul style={{ margin: "8px 0 0 18px" }}>
              <li>All previous listing methods (e.g. telephone listing) remain available in parallel.</li>
              <li>Using the app may involve storing / transmitting personal info (depending on what you choose to provide).</li>
              <li>If you have privacy concerns, please use the traditional methods.</li>
            </ul>
          </>
        ),
        keywords: ["voluntary", "optional", "do i have to"],
      },

      // ACCOUNT
      {
        id: "register",
        topic: "account",
        q: "Do I need to register to use the app?",
        a: (
          <>
            You can browse general flight information without being a verified member.
            <br />
            <br />
            For security reasons, member-only features (e.g. seeing flight commuter lists / requesting listings / personal features)
            require sign-in and verification.
          </>
        ),
        keywords: ["register", "sign in", "member", "guest"],
      },

      // NOTIFICATIONS
      {
        id: "notifications",
        topic: "notifications",
        q: "Notifications: email, push, SMS — what’s the situation?",
        a: (
          <>
            We use a variety of notification methods:
            <ul style={{ margin: "8px 0 0 18px" }}>
              <li>SMS will only be used for urgent private messaging.</li>
              <li>Push notifications and in-app messages are preferred.</li>
              <li>In-app messages remain the “always available” channel.</li>
            </ul>
            Tip: if you rely on notifications, please ensure your chosen notification method is enabled in the app.
          </>
        ),
        keywords: ["push", "sms", "email", "notifications", "ios", "android"],
      },

      // LOCKERS
      {
        id: "locker-setup",
        topic: "lockers",
        q: "Crew Lockers — how do I link my locker?",
        a: (
          <>
            Legacy flow (best-effort; update to your new “auto-link” flow when ready):
            <ol style={{ margin: "8px 0 0 18px" }}>
              <li>Home → My Crew Locker → Locker settings: ensure your email is correct (or submit it).</li>
              <li>Find your locker email (Keynius) or a locker-sharing email from a colleague and follow the linking instructions.</li>
              <li>If the app offers “find my locker”, use it after linking to display your locker(s).</li>
              <li>Use the keys icon to open the locker management screen.</li>
            </ol>
            If something looks stuck, capture screenshots and contact admin (see “Contact / Support”).
          </>
        ),
        keywords: ["locker", "crew locker", "keynius", "link", "share"],
      },

      // FLIGHTS
      {
        id: "search-flights",
        topic: "flights",
        q: "How do I search for flights?",
        a: (
          <>
            From Home, pick an airport (favourite). You’ll see a week-style overview showing arrivals and departures.
            Select a date and direction to open the flight list for that day.
          </>
        ),
        keywords: ["search", "week", "airport", "arrivals", "departures"],
      },

      // LISTING
      {
        id: "cutoff",
        topic: "listing",
        q: "Is there a cut-off time for requesting a listing?",
        a: (
          <>
            Yes.There are different cutoff times for flights from Amsterdam and Outstations:
            <ul style={{ margin: "8px 0 0 18px" }}>
              <li>Flights ex AMS: cut-off ~ 18:00 NL time day before departure.</li>
              <li>Outstations (Europe and Far East): cut-off ~ 18:30 NL time day before flight date.</li>
              <li>Outstations (USA, Canada and South America): cut-off ~ 22:00 NL time day before flight date.</li>			  
              <li>Warning: Requests after cut-off may still display in-app but will not be transmitted.</li>
            </ul>
          </>
        ),
        keywords: ["cutoff", "deadline", "18:00", "22:00", "6pm", "10pm"],
      },
      {
        id: "ams-process",
        topic: "listing",
        q: "Departing Amsterdam: what happens when I list via the app?",
        a: (
          <>
            Legacy model:
            <ul style={{ margin: "8px 0 0 18px" }}>
              <li>KLM Backoffice will create the listing and (where possible) also complete check-in.</li>
              <li>You will typically receive confirmation via in-app message and / or your configured notification channel.</li>
              <li>If you do not receive confirmation close to departure, use the official telephone option (see below).</li>
            </ul>
          </>
        ),
        keywords: ["ams", "schiphol", "back office", "process"],
      },
      {
        id: "listing-line",
        topic: "listing",
        q: "KLM Listing line (AMS) — what number do I call?",
        a: (
          <>
            KLM XCM/XFA listing number:
            <br />
            <br />
            <strong>+31 (0)20 649 4090</strong>
            <br />
            <br />
            Note: Option #2 (Boarding) is the correct option for XCM/XFA matters.
          </>
        ),
        keywords: ["telephone", "listing line", "number", "4090"],
      },

      // OUTSTATIONS
      {
        id: "outstations",
        topic: "outstations",
        q: "Does the app work for all outstations?",
        a: (
          <>
            No. Coverage is variable.
            <br />
            <br />
            Legacy explanation: some outstations act on the daily request and some do not, because the app is not an
            “official” KLM system. Treat it as helpful — not guaranteed — outside AMS.
          </>
        ),
        keywords: ["outstations", "coverage", "works everywhere", "not all airports"],
      },
      {
        id: "outstations-desk",
        topic: "outstations",
        q: "Departing outstations: what should I do at the check-in desk?",
        a: (
          <>
            First ask the agent to check if a listing exists. If they can’t find you, it usually means a listing/check-in
            must be created.
            <br />
            <br />
            If the agent is unfamiliar, use the “DIY Listing” guidance (below) to help them create it quickly.
          </>
        ),
        keywords: ["check in agent", "cant find", "outstation"],
      },

      // PASSPORT
      {
        id: "passport-needed",
        topic: "passport",
        q: "Do I have to store passport details in the app?",
        a: (
          <>
            It’s voluntary and at your own risk.
            <br />
            <br />
            Legacy rules (confirm current behaviour):
            <ul style={{ margin: "8px 0 0 18px" }}>
              <li>Outstations may not require stored passport details (passport swipe at airport still needed).</li>
              <li>For AMS, passport details are required for the app-based listing / check-in path.</li>
              <li>Passport data is encrypted at rest and only transmitted when needed.</li>
            </ul>
          </>
        ),
        keywords: ["passport", "personal data", "required", "ams"],
      },

      // DIY
      {
        id: "diy",
        topic: "troubleshooting",
        q: "DIY XCM/XFA listing — agent doesn’t know the process",
        a: (
          <>
            If a check-in agent is new/unsure, the quickest solution is to show them the step cards below.
            <br />
            <br />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                DIY_LISTING_SCANS.xcmxfa1,
                DIY_LISTING_SCANS.xcmxfa2,
                DIY_LISTING_SCANS.xcmxfa3,
                DIY_LISTING_SCANS.xcmxfa4,
                DIY_LISTING_SCANS.xcmxfa5,
              ].map((src, idx) => (
                <img
                  key={idx}
                  src={src}
                  alt={`DIY listing step ${idx + 1}`}
                  style={{
                    width: "100%",
                    borderRadius: 14,
                    border: "1px solid rgba(19,35,51,0.10)",
                  }}
                  loading="lazy"
                />
              ))}
            </div>
          </>
        ),
        keywords: ["diy", "agent", "steps", "instructions", "english", "french"],
      },

      // TROUBLESHOOTING
      {
        id: "no-countdown",
        topic: "troubleshooting",
        q: "Why is the countdown missing sometimes?",
        a: (
          <>
            Countdown uses UTC time and is phase dependent:
            <ul style={{ margin: "8px 0 0 18px" }}>
              <li>Countdown only shows closer to departure (3 hours before STD).</li>
            </ul>
          </>
        ),
        keywords: ["countdown", "missing", "timer", "std_utc"],
      },

      // CONTACT
      {
        id: "bug-report",
        topic: "troubleshooting",
        q: "Give feedback / report a bug",
        a: (
          <>
            Send an email to <strong>admin@xcmxfa.com</strong>.
            <br />
            <br />
            Please include:
            <ul style={{ margin: "8px 0 0 18px" }}>
              <li>What you tried to do</li>
              <li>What you expected</li>
              <li>What happened instead</li>
              <li>Screenshots (very helpful)</li>
            </ul>
          </>
        ),
        keywords: ["bug", "feedback", "admin", "support"],
      },
      {
        id: "contact-admin",
        topic: "account",
        q: "Contact app admin",
        a: (
          <>
            Primary: <strong>admin@xcmxfa.com</strong>
            <br />
            <br />
            Secondary: olu.ayoola@klm.com
          </>
        ),
        keywords: ["contact", "admin"],
      },

      // LEGAL
      {
        id: "privacy",
        topic: "legal",
        q: "Privacy / cookies / GDPR",
        a: (
          <>
            Privacy and cookie information exists to explain what data is stored, why, and how it’s protected.
            <br />
            <br />
            Next improvement (future): add direct in-app links to your Privacy and Cookie pages/PDF.
          </>
        ),
        keywords: ["privacy", "cookie", "gdpr"],
      },
      {
        id: "disclaimer",
        topic: "legal",
        q: "Disclaimer",
        a: (
          <>
            Information is provided in good faith for general purposes. Operational reality can vary by airport,
            staff, and systems. Use at your own risk and validate time-critical information via official channels.
          </>
        ),
        keywords: ["disclaimer", "liability"],
      },
    ],
    []
  );

  const topics: Topic[] = useMemo(
    () => [
      "intro",
      "account",
      "flights",
      "listing",
      "outstations",
      "passport",
      "notifications",
      "lockers",
      "troubleshooting",
      "legal",
    ],
    []
  );

  const [query, setQuery] = useState("");
  const [activeTopic, setActiveTopic] = useState<Topic | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = normalizeText(query);

    return items.filter((it) => {
      if (activeTopic !== "all" && it.topic !== activeTopic) return false;
      if (!q) return true;

      const hay = [it.q, ...(it.keywords || []), topicLabel(it.topic)]
        .map(normalizeText)
        .join(" | ");

      return hay.includes(q);
    });
  }, [items, query, activeTopic]);

  return (
    <div className="app-screen">
      {/* ✅ Week-style sticky junction wrapper */}
      <div className="week-sticky">
        <div className="app-container">
          {/* ✅ Reuse the exact Week header card class so we inherit the same bleed fix */}
          <section className="week-headerCard">
            {/* Match Week top row layout */}
            <div className="week-headerTopRow">
              <div className="week-headerLeft">
                {/* FAQ has no airport logo; keep spacing identical */}
                <div
                  aria-hidden="true"
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: "rgba(19,35,51,0.06)",
                    border: "1px solid rgba(19,35,51,0.08)",
                  }}
                />
              </div>

              <div className="week-headerCode">FAQ</div>

              <div className="week-headerRight">
                <BackButton
                  onClick={() => nav(-1)}
                  ariaLabel="Back"
                  size={38}
                />
              </div>
            </div>

            {/* Use Week's secondary line slot for a short subtitle */}
            <div className="week-range">Info, rules, and troubleshooting</div>
          </section>
        </div>
      </div>

      {/* Body uses Week’s body container so spacing matches */}
      <div className="app-container week-body" style={{ paddingBottom: 20 }}>
        {/* Search + topic pills */}
        <section className="card" style={{ padding: 14 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search FAQ… (e.g. passport, cutoff, locker, outstation)"
            style={{
              width: "100%",
              padding: "12px 12px",
              borderRadius: 14,
              border: "2px solid rgba(19,35,51,0.10)",
              outline: "none",
              fontWeight: 800,
              color: "#132333",
            }}
          />

          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill label="All" active={activeTopic === "all"} onClick={() => setActiveTopic("all")} />
            {topics.map((t) => (
              <Pill
                key={t}
                label={topicLabel(t)}
                active={activeTopic === t}
                onClick={() => setActiveTopic(t)}
              />
            ))}
          </div>

          <div style={{ marginTop: 10, fontWeight: 800, color: "rgba(19,35,51,0.60)" }}>
            {filtered.length} item{filtered.length === 1 ? "" : "s"}
          </div>
        </section>

        {/* Quick filters */}
        <section className="card" style={{ padding: 14, marginTop: 12 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { t: "troubleshooting" as const, title: "Troubleshooting", sub: "Common fixes" },
              { t: "listing" as const, title: "Listing & cutoffs", sub: "AMS vs outstations" },
              { t: "lockers" as const, title: "Crew Lockers", sub: "Link / share" },
            ].map((x) => (
              <button
                key={x.t}
                type="button"
                onClick={() => setActiveTopic(x.t)}
                style={{
                  flex: "1 1 160px",
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid rgba(19,35,51,0.10)",
                  background: "#fff",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 950 }}>{x.title}</div>
                <div style={{ fontWeight: 800, fontSize: 12, color: "rgba(19,35,51,0.55)", marginTop: 2 }}>
                  {x.sub}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* FAQ list */}
        <section className="card" style={{ marginTop: 12 }}>
          <div style={{ padding: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map((it) => (
                <FaqRow
                  key={it.id}
                  item={it}
                  open={openId === it.id}
                  onToggle={() => setOpenId((prev) => (prev === it.id ? null : it.id))}
                />
              ))}
            </div>

            <div style={{ marginTop: 14, fontWeight: 800, fontSize: 14, color: "rgba(19,35,51,0.55)" }}>
              Note: Some content is “best-effort” and may lag policy changes. For time-critical items, validate via official channels.
            </div>
          </div>
        </section>

        {/* Support CTA */}
        <section className="card" style={{ padding: 14, marginTop: 12, fontSize:14 }}>
          <div style={{ fontWeight: 950, color: "#132333" }}>Need help?</div>
          <div style={{ marginTop: 6, fontWeight: 800, color: "rgba(19,35,51,0.65)" }}>
            Email <strong>admin@xcmxfa.com</strong> with a short description and screenshots.
          </div>
        </section>
      </div>
    </div>
  );
}