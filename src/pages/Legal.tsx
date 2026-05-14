// src/pages/Legal.tsx
//
// PURPOSE:
// - Stub page for privacy policy, disclaimers, and related legal content
//
// THIS CHANGE ONLY:
// - Move page onto reusable StickyPageHeaderCard pattern
// - Place content centrally in a card
// - Keep existing text unchanged
// - Remove ad-hoc inline layout styling

import { useNavigate } from "react-router-dom";
import StickyPageHeaderCard from "../components/StickyPageHeaderCard";

import "../styles/legal.css";

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
          <p className="legal-copy">
            This page will contain the privacy policy, disclaimers, terms, and other
            legal information for the app.
          </p>
        </div>
      </div>
    </div>
  );
}