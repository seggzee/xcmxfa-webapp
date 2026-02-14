// src/pages/Profile.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { UI_ICONS } from "../assets";

export default function Profile() {
  const nav = useNavigate();

  return (
    <div className="app-screen profile-page">
      <div className="app-container">
        <div className="profile-top">
          <div className="text-title">My Profile</div>

          <button className="btn btn-secondary" onClick={() => nav(-1)}>
            Back
          </button>
        </div>

        <div className="card">
          <div className="profile-section-title">Personal information</div>

          <button className="profile-row" onClick={() => nav("/profile-wizard")}>
            <span>Name, work and contact details</span>
            <span className="profile-chevron">›</span>
          </button>
        </div>

        <div className="card">
          <div className="profile-section-title">Notification preferences</div>

          <div className="profile-row profile-row--disabled">
            <span>Email, PUSH and SMS</span>
            <span className="profile-chevron">›</span>
          </div>
        </div>

        <div className="card">
          <div className="profile-section-title">Travel documents</div>

          <button className="profile-row" onClick={() => nav("/passport")}>
            <span>Passport details</span>
            <img src={UI_ICONS.locked} alt="Locked" className="profile-lock" />
          </button>

          <button className="profile-row" onClick={() => nav("/esta")}>
            <span>ESTA / Residence permit details</span>
            <img src={UI_ICONS.locked} alt="Locked" className="profile-lock" />
          </button>
        </div>
      </div>
    </div>
  );
}
