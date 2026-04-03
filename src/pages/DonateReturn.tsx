// src/pages/DonateReturn.tsx
//
// =====================================================================================
// DONATE RETURN PAGE (UI ONLY)
// -------------------------------------------------------------------------------------
// IDIOT GUIDE:
// - Stripe redirects the USER'S BROWSER here after payment.
// - This page is NOT the system of record. Webhook is the system of record.
// - This page does ONE UI job:
//     1) read session_id from URL
//     2) ask backend for Stripe session status
//     3) show friendly success / fallback text
//
// IMPORTANT:
// - Always call backend via API_BASE_URL.
// - Never call /stripe_php directly from Vite/browser origin.
// - On some devices, Stripe returns into a browser page instead of the installed webapp.
//   So the wording must tell the user to close browser and return to the app.
// - The button should TRY to close the browser/tab.
// - If browser refuses, fall back to browser back navigation.
// =====================================================================================

import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { UI_ICONS } from "../assets";
import BackButton from "../components/BackButton";
import { API_BASE_URL } from "../app/api";

import "../styles/week.css";
import "../styles/donate.css";

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

  function handleCloseBrowser(): void {
    // Best-effort only:
    // - window.close() works only in some browser contexts
    // - if blocked, try browser history back
    window.close();

    window.setTimeout(() => {
      if (window.history.length > 1) {
        window.history.back();
      }
    }, 250);
  }

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        if (!sessionId) {
          setOk(false);
          setLoading(false);
          return;
        }

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

        // Stripe Checkout Session status typically = "complete"
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
          Sticky header — same structural pattern as Donate.tsx
         ================================================================================= */}
      <div className="week-sticky">
        <div className="app-container">
          <section className="week-headerCard">
            <div className="week-headerTopRow donateHeaderRow">
              <div />

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
                    <br /><br />
                    You can now close this browser page and return to the XCMXFA app.
                  </>
                ) : (
                  <>
                    Your payment was successful.
                    <br /><br />
                    You can now close this browser page and return to the XCMXFA app.
                  </>
                )}
              </div>

              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: 14 }}
                onClick={handleCloseBrowser}
              >
                Close Browser
              </button>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 950, color: "#132333" }}>
                Donation status unclear
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontWeight: 800,
                  color: "rgba(19,35,51,0.70)"
                }}
              >
                We could not confirm the donation on this page.
                <br /><br />
                Please close this browser page and return to the XCMXFA app.
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
                  onClick={handleCloseBrowser}
                >
                  Close Browser
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => nav("/donate")}
                >
                  Try again
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}