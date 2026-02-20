// src/pages/Faq.tsx
//
// =====================================================================================
// FAQ / Info — legacy content modernised (best effort, editable)
// =====================================================================================
//
// IDIOT GUIDE:
// - This page is intentionally "dumb": no API calls, no auth requirements.
// - It's a safety valve: reduces support noise and explains how things work.
// - Keep answers short, specific, and practical.
// - Content is best-effort and may lag reality: you (human) will revise it.
//
// Notes:
// - We incorporate legacy FAQ themes: unofficial app, voluntary usage, outstations variability,
//   cutoffs, passport details, notifications, lockers, DIY listing help, contacts, legal.
// - No new CSS required: uses existing "card" patterns and inline styles for the accordion.
//

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { DIY_LISTING_SCANS } from "../assets";

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
        <div style={{ fontWeight: 950, color: "#132333", lineHeight: 1.25 }}>
          {item.q}
        </div>

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
            fontWeight: 750,
            lineHeight: 1.35,
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
      // =================================================================================
      // INTRO / TRANSPARENCY
      // =================================================================================
      {
        id: "unofficial",
        topic: "intro",
        q: "Is this an official KLM app?",
        a: (
          <>
            No. This is a privately developed app used by kind agreement of some airports/teams to
            help them plan for XCM/XFA travel and reduce day-of-travel friction.
            <br />
            <br />
            There is no direct link from this app to airline booking systems or KLM IT infrastructure.
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
            No — use is voluntary.
            <ul style={{ margin: "8px 0 0 18px" }}>
              <li>All previous methods (e.g. telephone listing) remain available in parallel.</li>
              <li>
                Using the app may involve storing/transmitting personal info (depending on what you
                choose to provide).
              </li>
              <li>If you have privacy concerns, use the traditional methods.</li>
            </ul>
          </>
        ),
        keywords: ["voluntary", "optional", "do i have to"],
      },

      // =================================================================================
      // ACCOUNT / ACCESS
      // =================================================================================
      {
        id: "register",
        topic: "account",
        q: "Do I need to register to use the app?",
        a: (
          <>
            You can browse general flight information without being a verified member.
            <br />
            <br />
            For security reasons, member-only features (e.g. seeing crew lists / requesting listings /
            personal features) require sign-in and verification.
          </>
        ),
        keywords: ["register", "sign in", "member", "guest"],
      },

      // =================================================================================
      // NOTIFICATIONS (legacy + modern)
      // =================================================================================
      {
        id: "notifications",
        topic: "notifications",
        q: "Notifications: email, push, SMS — what’s the situation?",
        a: (
          <>
            Best-effort summary (edit as reality evolves):
            <ul style={{ margin: "8px 0 0 18px" }}>
              <li>SMS should be reserved for urgent messaging.</li>
              <li>Push notifications may be platform-dependent.</li>
              <li>
                In-app messages remain the “always available” channel (and are designed to be
                reliable even when push is not).
              </li>
            </ul>
            Tip: if you rely on notifications, ensure your chosen notification method is enabled in the app.
          </>
        ),
        keywords: ["push", "sms", "email", "notifications", "ios", "android"],
      },

      // =================================================================================
      // LOCKERS (legacy steps; you will edit to new flow later)
      // =================================================================================
      {
        id: "locker-setup",
        topic: "lockers",
        q: "Crew Lockers — how do I link my locker?",
        a: (
          <>
            Legacy flow (best-effort; update to your new “auto-link” flow when ready):
            <ol style={{ margin: "8px 0 0 18px" }}>
              <li>
                Home → My Crew Locker → Locker settings: ensure your email is correct (or submit it).
              </li>
              <li>
                Find your locker email (Keynius) or a locker-sharing email from a colleague and follow
                the linking instructions.
              </li>
              <li>
                If the app offers “find my locker”, use it after linking to display your locker(s).
              </li>
              <li>Use the keys icon to open the locker management screen.</li>
            </ol>
            If something looks stuck, capture screenshots and contact admin (see “Contact / Support”).
          </>
        ),
        keywords: ["locker", "crew locker", "keynius", "link", "share"],
      },

      // =================================================================================
      // FLIGHTS (searching / next flight)
      // =================================================================================
      {
        id: "search-flights",
        topic: "flights",
        q: "How do I search for flights?",
        a: (
          <>
            From Home, pick an airport (favourite). You’ll see a week-style overview showing arrivals
            and departures. Select a date and direction to open the flight list for that day.
          </>
        ),
        keywords: ["search", "week", "airport", "arrivals", "departures"],
      },

      // =================================================================================
      // LISTING / ACCEPTANCE (legacy operational content)
      // =================================================================================
      {
        id: "cutoff",
        topic: "listing",
        q: "Is there a cut-off time for requesting a listing?",
        a: (
          <>
            Legacy policy (confirm current rules before relying on it):
            <ul style={{ margin: "8px 0 0 18px" }}>
              <li>Flights ex AMS: cut-off ~ 18:00 NL time day before departure.</li>
              <li>Outstations: cut-off ~ 22:00 NL time day before flight date.</li>
              <li>Requests after cut-off may still display in-app but may not be transmitted.</li>
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
              <li>Schiphol teams may create the listing and (where applicable) progress check-in.</li>
              <li>
                You typically receive confirmation via in-app message and/or your configured notification channel.
              </li>
              <li>
                If you do not receive confirmation close to departure, use the official telephone option (below).
              </li>
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
            Legacy number:
            <br />
            <br />
            <strong>+31 (0)20 649 4090</strong>
            <br />
            <br />
            Legacy note: Option #2 (Boarding) was the correct option for XCM/XFA matters.
            <br />
            <br />
            (Confirm current options before relying on this.)
          </>
        ),
        keywords: ["telephone", "listing line", "number", "4090"],
      },

      // =================================================================================
      // OUTSTATIONS / VARIABILITY
      // =================================================================================
      {
        id: "outstations",
        topic: "outstations",
        q: "Does the app work for all outstations?",
        a: (
          <>
            No. Coverage is variable.
            <br />
            <br />
            Legacy explanation: some outstations act on the daily request and some do not, because the app
            is not an “official” KLM system. Treat it as helpful — not guaranteed — outside AMS.
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
            First ask the agent to check if a listing exists. If they can’t find you, it doesn’t necessarily
            mean you can’t travel — it usually means a listing/check-in must be created.
            <br />
            <br />
            If the agent is unfamiliar, use the “DIY Listing” guidance (below) to help them create it quickly.
          </>
        ),
        keywords: ["check in agent", "cant find", "outstation"],
      },

      // =================================================================================
      // PASSPORT DETAILS (legacy + disclaimer)
      // =================================================================================
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
              <li>
                For AMS, passport details historically were required for the app-based listing/check-in path.
                If you don’t store them, you may need to use the telephone method instead.
              </li>
              <li>Passport data should be encrypted at rest and only transmitted when needed.</li>
            </ul>
          </>
        ),
        keywords: ["passport", "personal data", "required", "ams"],
      },

      // =================================================================================
      // DIY LISTING (legacy “5 easy steps” concept — we can later add images/resources)
      // =================================================================================
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

      // =================================================================================
      // TROUBLESHOOTING
      // =================================================================================
      {
        id: "no-countdown",
        topic: "troubleshooting",
        q: "Why is the countdown missing sometimes?",
        a: (
          <>
            Countdown uses canonical UTC truth:
            <ul style={{ margin: "8px 0 0 18px" }}>
              <li>If STD UTC data is missing/invalid → we do no guessing → countdown stays hidden.</li>
              <li>Countdown only shows closer to departure (phases near STD).</li>
            </ul>
          </>
        ),
        keywords: ["countdown", "missing", "timer", "std_utc"],
      },

      // =================================================================================
      // CONTACT / SUPPORT
      // =================================================================================
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
            Legacy secondary contact existed historically — keep or remove based on your current preference.
          </>
        ),
        keywords: ["contact", "admin"],
      },

      // =================================================================================
      // LEGAL (light pointers; you can link to your actual pages later)
      // =================================================================================
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
    () => ["intro", "account", "flights", "listing", "outstations", "passport", "notifications", "lockers", "troubleshooting", "legal"],
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

      const hay = [
        it.q,
        typeof it.a === "string" ? it.a : "",
        ...(it.keywords || []),
        topicLabel(it.topic),
      ]
        .map(normalizeText)
        .join(" | ");

      return hay.includes(q);
    });
  }, [items, query, activeTopic]);

  return (
    <div className="homeScreen">
      <div className="homeInner">
        <section className="card">
          <div className="sectionTitleRow">
            <div className="sectionTitle">FAQ & Info</div>

            <button
              type="button"
              className="infoDot"
              onClick={() => nav(-1)}
              aria-label="Back"
              title="Back"
            >
              ←
            </button>
          </div>

          <div className="card-body" style={{ paddingTop: 0 }}>
            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
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

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

              <div style={{ marginTop: 6, fontWeight: 800, color: "rgba(19,35,51,0.60)" }}>
                {filtered.length} item{filtered.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>
        </section>

        {/* Optional “quick actions” row — safe, no dependency on routes you may not have */}
        <section className="card" style={{ padding: 14 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="quickTile"
              onClick={() => setActiveTopic("troubleshooting")}
              style={{ padding: 12 }}
            >
              <div style={{ fontWeight: 950 }}>Troubleshooting</div>
              <div style={{ fontWeight: 800, fontSize: 12, color: "rgba(19,35,51,0.55)", marginTop: 2 }}>
                Common fixes
              </div>
            </button>

            <button
              type="button"
              className="quickTile"
              onClick={() => setActiveTopic("listing")}
              style={{ padding: 12 }}
            >
              <div style={{ fontWeight: 950 }}>Listing & cutoffs</div>
              <div style={{ fontWeight: 800, fontSize: 12, color: "rgba(19,35,51,0.55)", marginTop: 2 }}>
                AMS vs outstations
              </div>
            </button>

            <button
              type="button"
              className="quickTile"
              onClick={() => setActiveTopic("lockers")}
              style={{ padding: 12 }}
            >
              <div style={{ fontWeight: 950 }}>Crew Lockers</div>
              <div style={{ fontWeight: 800, fontSize: 12, color: "rgba(19,35,51,0.55)", marginTop: 2 }}>
                Link / share
              </div>
            </button>
          </div>
        </section>

        <section className="card">
          <div className="card-body">
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

            {/* Footer note */}
            <div style={{ marginTop: 14, fontWeight: 800, fontSize: 12, color: "rgba(19,35,51,0.55)" }}>
              Note: Some content is “best-effort” and may lag policy changes. For time-critical items, validate via official channels.
            </div>
          </div>
        </section>

        {/* Support CTA */}
        <section className="card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 950, color: "#132333" }}>Need help?</div>
          <div style={{ marginTop: 6, fontWeight: 800, color: "rgba(19,35,51,0.65)" }}>
            Email <strong>admin@xcmxfa.com</strong> with a short description and screenshots.
          </div>
        </section>
      </div>
    </div>
  );
}