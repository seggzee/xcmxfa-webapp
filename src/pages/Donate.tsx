// src/pages/Donate.tsx
//
// =====================================================================================
// DONATE PAGE
// =====================================================================================
//
// PURPOSE
// - Host the embedded Stripe donation checkout.
// - Use the reusable StickyPageHeaderCard component so the back button remains visible.
//
// THIS CHANGE ONLY
// - Keep page-level top clearance under the global AppHeader
// - Add a page ref for the Donate page scroll container
// - After Stripe Embedded Checkout mounts, force the page back to top
//   because Stripe mount/focus can scroll the page downward on first load
// - Keep all other Stripe logic and page content unchanged
// =====================================================================================

import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { UI_ICONS } from "../assets";
import StickyPageHeaderCard from "../components/StickyPageHeaderCard";
import { API_BASE_URL } from "../app/api";

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
  const raw = await resp.text();

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

  // LOCKED:
  // - One Donate page instance must create at most one Embedded Checkout object.
  // - Keep a ref so re-renders / remount edge cases do not create duplicates.
  const checkoutRef = useRef<any>(null);
  const bootedRef = useRef(false);

  // THIS CHANGE ONLY:
  // - Track the Donate page scroll container so we can restore top position
  //   after Stripe mount/focus shifts the page down.
  const pageRef = useRef<HTMLDivElement | null>(null);

  function resetDonateScrollToTop() {
    try {
      pageRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch {
      // best-effort only
    }

    try {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch {
      // best-effort only
    }
  }

  useEffect(() => {
    let alive = true;

    async function boot() {
      setErrorText("");

      if (!publishableKey) {
        setLoadingText("");
        setErrorText("Missing Stripe publishable key (VITE_STRIPE_PUBLISHABLE_KEY).");
        return;
      }

      // Prevent duplicate initialisation
      if (bootedRef.current || checkoutRef.current) {
        return;
      }

      bootedRef.current = true;

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

        if (!alive) {
          try {
            checkout.destroy?.();
          } catch {}
          return;
        }

        const mountEl = document.getElementById("checkout");
        if (!mountEl) throw new Error("Missing #checkout mount element.");

        checkout.mount("#checkout");
        checkoutRef.current = checkout;

        // THIS CHANGE ONLY:
        // - Stripe Embedded Checkout can shift focus/scroll after mount.
        // - Force the Donate page back to the top on first load.
        window.setTimeout(() => {
          resetDonateScrollToTop();
        }, 0);

        window.setTimeout(() => {
          resetDonateScrollToTop();
        }, 100);

        setLoadingText("");
      } catch (e: any) {
        if (!alive) return;
        setLoadingText("");
        setErrorText(e?.message || "Failed to load donation form.");
        bootedRef.current = false;
      }
    }

    boot();

    return () => {
      alive = false;

      // Best-effort cleanup so returning to Donate does not leave an old instance hanging around
      if (checkoutRef.current) {
        try {
          checkoutRef.current.destroy?.();
        } catch {}
        checkoutRef.current = null;
      }

      bootedRef.current = false;
    };
  }, [publishableKey]);

  return (
    <div
      ref={pageRef}
      className="app-screen"
      /*style={{ paddingTop: "var(--appheader-height, 0px)" }}*/
    >
      <StickyPageHeaderCard
        centerContent={
          donateIconSrc ? (
            <img
              src={donateIconSrc}
              alt="Donate"
              style={{ height: 64, width: "auto", objectFit: "contain" }}
            />
          ) : (
            <div style={{ fontWeight: 900 }}>Donate</div>
          )
        }
        onBack={() => nav(-1)}
        backAriaLabel="Back"
      />

      <div className="app-container" style={{ paddingTop: 0, paddingBottom: 28 }}>
        <section className="card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 700, color: "#132333" }}>
            This webapp is community funded by donations from users.
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: 13,
              fontWeight: 600,
              color: "rgba(19,35,51,0.70)",
              lineHeight: 1.35,
            }}
          >
            Please donate to help cover the costs of website hosting, data storage,
            notifications, encryption, etc.
          </div>
        </section>

        <section className="card" style={{ padding: 14 }}>
          {loadingText ? (
            <div style={{ fontWeight: 700, color: "rgba(19,35,51,0.75)" }}>
              {loadingText}
            </div>
          ) : null}

          {errorText ? (
            <div style={{ fontWeight: 700, color: "rgba(220,38,38,0.95)" }}>
              {errorText}
            </div>
          ) : null}

          <div id="checkout" />
        </section>
      </div>
    </div>
  );
}