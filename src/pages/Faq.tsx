// FILE: src/pages/Faq.tsx
//
// =====================================================================================
// FAQ / Info — grouped card navigation + accordion content
// Week-style sticky header junction (bleed-safe)
// =====================================================================================
//
// IDIOT GUIDE:
// - This page is intentionally "dumb": no API calls, no auth requirements.
// - Uses the SAME sticky header junction pattern as Week (week-sticky + app-container + header card).
// - Back control uses the standard BackButton component.
// - Search sits at the top.
// - Group navigation uses a fixed 2 x 5 mini-card grid.
// - Accordion defaults to "All" and narrows when a group card is selected.
//
// NOTES:
// - DIY scans come from assets: DIY_LISTING_SCANS.xcmxfa1..xcmxfa5
// - Search only matches question text + keywords + group label.
// =====================================================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { DIY_LISTING_SCANS, UI_ICONS } from "../assets";
import BackButton from "../components/BackButton";

type Group =
  | "all"
  | "flights"
  | "lockers"
  | "listing"
  | "account"
  | "passport"
  | "notifications"
  | "privacy"
  | "amsterdam"
  | "outstations";

type FaqItem = {
  id: string;
  group: Exclude<Group, "all">;
  q: string;
  a: React.ReactNode;
  keywords?: string[];
};

type GroupCardDef = {
  key: Group;
  label: string;
  iconSrc: string;
};

function normalizeText(v: any) {
  return String(v || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function groupLabel(g: Group) {
  switch (g) {
    case "all":
      return "All";
    case "flights":
      return "Flights";
    case "lockers":
      return "Lockers";
    case "listing":
      return "Listing";
    case "account":
      return "Account";
    case "passport":
      return "Passport";
    case "notifications":
      return "Notifications";
    case "privacy":
      return "Privacy";
    case "amsterdam":
      return "Amsterdam";
    case "outstations":
      return "Outstations";
    default:
      return String(g);
  }
}

function FaqAnswer({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        color: "rgba(19,35,51,0.72)",
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 1.45,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {children}
    </div>
  );
}

function GroupCard(props: {
  iconSrc: string;
  title: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const { iconSrc, title, count, active, onClick } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 76,
        padding: 12,
        borderRadius: 14,
        border: active ? "1px solid rgba(19,35,51,0.18)" : "1px solid rgba(19,35,51,0.10)",
        background: active ? "rgba(19,35,51,0.04)" : "#fff",
        textAlign: "left",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
		boxSizing: "border-box",
		minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          minWidth: 0,
          flex: 1,
        }}
      >
        <img
          src={iconSrc}
          alt=""
          style={{
            width: 34,
            height: 34,
            objectFit: "contain",
            display: "block",
            flex: "0 0 auto",
          }}
        />

        <div
          style={{
            fontWeight: 700,
            fontSize: 14,
            lineHeight: 1.2,
            color: "#2f80ed",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
      </div>

      <div
        style={{
          flex: "0 0 auto",
          fontWeight: 700,
          fontSize: 13,
          lineHeight: 1,
          color: "rgba(19,35,51,0.55)",
          whiteSpace: "nowrap",
        }}
      >
        ({count})
      </div>
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
        <div style={{ fontSize: 14, fontWeight: 600, color: "#2f80ed", lineHeight: 1.3 }}>
          {item.q}
        </div>

        <div
          aria-hidden="true"
          style={{
            width: 26,
            height: 26,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid rgba(19,35,51,0.12)",
            fontSize: 14,
            fontWeight: 700,
            color: "rgba(19,35,51,0.55)",
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
  const listRef = useRef<HTMLDivElement | null>(null);

  const items: FaqItem[] = useMemo(
    () => [
      {
        id: "unofficial",
        group: "privacy",
        q: "Is this an official KLM app?",
        a: (
          <FaqAnswer>
            <p>
              No. This is a privately developed app used by kind agreement of some outstations
              to help them plan for XCM/XFA travel and reduce day-of-travel friction.
            </p>
            <p>
              There is no direct link from this app to airline booking systems or KLM IT
              infrastructure.
            </p>
          </FaqAnswer>
        ),
        keywords: ["official", "klm", "unofficial", "private", "independent"],
      },
      {
        id: "voluntary",
        group: "privacy",
        q: "Do I have to use the app for XCM/XFA flights?",
        a: (
          <FaqAnswer>
            <p>No. Use of this app is totally voluntary.</p>
            <ul style={{ margin: "0 0 0 18px" }}>
              <li>All previous listing methods, including telephone listing, remain available in parallel.</li>
              <li>
                Using the app may involve storing or transmitting personal information, depending on what you
                choose to provide.
              </li>
              <li>If you have privacy concerns, use the traditional methods instead.</li>
            </ul>
          </FaqAnswer>
        ),
        keywords: ["voluntary", "optional", "do i have to"],
      },
      {
        id: "register",
        group: "account",
        q: "Do I need to register to use the app?",
        a: (
          <FaqAnswer>
            <p>You can browse general flight information without being a verified member.</p>
            <p>
              For security reasons, member-only features such as seeing commuter lists, requesting listings,
              and using personal features require sign-in and verification.
            </p>
          </FaqAnswer>
        ),
        keywords: ["register", "sign in", "member", "guest"],
      },
      {
        id: "notifications",
        group: "notifications",
        q: "Notifications: email and push — what’s the situation?",
        a: (
          <FaqAnswer>
            <p>We use more than one notification method, but in-app messages remain the most reliable channel.</p>
            <ul style={{ margin: "0 0 0 18px" }}>
              <li>Push notifications are preferred when enabled on your device.</li>
              <li>Email may be used where appropriate.</li>
              <li>In-app messages remain the always-available fallback.</li>
            </ul>
            <p>
              If you rely on notifications, make sure your chosen method is enabled in the app and in your
              browser or device settings.
            </p>
          </FaqAnswer>
        ),
        keywords: ["push", "email", "notifications", "ios", "android"],
      },
      {
        id: "locker-setup",
        group: "lockers",
        q: "Crew Lockers — how do I link my locker?",
        a: (
          <FaqAnswer>
            <p>Legacy flow, best effort:</p>
            <ol style={{ margin: "0 0 0 18px" }}>
              <li>Home → My Crew Locker → Locker settings. Check that your email is correct, or submit it if needed.</li>
              <li>
                Find your locker email from Keynius, or use a locker-sharing email from a colleague, then follow
                the linking instructions.
              </li>
              <li>If the app offers “find my locker”, use it after linking to display your locker or lockers.</li>
              <li>Use the keys icon to open the locker management screen.</li>
            </ol>
            <p>If something looks stuck, capture screenshots and contact admin.</p>
          </FaqAnswer>
        ),
        keywords: ["locker", "crew locker", "keynius", "link", "share"],
      },
      {
        id: "search-flights",
        group: "flights",
        q: "How do I search for flights?",
        a: (
          <FaqAnswer>
            <p>From Home, pick an airport favourite. You’ll then see a week-style overview showing arrivals and departures.</p>
            <p>Select a date and direction to open the flight list for that day.</p>
          </FaqAnswer>
        ),
        keywords: ["search", "week", "airport", "arrivals", "departures"],
      },
      {
        id: "cutoff",
        group: "listing",
        q: "Is there a cut-off time for requesting a listing?",
        a: (
          <FaqAnswer>
            <p>Yes. Different departure regions have different cut-off times.</p>
            <ul style={{ margin: "0 0 0 18px" }}>
              <li>Flights ex AMS: around 18:00 NL time on the day before departure.</li>
              <li>Outstations in Europe and Far East: around 18:30 NL time on the day before the flight date.</li>
              <li>Outstations in USA, Canada and South America: around 22:00 NL time on the day before the flight date.</li>
              <li>Requests after cut-off may still appear in the app but will not be transmitted.</li>
            </ul>
          </FaqAnswer>
        ),
        keywords: ["cutoff", "deadline", "18:00", "22:00", "6pm", "10pm"],
      },
      {
        id: "ams-process",
        group: "amsterdam",
        q: "Departing Amsterdam: what happens when I list via the app?",
        a: (
          <FaqAnswer>
            <p>Legacy model:</p>
            <ul style={{ margin: "0 0 0 18px" }}>
              <li>KLM Backoffice creates the listing and, where possible, also completes check-in.</li>
              <li>You will usually receive confirmation by in-app message and or your configured notification channel.</li>
              <li>If you do not receive confirmation close to departure, use the official telephone option.</li>
            </ul>
          </FaqAnswer>
        ),
        keywords: ["ams", "schiphol", "back office", "process"],
      },
      {
        id: "listing-line",
        group: "amsterdam",
        q: "KLM Listing line (AMS) — what number do I call?",
        a: (
          <FaqAnswer>
            <p>KLM XCM/XFA listing number:</p>
            <p>+31 (0)20 649 4090</p>
            <p>Option 2, Boarding, is the correct option for XCM/XFA matters.</p>
          </FaqAnswer>
        ),
        keywords: ["telephone", "listing line", "number", "4090"],
      },
      {
        id: "outstations",
        group: "outstations",
        q: "Does the app work for all outstations?",
        a: (
          <FaqAnswer>
            <p>No. Coverage is variable.</p>
            <p>
              Some outstations act on the daily request and some do not, because the app is not an official KLM
              system. Treat it as helpful, not guaranteed, outside AMS.
            </p>
          </FaqAnswer>
        ),
        keywords: ["outstations", "coverage", "works everywhere", "not all airports"],
      },
      {
        id: "outstations-desk",
        group: "outstations",
        q: "Departing outstations: what should I do at the check-in desk?",
        a: (
          <FaqAnswer>
            <p>First ask the agent to check whether a listing already exists.</p>
            <p>If they can’t find you, it usually means a listing or check-in must still be created.</p>
            <p>If the agent is unfamiliar, use the DIY Listing guidance below to help them create it quickly.</p>
          </FaqAnswer>
        ),
        keywords: ["check in agent", "cant find", "outstation"],
      },
      {
        id: "passport-needed",
        group: "passport",
        q: "Do I have to store passport details in the app?",
        a: (
          <FaqAnswer>
            <p>It is voluntary and at your own risk.</p>
            <ul style={{ margin: "0 0 0 18px" }}>
              <li>Outstations may not require stored passport details, although passport swipe at the airport may still be needed.</li>
              <li>For AMS, passport details are required for the app-based listing and check-in path.</li>
              <li>Passport data is encrypted at rest and only transmitted when needed.</li>
            </ul>
          </FaqAnswer>
        ),
        keywords: ["passport", "personal data", "required", "ams"],
      },
      {
        id: "diy",
        group: "listing",
        q: "DIY XCM/XFA listing — agent doesn’t know the process",
        a: (
          <FaqAnswer>
            <p>If a check-in agent is new or unsure, the quickest solution is to show them the step cards below.</p>
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
          </FaqAnswer>
        ),
        keywords: ["diy", "agent", "steps", "instructions", "english", "french"],
      },
      {
        id: "no-countdown",
        group: "flights",
        q: "Why is the countdown missing sometimes?",
        a: (
          <FaqAnswer>
            <p>Countdown uses UTC time and is phase dependent.</p>
            <ul style={{ margin: "0 0 0 18px" }}>
              <li>Countdown only shows closer to departure, generally within three hours before STD.</li>
            </ul>
          </FaqAnswer>
        ),
        keywords: ["countdown", "missing", "timer", "std_utc"],
      },
      {
        id: "bug-report",
        group: "account",
        q: "Give feedback / report a bug",
        a: (
          <FaqAnswer>
            <p>Send an email to admin@xcmxfa.com.</p>
            <p>Please include:</p>
            <ul style={{ margin: "0 0 0 18px" }}>
              <li>What you tried to do</li>
              <li>What you expected</li>
              <li>What happened instead</li>
              <li>Screenshots, which are very helpful</li>
            </ul>
          </FaqAnswer>
        ),
        keywords: ["bug", "feedback", "admin", "support"],
      },
      {
        id: "contact-admin",
        group: "account",
        q: "Contact app admin",
        a: (
          <FaqAnswer>
            <p>Primary: admin@xcmxfa.com</p>
            <p>Secondary: olu.ayoola@klm.com</p>
          </FaqAnswer>
        ),
        keywords: ["contact", "admin"],
      },
      {
        id: "privacy",
        group: "privacy",
        q: "Privacy / cookies / GDPR",
        a: (
          <FaqAnswer>
            <p>Privacy and cookie information explains what data is stored, why it is stored, and how it is protected.</p>
            <p>A later improvement can add direct in-app links to your Privacy and Cookie pages or PDF.</p>
          </FaqAnswer>
        ),
        keywords: ["privacy", "cookie", "gdpr"],
      },
      {
        id: "disclaimer",
        group: "privacy",
        q: "Disclaimer",
        a: (
          <FaqAnswer>
            <p>Information is provided in good faith for general purposes.</p>
            <p>
              Operational reality can vary by airport, staff and systems. Use at your own risk and validate
              time-critical information via official channels.
            </p>
          </FaqAnswer>
        ),
        keywords: ["disclaimer", "liability"],
      },
    ],
    []
  );

  const groupCards: GroupCardDef[] = useMemo(
    () => [
      { key: "all", label: "All", iconSrc: UI_ICONS.faq },
      { key: "flights", label: "Flights", iconSrc: UI_ICONS.departures },
      { key: "lockers", label: "Lockers", iconSrc: UI_ICONS.locker },
      { key: "listing", label: "Listing", iconSrc: UI_ICONS.calendar },
      { key: "account", label: "Account", iconSrc: UI_ICONS.avatar },
      { key: "passport", label: "Passport", iconSrc: UI_ICONS.locked },
      { key: "notifications", label: "Notifications", iconSrc: UI_ICONS.message },
      { key: "privacy", label: "Privacy", iconSrc: UI_ICONS.locked },
      { key: "amsterdam", label: "Amsterdam", iconSrc: UI_ICONS.arrivals },
      { key: "outstations", label: "Outstations", iconSrc: UI_ICONS.departures },
    ],
    []
  );

  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<Group>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const out: Record<Group, number> = {
      all: items.length,
      flights: 0,
      lockers: 0,
      listing: 0,
      account: 0,
      passport: 0,
      notifications: 0,
      privacy: 0,
      amsterdam: 0,
      outstations: 0,
    };

    items.forEach((it) => {
      out[it.group] += 1;
    });

    return out;
  }, [items]);

  const filtered = useMemo(() => {
    const q = normalizeText(query);

    return items.filter((it) => {
      if (activeGroup !== "all" && it.group !== activeGroup) return false;
      if (!q) return true;

      const hay = [it.q, ...(it.keywords || []), groupLabel(it.group)]
        .map(normalizeText)
        .join(" | ");

      return hay.includes(q);
    });
  }, [items, query, activeGroup]);
  
  

  const didMountRef = useRef(false);

useEffect(() => {
  if (!didMountRef.current) {
    didMountRef.current = true;
    return;
  }

  if (!listRef.current) return;
  listRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
}, [activeGroup]);
  
  
  

  useEffect(() => {
    if (!openId) return;
    const stillVisible = filtered.some((it) => it.id === openId);
    if (!stillVisible) setOpenId(null);
  }, [filtered, openId]);

 

  return (
    <div className="app-screen">
      <div className="week-sticky">
        <div className="app-container">
          <section className="week-headerCard">
            <div className="week-headerTopRow">
              <div className="week-headerLeft">
                <img
                  src={UI_ICONS.faq}
                  alt="FAQ"
                  style={{
                    width: 52,
                    height: 52,
                    objectFit: "contain",
                    borderRadius: 14,
                  }}
                />
              </div>

              <div className="week-headerCode">FAQ</div>

              <div className="week-headerRight">
                <BackButton onClick={() => nav(-1)} ariaLabel="Back" size={38} />
              </div>
            </div>

            <div className="week-range">Info, rules, and troubleshooting</div>
          </section>
        </div>
      </div>

      <div className="app-container week-body" style={{ paddingBottom: 20 }}>
        <section className="card" style={{ padding: 14 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search FAQ… (e.g. passport, cutoff, locker, outstation)"
            style={{
              width: "100%",
              padding: "10px 10px",
              borderRadius: 14,
              border: "2px solid rgba(19,35,51,0.10)",
              outline: "none",
              fontWeight: 600,
              fontSize: 16,
              color: "#132333",
            }}
          />
        </section>

        <section className="card" style={{ padding: 14, marginTop: 12 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
			  alignItems: "stretch",
            }}
          >
            {groupCards.map((card) => (
              <GroupCard
                key={card.key}
                iconSrc={card.iconSrc}
                title={card.label}
                count={counts[card.key]}
                active={activeGroup === card.key}
                onClick={() => {
                  setActiveGroup((prev) => (prev === card.key ? "all" : card.key));
                }}
              />
            ))}
          </div>
        </section>

        <section ref={listRef} className="card" style={{ marginTop: 12, scrollMarginTop: "220px" }}>
          <div style={{ padding: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map((it) => (
                <FaqRow
                  key={it.id}
                  item={it}
                  open={openId === it.id}
                  onToggle={() => setOpenId((prev) => (prev === it.id ? null : it.id))}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}