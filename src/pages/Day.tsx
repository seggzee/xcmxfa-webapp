import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../app/authStore";

import AppHeader from "../components/AppHeader";
import FlightCard3x3 from "../components/FlightCard3x3";

/**
 * Day Details (RN parity layout)
 *
 * Current behavior:
 * - Reads :dateKey
 * - Back uses nav(-1)
 *
 * Next:
 * - Feed flights by Day API
 * - Render FlightCard3x3 per flight
 * - Populate Zones (crew list, listing controls, etc.)
 * - Zone 7 via Schiphol polling later
 */
export default function Day() {
	
	const { auth } = useAuth();
	const nav = useNavigate();
	const { dateKey } = useParams();

  // Tabs: Departures / Arrivals (RN)
  const [tab, setTab] = useState<"dep" | "arr">("dep");

  // Zone expand/collapse (member-only later; for now demo)
  const [openZones, setOpenZones] = useState<Record<string, boolean>>({
    crew: false,
    notes: false,
  });

  const title = useMemo(() => {
    if (!dateKey) return "Day";
    return dateKey;
  }, [dateKey]);

  // Placeholder header values (wire later)
  const airportCode = "AMS";
  const refreshedLabel = "Last refreshed 08:10";

  // Placeholder flights list (wire from Day API later)
  const flights = useMemo(
    () => [
      { id: "F1", flightNo: "KL123", route: "LHR → AMS" },
      { id: "F2", flightNo: "KL456", route: "AMS → BCN" },
    ],
    []
  );

  // ===== RN-like screen wrapper + styles (inline, per-page) =====
  const styles = {
    screen: {
      minHeight: "100vh",
      background: "#f6f7f9",
    } as React.CSSProperties,
    inner: {
      maxWidth: 520,
      margin: "0 auto",
      padding: 16,
    } as React.CSSProperties,

    // RN cards
    card: {
      background: "#fff",
      border: "2px solid #d9e2ee",
      borderRadius: 16,
      padding: 14,
      marginBottom: 14,
    } as React.CSSProperties,

    // Day header card
    dayHeaderCard: {
      background: "#fff",
      border: "2px solid #d9e2ee",
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
    } as React.CSSProperties,
    dayHeaderTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-end",
      gap: 12,
    } as React.CSSProperties,
    dayTitle: {
      fontWeight: 900,
      fontSize: 18,
      color: "#132333",
    } as React.CSSProperties,
    dayDate: {
      fontWeight: 900,
      fontSize: 14,
      color: "#b91c1c",
      whiteSpace: "nowrap",
    } as React.CSSProperties,
    dayMeta: {
      marginTop: 6,
      fontWeight: 800,
      fontSize: 12,
      color: "rgba(19,35,51,0.55)",
    } as React.CSSProperties,

    // Back pill (RN style)
    backRow: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
    } as React.CSSProperties,
    backPill: {
      padding: "8px 12px",
      borderRadius: 999,
      border: "2px solid #d6e3ff",
      background: "#e9f1ff",
      fontWeight: 900,
      cursor: "pointer",
      color: "#132333",
      whiteSpace: "nowrap",
    } as React.CSSProperties,
    backTitle: {
      fontWeight: 900,
      color: "#132333",
      fontSize: 16,
    } as React.CSSProperties,

    // Segmented control (Departures / Arrivals)
    segmented: {
      marginBottom: 12,
      background: "#fff",
      border: "2px solid #d9e2ee",
      borderRadius: 999,
      padding: 4,
      display: "flex",
      gap: 6,
    } as React.CSSProperties,
    segBtn: {
      flex: 1,
      height: 36,
      borderRadius: 999,
      border: 0,
      background: "transparent",
      fontWeight: 900,
      cursor: "pointer",
      color: "rgba(19,35,51,0.65)",
    } as React.CSSProperties,
    segBtnActive: {
      background: "#e9f1ff",
      color: "#132333",
    } as React.CSSProperties,

    // Flight blocks
    flightBlock: {
      marginBottom: 14,
    } as React.CSSProperties,
    flightHead: {
      background: "#fff",
      border: "2px solid #d9e2ee",
      borderRadius: 16,
      padding: 14,
    } as React.CSSProperties,
    flightHeadTitleRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      gap: 10,
      marginBottom: 10,
    } as React.CSSProperties,
    flightHeadTitle: {
      fontWeight: 900,
      color: "#132333",
    } as React.CSSProperties,
    flightHeadSub: {
      fontWeight: 800,
      fontSize: 12,
      color: "rgba(19,35,51,0.55)",
    } as React.CSSProperties,

    // Placeholder “FlightCard3x3 goes here”
    fcPlaceholder: {
      border: "1px dashed rgba(19,35,51,0.25)",
      borderRadius: 14,
      padding: 12,
      fontWeight: 900,
      color: "rgba(19,35,51,0.65)",
    } as React.CSSProperties,

    // Zones card (collapsible sections)
    zoneCard: {
      marginTop: 10,
      background: "#fff",
      border: "2px solid #d9e2ee",
      borderRadius: 16,
      overflow: "hidden",
    } as React.CSSProperties,
    zoneHeader: {
      width: "100%",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 14px",
      border: 0,
      background: "transparent",
      fontWeight: 900,
      color: "#132333",
      cursor: "pointer",
      textAlign: "left",
    } as React.CSSProperties,
    zoneIcon: {
      color: "rgba(19,35,51,0.65)",
      fontWeight: 900,
    } as React.CSSProperties,
    zoneBody: {
      padding: "12px 14px",
      borderTop: "1px solid rgba(19,35,51,0.08)",
      color: "rgba(19,35,51,0.75)",
      fontWeight: 800,
      fontSize: 13,
      lineHeight: "20px",
    } as React.CSSProperties,

    // Zone 7 card (ops)
    zone7Title: {
      fontWeight: 900,
      color: "#132333",
      marginBottom: 6,
    } as React.CSSProperties,
    zone7Body: {
      fontWeight: 800,
      color: "rgba(19,35,51,0.65)",
      lineHeight: "20px",
    } as React.CSSProperties,
  };

  function toggleZone(key: string) {
    setOpenZones((p) => ({ ...p, [key]: !p[key] }));
  }

  return (
    <div style={styles.screen}>
      <div style={styles.inner}>
	  


        {/* Back row (RN stack feel) */}
        <div style={styles.backRow}>
          <button type="button" onClick={() => nav(-1)} style={styles.backPill}>
            Back
          </button>
          <div style={styles.backTitle}>
            {airportCode} • {title}
          </div>
        </div>

        {/* Day header card */}
        <section style={styles.dayHeaderCard}>
          <div style={styles.dayHeaderTop}>
            <div style={styles.dayTitle}>{airportCode} daily view</div>
            <div style={styles.dayDate}>{title}</div>
          </div>
          <div style={styles.dayMeta}>{refreshedLabel}</div>
        </section>

        {/* Tabs */}
        <div style={styles.segmented}>
          <button
            type="button"
            style={{
              ...styles.segBtn,
              ...(tab === "dep" ? styles.segBtnActive : null),
            }}
            onClick={() => setTab("dep")}
          >
            Departures
          </button>
          <button
            type="button"
            style={{
              ...styles.segBtn,
              ...(tab === "arr" ? styles.segBtnActive : null),
            }}
            onClick={() => setTab("arr")}
          >
            Arrivals
          </button>
        </div>

        {/* Flight list */}
        <div>
          {flights.map((f) => (
            <article key={f.id} style={styles.flightBlock}>
              <section style={styles.flightHead}>
                <div style={styles.flightHeadTitleRow}>
                  <div style={styles.flightHeadTitle}>{f.flightNo}</div>
                  <div style={styles.flightHeadSub}>{f.route}</div>
                </div>

                {/* Zone 1: FlightCard3x3 */}
				<FlightCard3x3
				  showHeader={false}
				  flight={{
					flightNo: f.flightNo,
					dep: "AMS",
					dest: "LHR",
					opStatus: "SCHEDULED",
					depTime: "12:40",
					arrTime: "14:05",
					gate: "D6",
					aircraft: "738",
					registration: "PH-ABC",
					listPos: "1",
					listTotal: "9",
					listingStatus: "sent",
				  }}
				/>


                {/* Zones below (member-only later). For now: show collapsible placeholders */}
                <section style={styles.zoneCard}>
                  <button
                    type="button"
                    style={styles.zoneHeader}
                    onClick={() => toggleZone("crew")}
                  >
                    <span>Crew list</span>
                    <span style={styles.zoneIcon}>
                      {openZones.crew ? "−" : "+"}
                    </span>
                  </button>

                  {openZones.crew ? (
                    <div style={styles.zoneBody}>
                      Placeholder crew list rows (member-only later).
                    </div>
                  ) : null}
                </section>

                <section style={styles.zoneCard}>
                  <button
                    type="button"
                    style={styles.zoneHeader}
                    onClick={() => toggleZone("notes")}
                  >
                    <span>Notes / status</span>
                    <span style={styles.zoneIcon}>
                      {openZones.notes ? "−" : "+"}
                    </span>
                  </button>

                  {openZones.notes ? (
                    <div style={styles.zoneBody}>
                      Placeholder for operational status, check-in/boarding gates, etc.
                    </div>
                  ) : null}
                </section>
              </section>
            </article>
          ))}
        </div>

        {/* Zone 7 — Airport operational info (global card for the day for now) */}
        <section style={styles.card}>
          <div style={styles.zone7Title}>Zone 7 — Airport operational info</div>
          <div style={styles.zone7Body}>
            Placeholder. Later this is fed by Schiphol API and updated frequently.
          </div>
        </section>
      </div>
    </div>
  );
}
