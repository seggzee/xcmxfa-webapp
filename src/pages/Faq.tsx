// FILE: src/pages/Faq.tsx
//
// =====================================================================================
// FAQ / Info — grouped card navigation + accordion content
// Uses reusable StickyPageHeaderCard component
// =====================================================================================
//
// IDIOT GUIDE:
// - This page is intentionally "dumb": no API calls, no auth requirements.
// - Uses the reusable StickyPageHeaderCard component.
// - Back control uses the standard BackButton via the shared header component.
// - Search sits at the top.
// - Group navigation uses a fixed 2 x 5 mini-card grid.
// - Accordion defaults to "All" and narrows when a group card is selected.
//
// THIS CHANGE ONLY:
// - Remove the activeGroup useEffect-driven auto-scroll because it was causing
//   unwanted initial page movement.
// - Scroll to the FAQ list ONLY after the user taps a category card.
//
// NOTES:
// - DIY scans come from assets: DIY_LISTING_SCANS.xcmxfa1..xcmxfa5
// - Search only matches question text + keywords + group label.
// =====================================================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { DIY_LISTING_SCANS, UI_ICONS } from "../assets";
import StickyPageHeaderCard from "../components/StickyPageHeaderCard";

type Group =
  | "all"
  | "legal" 
  | "bugs"  
  | "flights"
  | "lockers"
  | "listing"
  | "account"
  | "acceptance"
  | "alerts"
  | "airports"
  | "general";

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
    case "acceptance":
      return "Acceptance";
    case "alerts":
      return "Alerts";
    case "legal":
      return "Legal";
    case "bugs":
      return "Bugs";	  
    case "airports":
      return "Airports";
    case "general":
      return "General";
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
  const location = useLocation();
  const listRef = useRef<HTMLDivElement | null>(null);

  const handleBack = () => {
    const faqState = location.state as any;
    const returnTo = faqState?.faqReturnTo;
    const pathname = String(returnTo?.pathname || "").trim();

    if (!pathname || !pathname.startsWith("/") || pathname === "/faq") {
      nav("/home", { replace: true });
      return;
    }

    nav(
      {
        pathname,
        search: String(returnTo?.search || ""),
        hash: String(returnTo?.hash || ""),
      },
      {
        replace: true,
        state: returnTo?.state ?? null,
      }
    );
  };


  const items: FaqItem[] = useMemo(
    () => [
	
	
//************* LEGAL SECTION ***********************************

      {
        id: "transparency",
        group: "legal",
        q: "Transparency",
        a: (
          <FaqAnswer>
            <p>This is not an official KLM app! Your privacy and the security of your personal information is important to us!</p>
          </FaqAnswer>
        ),
        keywords: ["privacy", "official", "security", "personal"],
      },
	  
      {
        id: "disclaimer",
        group: "legal",
        q: "Disclaimer",
        a: (
		
          <FaqAnswer>
            <p>Information is provided in good faith for general purposes.</p>

			<p>Any action you take upon our information is strictly at your own risk and we will not be liable for any losses and damages in connection with it’s use.</p>
			
            <p>Operational reality can vary by airport, staff and systems. Use at your own risk and validate time-critical information via official channels.</p>
			
			<p>All the information on this website (or contained within our downloads) has been published and prepared in good faith and is for general information purposes only. We do not make any warranties about the completeness, reliability and accuracy of this information.</p>  
					 
			<p>From our website, you can visit other websites by following hyperlinks to these sites. While we strive to provide only links to useful and ethical websites, we have no control over the content and nature of these sites and the links to other websites do not imply a recommendation for all the content found on these sites.</p>
				
			<p>Please be also aware that when you leave our website, other sites may have different privacy policies and terms which are beyond our control.</p>			
			
          </FaqAnswer>
        ),
        keywords: ["disclaimer", "liability", "purposes"],
      },	
	
      {
        id: "privacy",
        group: "legal",
        q: "Privacy policy & GDPR",
        a: (
          <FaqAnswer>
            <p>Our privacy policy information explains what data is stored, why it is stored, and how it is protected.</p>
            <p>Please refer to our 'Privacy and Cookies' PDF for futher information</p>
          </FaqAnswer>
        ),
        keywords: ["privacy", "cookie", "gdpr"],
      },
	  
      {
        id: "cookies",
        group: "legal",
        q: "Cookies policy & GDPR",
        a: (
          <FaqAnswer>
            <p>Our cookie policy information explains what data is stored, why it is stored, and how it is protected.</p>
            <p>Please refer to our 'Privacy and Cookies' PDF for futher information</p>
          </FaqAnswer>
        ),
        keywords: ["privacy", "cookie", "gdpr"],
      },

      {
        id: "gdpr",
        group: "legal",
        q: "GDPR Compliance",
        a: (
          <FaqAnswer>
            <p><b>GDPR Compliance - </b>Read about how the GDPR regulations protect your personal information and how this site complies with the regulations in our downloadable document.</p>
            <p>The detailed document titled 'XCMXFA Privacy and Cookie Notice' can be downloaded <b><i><a href="legal/XCM-privacy-and-cookie-notice.pdf">here</a></i></b></p>			 
          </FaqAnswer>
        ),
        keywords: ["privacy", "cookie", "gdpr"],
      },	  
	  	    

//************* ACCOUNT SECTION ***********************************
	  
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

	  
//************* NOTIFICATIONS SECTION ***********************************
	  
      {
        id: "notifications",
        group: "alerts",
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

	  
//************* LOCKERS SECTION ***********************************
	  
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

	  
//************* FLIGHTS SECTION ***********************************
	  
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

	  
//************* LISTINGS SECTION ***********************************
	  
      {
        id: "rules",
        group: "listing",
        q: "What are the listing rules?",
        a: (
          <FaqAnswer>
            <p>There are a number of rules built into the listing process. Listing for KLM and Transavia are treated as separate processes.</p>
            <ul style={{ margin: "0 0 0 18px" }}>
              <li>Listing request must be received before station cutoff time</li>
			  <li>Only one active listing from same airport / same day / same airline</li>
			  <li>Previous duty MUST be specified if departing from AMS </li>
			  <li>Your passport details MUST be stored in the App if departing from AMS </li>			  
			  <li>If travelling to Canada / UK (non British passport holder) / USA your ESTA or FX information section of the app must be completed</li>	
			  <li>Maximum 3 active (pending, sent or confirmed) listings per user</li>					  
            </ul>
          </FaqAnswer>
        ),
        keywords: ["cutoff", "deadline", "listing", "18:00", "22:00", "18:30", "16:30"],
      },
	  
      {
        id: "numbers",
        group: "listing",
        q: "How many flights can I list for?",
        a: (
          <FaqAnswer>
            <p>On the app, you may only be listed on a maximum of 3 flights (per booking process) at any one time.</p>
			<p>Listing for KLM and Transavia are counted as separate processes.</p>
            <ul style={{ margin: "0 0 0 18px" }}>
				<li>If you already have 3 listed flights and wish to make changes, you will need to delete at least one of your exisiting listings</li>
				<li>ALL airports will not accept if you make more than 1 listing for travel in the same direction on the same day on the same carrier</li>	  
            </ul>
          </FaqAnswer>
        ),
        keywords: ["maximum", "flights", "listing", "how many"],
      },
	  
      {
        id: "priority",
        group: "listing",
        q: "How is listing priority determined?",
        a: (
          <FaqAnswer>
		  
            <p>KLM flights listing applies a priority order as specified in union agreements:</p>
            <ul style={{ margin: "0 0 0 18px" }}>
				<li>1. KLM / KLC XCM</li>
				<li>2. KLM /KLC  XFA</li>
				<li>3. HV XCM</li>
				<li>4. HV XFA</li>								
            </ul>
			
			<p>Currently there is no specific notified priority ordering on Transavia flights</p>
            <ul style={{ margin: "0 0 0 18px" }}>
				<li>HV flights: first come, first served only based on time of request</li>				
            </ul>
			
          </FaqAnswer>
        ),
        keywords: ["priority", "union", "listing", "XCM", "XFA"],
      },	  
	  
      {
        id: "cutoff",
        group: "listing",
        q: "Is there a cut-off time for requesting a listing?",
        a: (
          <FaqAnswer>
            <p>Yes. Different departure airports have different cut-off times.</p>
			<p>Clicking on the information icon on each airport card will reveal that airports exact cut off time. The following are rough guides only:</p>
            <ul style={{ margin: "0 0 0 18px" }}>
              <li>Flights ex AMS: 18:00 NL time on the day before departure.</li>
              <li>Outstations in Europe: approximately 18:00 NL time on the day before the flight date.</li>
			  <li>Outstations in Far East: around 16:30 NL time on the day before the flight date.</li>
              <li>Outstations in USA, Canada and South America: around 22:00 NL time on the day before the flight date.</li>
            </ul>
          </FaqAnswer>
        ),
        keywords: ["cutoff", "deadline", "listing", "18:00", "22:00", "18:30", "16:30"],
      },	  
  
      {
        id: "ams-process",
        group: "listing",
        q: "Departing Amsterdam: what happens after I list via the app?",
        a: (
          <FaqAnswer>
            <p>The listing and acceptance process from Amsterdam is fully automated in the app, subject to the listing rules.</p>
            <ul style={{ margin: "0 0 0 18px" }}>
              <li>KLM Backoffice creates the listing and, where possible, also completes check-in for the flight.</li>
              <li>You will usually receive confirmation by in-app message and or your configured notification channel (eg push notification).</li>		  
              <li>The confirmation will be in the form of a 'check-in security number", but in future may transition to a mobile boarding pass.</li>
              <li>The flight status icon of the app will also indicate the changed status of the listing request</li>				  
              <li>If you do not receive confirmation by 2 hours to flight departure, use the official telephone option to verify checked-in status.</li>
            </ul>
          </FaqAnswer>
        ),
        keywords: ["ams", "schiphol", "back office", "process", "check-in", "security number", "push", "notification"],
      },
	  
      {
        id: "listing-line",
        group: "listing",
        q: "KLM Listing line (AMS) — what number do I call?",
        a: (
          <FaqAnswer>
			<p>The number below is ONLY FOR KLM FLIGHTS DEPARTING FROM AMSTERDAM.</p>		  
            <p>KLM XCM/XFA listing number:</p>
            <p>+31 (0)20 649 4090</p>
            <p>Option 2, Boarding, is the correct option for XCM/XFA matters.</p>
          </FaqAnswer>
        ),
        keywords: ["telephone", "listing line", "number", "4090"],
      },
	  
      {
        id: "outstations-process",
        group: "listing",
        q: "Departing Outstations: what happens after I list via the app?",
        a: (
          <FaqAnswer>
            <p>The listing and acceptance process from outstations is NOT YET fully automated in the app, unlike Amsterdam.</p>
			<p>Some stations provide acknowledgement of the listing request, whilst others silently accept the request.</p>
			<p>The generic process for all outstations is nevertheless as follows:</p>			
            <ul style={{ margin: "0 0 0 18px" }}>
              <li>KLM Station Management and / or contracted ground handling company receives the listing request</li>
              <li>KLM Station Management and / or contracted ground handling company acknowledges the listing request</li>			  
              <li>You will usually receive confirmation by in-app message and or your configured notification channel (eg push notification), that your request has been received and acknowledged by the station.</li>
              <li>There will be no 'check-in security number". Primarily because passport details are NOT transmitted to outstations (except LCY, and ICA stations) and station is therefore unable to complete check in.</li>
              <li>The flight status icon of the app will also indicate the changed status of the listing request</li>				  
              <li>If you do not receive confirmation by 2 hours to flight departure, be prepared to follow the local manual process at the airport. Allow extra time for delays in processing.</li>
            </ul>
          </FaqAnswer>
        ),
        keywords: ["ams", "schiphol", "back office", "process", "check-in", "security number", "push", "notification"],
      },
	  
      {
        id: "diy",
        group: "listing",
        q: "DIY XCM/XFA listing — Outstation agent doesn’t know the process",
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

	  
//************* AIRPORTS SECTION ***********************************	

  
      {
        id: "outstations",
        group: "airports",
        q: "Does the app work for all outstations?",
        a: (
          <FaqAnswer>
            <p>No. Coverage is variable.</p>
            <p>
              Some outstations act on the daily request and some do not, because the app is not an official KLM
              system. Treat it as helpful, not guaranteed, outside AMS. Please report stations where difficulties are encountered to admin@xcmxfa.com
            </p>
          </FaqAnswer>
        ),
        keywords: ["outstations", "coverage", "works everywhere", "not all airports"],
      },
	  
      {
        id: "amsterdam-desk",
        group: "airports",
        q: "Departing Amsterdam: what should I do at the check-in desk?",
        a: (
          <FaqAnswer>
            <p>When you request a listing via the app for flights departing amsterdam, KLM Passage Back Office create the listing, and at the same time, check you in for the flight.</p>
			<p> You will receive confirmation that this has been done, via notification of your check in security number via email, app message or push notification</p>
			<p>You do not need to contact the Back office at any stage of this process (unless you have not received a security number one hour before your flight departs)</p>
			<p>If you have confirmation of your listing, you may proceed directly to the gate where your boarding pass will be issued.</p>
          </FaqAnswer>
        ),
        keywords: ["Amsterdam", "Passage Back Office", "date", "confirmation"],
      },
	  
      {
        id: "outstations-desk",
        group: "airports",
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


//************* GENERAL SECTION ***********************************		  


      {
        id: "unofficial",
        group: "general",
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
        group: "general",
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
        id: "passport-needed",
        group: "general",
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

//************* ACCEPTANCE SECTION ***********************************	



//************* BUGS SECTION ***********************************	

      {
        id: "bug-report",
        group: "bugs",
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
	  
	  
    ],
    []
  );

  const groupCards: GroupCardDef[] = useMemo(
    () => [
	
      { key: "all", label: "All", iconSrc: UI_ICONS.faq },
	  
      { key: "legal", label: "Legal", iconSrc: UI_ICONS.locked },
	  
      { key: "general", label: "General", iconSrc: UI_ICONS.departures },

      { key: "account", label: "Account", iconSrc: UI_ICONS.avatar },	  
	  
      { key: "flights", label: "Flights", iconSrc: UI_ICONS.departures },
	  	  
      { key: "listing", label: "Listing", iconSrc: UI_ICONS.calendar },
	  
      { key: "alerts", label: "Alerts", iconSrc: UI_ICONS.message },
	  
      { key: "airports", label: "Airport", iconSrc: UI_ICONS.arrivals },	  
	  
      { key: "acceptance", label: "Acceptance", iconSrc: UI_ICONS.locked },
	  	  
      { key: "lockers", label: "Lockers", iconSrc: UI_ICONS.locker },	  
	  
      { key: "bugs", label: "Bugs", iconSrc: UI_ICONS.locked },

    ],
    []
  );

  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<Group>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const out: Record<Group, number> = {
      all: items.length,
      legal: 0,	  
      flights: 0,
      lockers: 0,
      listing: 0,
      account: 0,
      acceptance: 0,
      alerts: 0,
      bugs: 0,
      airports: 0,
      general: 0,
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

  useEffect(() => {
    if (!openId) return;
    const stillVisible = filtered.some((it) => it.id === openId);
    if (!stillVisible) setOpenId(null);
  }, [filtered, openId]);

  function scrollToFaqListSoon() {
    window.setTimeout(() => {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  return (
    <div className="app-screen">
      <StickyPageHeaderCard
        leftContent={
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
        }
        title="FAQ"
        subtitle="Info, rules, and troubleshooting"
        onBack={handleBack}
        backAriaLabel="Back"
      />

      <div className="app-container" style={{ paddingTop: 0, paddingBottom: 20 }}>
	  
	  
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
                  scrollToFaqListSoon();
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