// src/pages/Donate.tsx

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { UI_ICONS } from "../assets";
import BackButton from "../components/BackButton";
import { API_BASE_URL } from "../app/api";

import "../styles/week.css";
import "../styles/donate.css";

declare global {
  interface Window {
    Stripe?: any;
  }
}

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if ((existing as any)._loaded) return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
      return;
    }

    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.addEventListener("load", () => {
      (s as any)._loaded = true;
      resolve();
    });
    s.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
    document.head.appendChild(s);
  });
}

async function safeReadJson(resp: Response): Promise<any> {
  // Never call resp.json() directly. Read as text, then parse.
  const raw = await resp.text();

  // If server returned HTML / PHP fatal / nginx page, this prevents "Unexpected token F"
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    const preview = raw.slice(0, 180).replace(/\s+/g, " ").trim();
    throw new Error(`Server did not return JSON (HTTP ${resp.status}). Body: ${preview || "<empty>"}`);
  }
}

export default function Donate() {
  const nav = useNavigate();

  const donateIconSrc = (UI_ICONS as any)?.DONATE || (UI_ICONS as any)?.donate || null;

  const publishableKey = String((import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY || "").trim();

  const [loadingText, setLoadingText] = useState<string>("Loading payment form…");
  const [errorText, setErrorText] = useState<string>("");

  useEffect(() => {
    let alive = true;

    async function boot() {
      setErrorText("");

      if (!publishableKey) {
        setLoadingText("");
        setErrorText("Missing Stripe publishable key (VITE_STRIPE_PUBLISHABLE_KEY).");
        return;
      }

      try {
        setLoadingText("Loading payment form…");

        // 1) Load Stripe.js
        await loadScriptOnce("https://js.stripe.com/v3/");
        if (!alive) return;

        if (!window.Stripe) throw new Error("Stripe.js failed to initialise.");

        // 2) Create session via PHP (server-side)
        const url = `${API_BASE_URL}/stripe_php/public/checkout.php`;

        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // body optional; keep empty JSON so servers/proxies don't do weird things
          body: JSON.stringify({}),
        });

        const data = await safeReadJson(resp);

        if (!resp.ok) {
          const msg = String(data?.message || data?.error || "").trim();
          throw new Error(msg ? `Checkout init failed: ${msg}` : `Checkout init failed (${resp.status}).`);
        }

        const clientSecret = String(data?.clientSecret || "").trim();
        if (!clientSecret) throw new Error("Checkout init failed (missing clientSecret).");

        if (!alive) return;

        // 3) Mount embedded checkout
        const stripe = window.Stripe(publishableKey);
        const checkout = await stripe.initEmbeddedCheckout({ clientSecret });

        if (!alive) return;

        const mountEl = document.getElementById("checkout");
        if (!mountEl) throw new Error("Missing #checkout mount element.");

        checkout.mount("#checkout");
        setLoadingText("");
      } catch (e: any) {
        if (!alive) return;
        setLoadingText("");
        setErrorText(e?.message || "Failed to load donation form.");
      }
    }

    boot();
    return () => {
      alive = false;
    };
  }, [publishableKey]);

  return (
    <div className="app-screen">
      {/* Sticky header card junction same as Week */}
      <div className="week-sticky">
        <div className="app-container">
          <section className="week-headerCard">
            {/* Donate-only grid row */}
            <div className={`week-headerTopRow donateHeaderRow`}>
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
                <BackButton onClick={() => nav(-1)} ariaLabel="Back" size={38} />
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Body */}
      <div className="app-container week-body">
        <section className="card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 700, color: "#132333" }}>
            This webapp is community funded by donations from users.
          </div>
          <div style={{ marginTop: 18, fontSize: 13, fontWeight: 600, color: "rgba(19,35,51,0.70)", lineHeight: 1.35 }}>
            Please donate to help cover the costs of website hosting, data storage, notifications, encryption, etc.
          </div>
        </section>

        <section className="card" style={{ padding: 14 }}>
          {loadingText ? (
            <div style={{ fontWeight: 700, color: "rgba(19,35,51,0.75)" }}>{loadingText}</div>
          ) : null}

          {errorText ? (
            <div style={{ fontWeight: 700, color: "rgba(220,38,38,0.95)" }}>{errorText}</div>
          ) : null}

          <div id="checkout" />
        </section>
      </div>
    </div>
  );
}