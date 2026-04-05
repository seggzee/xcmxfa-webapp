// src/pages/Legal.tsx
//
// PURPOSE:
// - Stub page for privacy policy, disclaimers, and related legal content
//
// THIS CHANGE ONLY:
// - Add page header (title + back button)
// - Place content centrally in a card
// - Keep existing text unchanged

import { useNavigate } from "react-router-dom";
import BackButton from "../components/BackButton";

export default function Legal() {
  const nav = useNavigate();

  return (
    <div className="app-screen">
      <div className="app-container">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div className="text-title">Legal</div>

          <BackButton onClick={() => nav(-1)} ariaLabel="Back" size={38} />
        </div>

        {/* Content card */}
        <div
          className="card"
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: 16,
          }}
        >
          <p style={{ margin: 0, lineHeight: 1.6, color: "#4b5563" }}>
            This page will contain the privacy policy, disclaimers, terms, and other
            legal information for the app.
          </p>
        </div>
      </div>
    </div>
  );
}