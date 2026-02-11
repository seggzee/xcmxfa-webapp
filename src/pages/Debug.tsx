import React from "react";
import { API_BASE_URL } from "../app/api";
import { STORAGE_PENDING_USERNAME } from "../app/storageKeys";
import { useAuth } from "../app/authStore";
import { useCrew } from "../app/crewStore";

export default function Debug() {
  const { auth, routeReason, onboardingUsername, loginReturnTo } = useAuth();
  const { crew } = useCrew();

  const pending = localStorage.getItem(STORAGE_PENDING_USERNAME);

  return (
    <div style={{ padding: 24, maxWidth: 820 }}>
      <h2>Debug</h2>

      <div style={{ marginTop: 12, padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
        <div><strong>API_BASE_URL:</strong> {API_BASE_URL}</div>
        <div><strong>Auth mode:</strong> {auth.mode}</div>
        <div><strong>Has accessToken:</strong> {auth.accessToken ? "YES" : "NO"}</div>
        <div><strong>routeReason:</strong> {String(routeReason || "")}</div>
        <div><strong>onboardingUsername:</strong> {String(onboardingUsername || "")}</div>
        <div><strong>pendingUsername (localStorage):</strong> {String(pending || "")}</div>
        <div><strong>loginReturnTo:</strong> {String(loginReturnTo || "")}</div>
      </div>

      <div style={{ marginTop: 12, padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
        <div style={{ fontWeight: 900 }}>crew cache snapshot</div>
        <pre style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
          {JSON.stringify(crew || null, null, 2)}
        </pre>
      </div>
    </div>
  );
}
