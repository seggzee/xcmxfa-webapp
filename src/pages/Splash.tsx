import React from "react";
import { Link } from "react-router-dom";

/**
 * Idiot-guide:
 * This is the guest splash page.
 * RN has no real splash, but you wanted a "/" guest entry.
 * This page has NO auth and NO API calls.
 */
export default function Splash() {
  return (
    <div style={{ padding: 24 }}>
      <h1>XCMXFA</h1>
      <p>Crew web app</p>
      <p>
        <Link to="/home">Continue as guest</Link>
      </p>
      <p>
        <Link to="/login">Login</Link>
      </p>
    </div>
  );
}
