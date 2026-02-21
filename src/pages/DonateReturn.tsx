// src/pages/DonateReturn.tsx
//
// =====================================================================================
// DONATE RETURN PAGE (UI ONLY)
// -------------------------------------------------------------------------------------
// This page is the browser landing page after Stripe redirects the user.
// It is NOT authoritative. The webhook is authoritative.
//
// What this page does:
// 1) Read session_id from URL
// 2) Ask backend for session status
// 3) Display friendly success / fallback UI
//
// IMPORTANT:
// Always use API_BASE_URL when calling PHP.
// Never call /stripe_php directly from Vite origin.
// =====================================================================================

import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { UI_ICONS } from "../assets";
import BackButton from "../components/BackButton";
import { API_BASE_URL } from "../app/api";

import "../styles/week.css";
import "../styles/donate.css"; // reuse donate header layout

export default function DonateReturn() {
  const nav = useNavigate();
  const [params] = useSearchParams();

  const donateIconSrc =
    (UI_ICONS as any)?.DONATE ||
    (UI_ICONS as any)?.donate ||
    null;

  // session_id provided by Stripe in return_url
  const sessionId = String(params.get("session_id") || "").trim();

  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        if (!sessionId) {
          setOk(false);
          setLoading(false);
          return;
        }

        // CRITICAL: Always call backend via API_BASE_URL
        const resp = await fetch(
          `${API_BASE_URL}/stripe_php/public/status.php?session_id=${encodeURIComponent(sessionId)}`
        );

        if (!resp.ok) {
          throw new Error(`Status check failed (${resp.status})`);
        }

        const data: any = await resp.json();

        const status = String(data?.status || "").toLowerCase();
        const customerEmail =
          String(data?.customer_email || data?.customerEmail || "").trim();

        if (!alive) return;

        setEmail(customerEmail);

        // Stripe session.status typically = "complete"
        // Some flows may return payment_status instead
        setOk(
          status === "complete" ||
          status === "paid" ||
          status === "succeeded"
        );

        setLoading(false);
      } catch {
        if (!alive) return;
        setOk(false);
        setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [sessionId]);

  return (
    <div className="app-screen">

      {/* =================================================================================
          Sticky header — EXACT same structural pattern as Donate.tsx
         ================================================================================= */}
      <div className="week-sticky">
        <div className="app-container">
          <section className="week-headerCard">
            <div className="week-headerTopRow donateHeaderRow">
              <div /> {/* left spacer */}

              <div className="donateHeaderCenter">
                {donateIconSrc ? (
                  <img
                    src={donateIconSrc}
                    alt="Donate"
                    style={{ height: 64, width: "auto", objectFit: "contain" }}
                  />
                ) : (
                  <div style={{ fontWeight: 900 }}>Donate</div>
                )}
              </div>

              <div className="donateHeaderRight">
                <BackButton
                  onClick={() => nav("/")}
                  ariaLabel="Home"
                  size={38}
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* =================================================================================
          Body
         ================================================================================= */}
      <div className="app-container week-body">
        <section className="card" style={{ padding: 14 }}>

          {loading ? (
            <div style={{ fontWeight: 900, color: "rgba(19,35,51,0.75)" }}>
              Checking payment…
            </div>
          ) : ok ? (
            <>
              <div style={{ fontWeight: 950, color: "#132333" }}>
                Thank you for donating!
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontWeight: 800,
                  color: "rgba(19,35,51,0.70)"
                }}
              >
                {email ? (
                  <>
                    A confirmation email has been sent to <b>{email}</b>.
                  </>
                ) : (
                  <>Your payment was successful.</>
                )}
              </div>

              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: 14 }}
                onClick={() => nav("/")}
              >
                Back to Home
              </button>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 950, color: "#132333" }}>
                Oops — something went wrong
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontWeight: 800,
                  color: "rgba(19,35,51,0.70)"
                }}
              >
                Your donation did not complete, or we couldn’t confirm it.
                Please try again.
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 14,
                  flexWrap: "wrap"
                }}
              >
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => nav("/donate")}
                >
                  Try again
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => nav("/")}
                >
                  Cancel
                </button>
              </div>
            </>
          )}

        </section>
      </div>
    </div>
  );
}