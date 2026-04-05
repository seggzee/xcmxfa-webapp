// src/pages/Contact.tsx
//
// PURPOSE:
// - Contact page for support email and contact form
//
// THIS CHANGE ONLY:
// - Wire quick cards
// - Wire send button to /api/contact/create.php
// - Show success modal after submission
// - Stay on Contact page after success acknowledgement
// - Keep Home-style visual language

import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import BackButton from "../components/BackButton";
import { API_BASE_URL, postJson } from "../app/api";
import { useAuth } from "../app/authStore";
import { useCrew } from "../app/crewStore";

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
    <div className="homeScreen">
      <div className="homeInner">
        <div className="profile-top" style={{ marginBottom: 16 }}>
          <div className="text-title">Contact us</div>
          <BackButton onClick={() => nav(-1)} ariaLabel="Back" size={38} />
        </div>

        <section className="card" style={{ padding: 16 }}>
          <div className="sectionTitle">Get help</div>

          <div className="quickGridRow">
            <button
              type="button"
              className="quickTile"
              onClick={() => focusForm("General question")}
            >
              <div className="quickTileTitle">General support</div>
              <div className="quickTileSub">Questions about listings, profile, lockers</div>
            </button>

            <button
              type="button"
              className="quickTile"
              onClick={() => focusForm("Bug report")}
            >
              <div className="quickTileTitle">Report a bug</div>
              <div className="quickTileSub">Something not working as expected</div>
            </button>
          </div>

          <div className="quickGridRow">
            <button
              type="button"
              className="quickTile"
              onClick={() => focusForm("Privacy / data")}
            >
              <div className="quickTileTitle">Privacy / data</div>
              <div className="quickTileSub">Questions about stored personal data</div>
            </button>

            <button
              type="button"
              className="quickTile"
              onClick={() => {
                window.location.href = "mailto:admin@xcmxfa.com";
              }}
            >
              <div className="quickTileTitle">Email support</div>
              <div className="quickTileSub">admin@xcmxfa.com</div>
            </button>
          </div>
        </section>

        <section className="card" style={{ padding: 16, marginTop: 18 }}>
          <input
            value={""}
            readOnly
            aria-hidden="true"
            tabIndex={-1}
            style={{ display: "none" }}
          />

          <div ref={formRef} className="sectionTitle">
            Send a message
          </div>

          <div
            style={{
              marginTop: 12,
              fontWeight: 700,
              fontSize: 12,
              color: "rgba(19,35,51,0.60)",
              lineHeight: 1.35,
            }}
          >
            For faster help, include flight number, airport, date, and screenshots if relevant.
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="sectionTitle" style={{ fontSize: 14 }}>
              Category
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={busy}
              className="wizard-input"
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

          <div style={{ marginTop: 14 }}>
            <div className="sectionTitle" style={{ fontSize: 14 }}>
              Subject
            </div>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="wizard-input"
              placeholder="Short summary"
              disabled={busy}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <div className="sectionTitle" style={{ fontSize: 14 }}>
              Message
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="wizard-input"
              style={{ minHeight: 120, resize: "vertical" }}
              placeholder="Describe your issue or question"
              disabled={busy}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <div className="sectionTitle" style={{ fontSize: 14 }}>
              Email
            </div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="wizard-input"
              placeholder="your@email.com"
              disabled={busy}
            />
          </div>

          {error ? <div className="wizard-error" style={{ marginTop: 12 }}>{error}</div> : null}

          <button
            type="button"
            className="modalBtn modalBtnPrimary"
            style={{ marginTop: 18, width: "100%" }}
            onClick={handleSubmit}
            disabled={busy}
          >
            {busy ? "Sending..." : "Send message"}
          </button>
        </section>

        {successVisible ? (
          <div
            className="modalOverlay"
            onClick={() => {
              setSuccessVisible(false);
              resetForm();
            }}
          >
            <div className="modalCard" onClick={(e) => e.stopPropagation()}>
              <div className="modalTitle">Message sent</div>
              <div className="modalBody">
                Your message has been received and will be reviewed as soon as possible.
              </div>

              <button
                type="button"
                className="modalBtn modalBtnPrimary"
                style={{ marginTop: 14, width: "100%" }}
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