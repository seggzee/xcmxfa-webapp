// src/pages/Contact.tsx
//
// PURPOSE:
// - Contact page for support email and contact form
//
// THIS CHANGE ONLY:
// - Move page onto reusable StickyPageHeaderCard pattern
// - Use page-specific Contact CSS instead of ad-hoc inline styling
// - Wire quick cards
// - Wire send button to /api/contact/create.php
// - Show success modal after submission
// - Stay on Contact page after success acknowledgement
// - Keep consistent app page structure and styling

import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import StickyPageHeaderCard from "../components/StickyPageHeaderCard";
import { API_BASE_URL, postJson } from "../app/api";
import { useAuth } from "../app/authStore";
import { useCrew } from "../app/crewStore";

import "../styles/contact.css";

const CONTACT_CREATE_URL = `${API_BASE_URL}/api/contact/create.php`;

function safeStr(v: any) {
  return String(v || "").trim();
}

export default function Contact() {
  const nav = useNavigate();
  const formRef = useRef<HTMLDivElement | null>(null);

  const { auth } = useAuth();
  const { crew } = useCrew();

  const psn = useMemo(() => {
    return String(auth?.user?.username || crew?.psn || "")
      .trim()
      .toUpperCase();
  }, [auth?.user?.username, crew?.psn]);

  const initialEmail = useMemo(() => {
    return safeStr((crew as any)?.email || (auth as any)?.user?.email || "");
  }, [crew, auth]);

  const [category, setCategory] = useState("General question");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(initialEmail);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successVisible, setSuccessVisible] = useState(false);

  function focusForm(nextCategory: string) {
    setCategory(nextCategory);
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function resetForm() {
    setCategory("General question");
    setSubject("");
    setMessage("");
    setEmail(initialEmail);
    setError("");
  }

  function validate(): string {
    if (!safeStr(category)) return "Please select a category.";
    if (!safeStr(subject)) return "Please enter a subject.";
    if (!safeStr(message)) return "Please enter a message.";
    if (!safeStr(email)) return "Please enter an email address.";

    const emailCheck = safeStr(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCheck)) {
      return "Please enter a valid email address.";
    }

    return "";
  }

  async function handleSubmit() {
    if (busy) return;

    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    try {
      setBusy(true);
      setError("");

      const payload = {
        category: safeStr(category),
        subject: safeStr(subject),
        message: safeStr(message),
        email: safeStr(email),
        psn: safeStr(psn),
      };

      await postJson(CONTACT_CREATE_URL, payload);
      setSuccessVisible(true);
    } catch (e: any) {
      setError(e?.message || "Send failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-screen contact-page">
      <StickyPageHeaderCard
        title="Contact us"
        onBack={() => nav(-1)}
        backAriaLabel="Back"
      />

      <div className="app-container contact-body">
        <section className="card">
          <div className="contact-sectionTitle">Get help</div>

          <div className="contact-quickGrid">
            <button
              type="button"
              className="contact-quickTile"
              onClick={() => focusForm("General question")}
            >
              <div className="contact-quickTileTitle">General support</div>
              <div className="contact-quickTileSub">
                Questions about listings, profile, lockers
              </div>
            </button>

            <button
              type="button"
              className="contact-quickTile"
              onClick={() => focusForm("Bug report")}
            >
              <div className="contact-quickTileTitle">Report a bug</div>
              <div className="contact-quickTileSub">
                Something not working as expected
              </div>
            </button>

            <button
              type="button"
              className="contact-quickTile"
              onClick={() => focusForm("Privacy / data")}
            >
              <div className="contact-quickTileTitle">Privacy / data</div>
              <div className="contact-quickTileSub">
                Questions about stored personal data
              </div>
            </button>

            <button
              type="button"
              className="contact-quickTile"
              onClick={() => {
                window.location.href = "mailto:admin@xcmxfa.com";
              }}
            >
              <div className="contact-quickTileTitle">Email support</div>
              <div className="contact-quickTileSub">admin@xcmxfa.com</div>
            </button>
          </div>
        </section>

        <section className="card contact-formCard">
          <input
            value=""
            readOnly
            aria-hidden="true"
            tabIndex={-1}
            className="contact-hiddenField"
          />

          <div ref={formRef} className="contact-sectionTitle">
            Send a message
          </div>

          <div className="contact-helpText">
            For faster help, include flight number, airport, date, and screenshots if relevant.
          </div>

          <div className="contact-field">
            <div className="contact-fieldLabel">Category</div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={busy}
              className="contact-input"
            >
              <option>General question</option>
              <option>Bug report</option>
              <option>Listing issue</option>
              <option>Locker issue</option>
              <option>Profile / account</option>
              <option>Privacy / data</option>
              <option>Feedback / suggestion</option>
            </select>
          </div>

          <div className="contact-field">
            <div className="contact-fieldLabel">Subject</div>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="contact-input"
              placeholder="Short summary"
              disabled={busy}
            />
          </div>

          <div className="contact-field">
            <div className="contact-fieldLabel">Message</div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="contact-input contact-textarea"
              placeholder="Describe your issue or question"
              disabled={busy}
            />
          </div>

          <div className="contact-field">
            <div className="contact-fieldLabel">Email</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="contact-input"
              placeholder="your@email.com"
              disabled={busy}
            />
          </div>

          {error ? <div className="contact-error">{error}</div> : null}

          <button
            type="button"
            className="contact-submitBtn"
            onClick={handleSubmit}
            disabled={busy}
          >
            {busy ? "Sending..." : "Send message"}
          </button>
        </section>

        {successVisible ? (
          <div
            className="contact-modalOverlay"
            onClick={() => {
              setSuccessVisible(false);
              resetForm();
            }}
          >
            <div
              className="contact-modalCard"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="contact-modalTitle">Message sent</div>
              <div className="contact-modalBody">
                Your message has been received and will be reviewed as soon as possible.
              </div>

              <button
                type="button"
                className="contact-modalBtn"
                onClick={() => {
                  setSuccessVisible(false);
                  resetForm();
                }}
              >
                OK
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}