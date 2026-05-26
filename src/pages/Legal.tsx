// src/pages/Legal.tsx
//
// PURPOSE:
// - Legal, privacy, cookie, disclaimer, and related information page
//
// THIS CHANGE ONLY:
// - Replace stub text with display-only Legal / Privacy / Cookies content
// - Add link to the full privacy and cookie notice PDF
// - Add explicit acceptance-by-use wording
// - Add Standby Rooms / third-party accommodation disclaimer
// - Do NOT add acceptance tracking, signing flow, or backend writes

import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import StickyPageHeaderCard from "../components/StickyPageHeaderCard";

import "../styles/legal.css";

const PRIVACY_NOTICE_URL =
  "https://apps-backend.xcmxfa.com/documents/public/XCM-privacy-and-cookie-notice.pdf";

type LegalSectionProps = {
  title: string;
  children: ReactNode;
};

function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      <div className="legal-sectionContent">{children}</div>
    </section>
  );
}

export default function Legal() {
  const nav = useNavigate();

  return (
    <div className="app-screen legal-page">
      <StickyPageHeaderCard
        title="Legal"
        onBack={() => nav(-1)}
        backAriaLabel="Back"
      />

      <div className="app-container legal-body">
        <div className="card legal-card">
          <div className="legal-hero">
            <p className="legal-eyebrow">XCM/XFA</p>

            <h1>Legal, Privacy &amp; Cookies</h1>

            <p className="legal-lede">
              This page summarises the key legal, privacy, cookie, and disclaimer
              information for the XCM/XFA app.
            </p>

            <div className="legal-actions">
              <a
                className="legal-button"
                href={PRIVACY_NOTICE_URL}
                target="_blank"
                rel="noreferrer"
              >
                Open full privacy &amp; cookie notice
              </a>
            </div>

            <p className="legal-small">
              This page is intended as a practical app notice. It is not a
              substitute for formal legal advice.
            </p>
          </div>

          <LegalSection title="Acceptance by use">
            <p>
              By accessing, browsing, registering for, or using XCM/XFA, you
              confirm that you have read and understood this Legal, Privacy &amp;
              Cookies notice and agree to the app terms, disclaimers, and use of
              essential cookies/browser storage required for the app to function.
            </p>

            <p>
              Where processing is required for app operation, flight listings,
              bookings, security, administration, support, reporting, or
              legal/audit purposes, XCM/XFA may process your data as described in
              this notice. Where separate consent is required, XCM/XFA will ask
              for it separately.
            </p>
          </LegalSection>

          <LegalSection title="Who operates XCM/XFA">
            <p>
              XCM/XFA is operated as a private commuter-support app for eligible
              users. For legal, privacy, or data questions, contact:
            </p>

            <p className="legal-contact">
              <a href="mailto:admin@xcmxfa.com">admin@xcmxfa.com</a>
            </p>
          </LegalSection>

          <LegalSection title="What data the app may collect">
            <p>
              Depending on which parts of the app you use, XCM/XFA may process:
            </p>

            <ul>
              <li>
                account and profile details, such as name, username or staff
                identifier, employer, role, base, preferences, and contact
                details;
              </li>
              <li>
                flight, listing, booking, check-in, travel history, operational,
                audit, and reporting records;
              </li>
              <li>
                passport, ESTA, or travel-document related information where this
                is provided or required for app workflows;
              </li>
              <li>
                contact form messages, support requests, admin messages, unread
                message records, and service notifications;
              </li>
              <li>
                device, session, push-notification, and remembered-device data
                needed for login, security, and notifications;
              </li>
              <li>
                donation/payment metadata where donations are made through Stripe;
              </li>
              <li>
                Standby Rooms advert submissions, including room/property
                information, contact details, images, consent confirmation,
                moderation notes, timestamps, submitter IP hash, and user agent.
              </li>
            </ul>
          </LegalSection>

          <LegalSection title="Why the app uses data">
            <p>XCM/XFA uses app data to:</p>

            <ul>
              <li>provide account access and app functionality;</li>
              <li>process flight listing, booking, check-in, and support tasks;</li>
              <li>show operational flight, listing, and travel information;</li>
              <li>send service, reminder, support, and operational messages;</li>
              <li>maintain security, admin records, audit trails, and reports;</li>
              <li>review, approve, reject, edit, moderate, or remove room adverts;</li>
              <li>support donations and related administration where applicable.</li>
            </ul>
          </LegalSection>

          <LegalSection title="Who data may be shared with">
            <p>
              XCM/XFA may share relevant information only where needed for app
              operation, support, security, or administration. This may include:
            </p>

            <ul>
              <li>authorised XCM/XFA admin or support users;</li>
              <li>
                airline, station, airport, or ground-handling contacts where
                needed for listing, booking, check-in, or support tasks;
              </li>
              <li>hosting, backend, email, push-notification, and service providers;</li>
              <li>Stripe where donations or payments are processed;</li>
              <li>
                room advertisers or third-party websites only where you choose to
                contact them or use their published contact/booking details.
              </li>
            </ul>

            <p>
              Once a request is handled by an airline, station, airport,
              ground-handler, advertiser, payment provider, or external website,
              that party may process data under its own rules and privacy terms.
            </p>
          </LegalSection>

          <LegalSection title="Standby Rooms and accommodation adverts">
            <p>
              Standby Rooms adverts are submitted by third parties or private
              advertisers. XCM/XFA does not automatically publish submitted
              adverts. Submissions are reviewed before publication.
            </p>

            <p>
              Approved adverts may display room/property details, contact details,
              website or booking links, prices, and uploaded images inside the app
              or related XCM/XFA pages.
            </p>

            <p>
              Submitters must have permission to submit the advert, contact
              details, links, and images. XCM/XFA may reject, edit, moderate, or
              remove adverts.
            </p>

            <p>
              XCM/XFA is not the landlord, hotel, booking agent, property manager,
              accommodation provider, or payment intermediary for third-party room
              adverts. Users must make their own checks and arrangements directly
              with the advertiser, owner, hotel, booking platform, or website.
            </p>

            <p>
              XCM/XFA does not guarantee room availability, accuracy, safety,
              quality, suitability, price, cancellation terms, payment outcome, or
              third-party website terms.
            </p>
          </LegalSection>

          <LegalSection title="Cookies, local storage and remembered device">
            <p>
              The app may use cookies, local storage, session storage, or similar
              browser/device storage for essential app functions, including login,
              session continuity, remembered device, security, preferences, and
              notifications.
            </p>

            <p>
              Blocking essential browser storage may prevent login or stop parts
              of the app from working correctly.
            </p>
          </LegalSection>

          <LegalSection title="Donations and Stripe">
            <p>
              Donations are processed through Stripe. XCM/XFA should not receive
              or store full card details. Stripe may process payment information
              under its own terms and privacy notice.
            </p>
          </LegalSection>

          <LegalSection title="Security">
            <p>
              XCM/XFA is designed to use restricted admin access, hashed passwords,
              HTTPS where served over XCM/XFA domains, and validation controls for
              submitted uploads.
            </p>

            <p>
              Standby Rooms uploaded files are restricted to permitted image types.
              Script-like uploads are blocked, generated filenames are used, and
              upload folders are configured to prevent script execution.
            </p>
          </LegalSection>

          <LegalSection title="Retention">
            <p>
              Records are kept only as long as needed for app operation, support,
              security, audit, reporting, legal, or administrative purposes, or
              until deletion/anonymisation is appropriate.
            </p>

            <p>
              Exact retention may differ by data type and operational requirement.
            </p>
          </LegalSection>

          <LegalSection title="Your rights and contact">
            <p>
              You may contact XCM/XFA to ask about access, correction, deletion,
              objection, or withdrawal of consent where applicable. Requests will
              be handled subject to operational, legal, security, and administrative
              requirements.
            </p>

            <p className="legal-contact">
              <a href="mailto:admin@xcmxfa.com">admin@xcmxfa.com</a>
            </p>
          </LegalSection>

          <LegalSection title="External websites and services">
            <p>
              XCM/XFA may link to third-party websites, booking pages, payment
              pages, airport/airline services, or advertiser websites. Those sites
              have their own terms, privacy notices, cookies, and security controls.
            </p>
          </LegalSection>

          <div className="legal-version">
            <p>Legal page version: 1.1</p>
            <p>Last updated: 20 May 2026</p>
          </div>
        </div>
      </div>
    </div>
  );
}