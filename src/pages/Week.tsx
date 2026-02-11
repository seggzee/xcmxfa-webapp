import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/authStore";
import AppHeader from "../components/AppHeader";
import FlightCard3x3 from "../components/FlightCard3x3";
/**
 * Weekly Overview (RN parity layout)
 *
 * Current behavior:
 * - Build 7 dateKeys starting today (local browser time)
 * - Navigate to /day/:dateKey when a day tile is clicked
 *
 * Later:
 * - Replace placeholders with 7x Day API composition (client-side first)
 * - Render same chip/status semantics as RN weekly
 */

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, delta: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + delta);
  return x;
}

function monthName(d: Date) {
  return d.toLocaleDateString(undefined, { month: "long" });
}

function dowName(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "long" });
}

export default function Week() {
	
	const { auth } = useAuth();
	const nav = useNavigate();
	const [mode, setMode] = useState<"classic" | "compact">("classic");

  // Build 7 dateKeys starting today (local browser time)
  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }).map((_, i) => {
      const d = addDays(today, i);
      const dateKey = toDateKey(d);

      const label = d.toLocaleDateString(undefined, {
        weekday: "short",
        day: "2-digit",
        month: "short",
      });

      return {
        dateKey,
        label,
        dateObj: d,
        dayNum: d.getDate(),
        dowLong: dowName(d),
        monthLong: monthName(d),
      };
    });
  }, []);

  // RN-like screen wrapper + components (inline, per-page)
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

    // Header card (RN weekly top block)
    headerCard: {
      background: "#fff",
      border: "2px solid #e6e9ee",
      borderRadius: 18,
      padding: 14,
      marginBottom: 14,
    } as React.CSSProperties,
    headerTopRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    } as React.CSSProperties,
    headerLogo: {
      width: 54,
      height: 54,
      borderRadius: 14,
      background: "#f6f7f9",
      border: "2px solid #d9e2ee",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 900,
      color: "#132333",
    } as React.CSSProperties,
    headerCode: {
      fontSize: 34,
      fontWeight: 800,
      color: "#132333",
      letterSpacing: 0.5,
      flex: 1,
      textAlign: "center",
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
    rangeText: {
      marginTop: 10,
      fontWeight: 900,
      color: "#132333",
    } as React.CSSProperties,
    metaText: {
      marginTop: 4,
      fontWeight: 800,
      fontSize: 12,
      color: "rgba(19,35,51,0.55)",
    } as React.CSSProperties,

    // Segmented control (Classic / Compact)
    segmented: {
      marginTop: 12,
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

    // Classic grid (RN tiles)
    weekGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: 12,
    } as React.CSSProperties,
    classicCard: {
      position: "relative",
      background: "#fff",
      border: "2px solid #d9e2ee",
      borderRadius: 18,
      overflow: "hidden",
      height: 170,
      cursor: "pointer",
    } as React.CSSProperties,
    calendarWrap: {
      height: "100%",
      background: "#f6f7f9",
    } as React.CSSProperties,
    calendarOverlay: {
      position: "absolute",
      left: 12,
      top: 12,
      color: "#132333",
    } as React.CSSProperties,
    calDow: {
      fontWeight: 900,
      fontSize: 12,
      color: "rgba(19,35,51,0.70)",
    } as React.CSSProperties,
    calMonth: {
      fontWeight: 900,
      fontSize: 12,
      color: "rgba(19,35,51,0.70)",
      marginTop: 2,
    } as React.CSSProperties,
    calDayNum: {
      fontWeight: 900,
      fontSize: 28,
      color: "#d96a79",
      marginTop: 8,
    } as React.CSSProperties,

    // Corner bubbles (dep/arr counts placeholders for now)
    corner: {
      position: "absolute",
      top: 10,
      width: 44,
      height: 44,
      borderRadius: 999,
      border: "2px solid #d9e2ee",
      background: "#fff",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
    } as React.CSSProperties,
    cornerLeft: { left: 10 } as React.CSSProperties,
    cornerRight: { right: 10 } as React.CSSProperties,
    cornerCount: {
      fontWeight: 900,
      color: "#132333",
      lineHeight: 1,
    } as React.CSSProperties,
    cornerIcon: {
      fontWeight: 900,
      color: "rgba(19,35,51,0.65)",
      lineHeight: 1,
      marginTop: 2,
    } as React.CSSProperties,

    // Compact list rows (RN compact mode)
    compactList: {
      display: "grid",
      gap: 10,
    } as React.CSSProperties,
    compactRow: {
      background: "#fff",
      border: "2px solid #d9e2ee",
      borderRadius: 16,
      padding: "12px 14px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      cursor: "pointer",
    } as React.CSSProperties,
    compactLeft: {
      display: "grid",
      gap: 2,
    } as React.CSSProperties,
    compactTitle: {
      fontWeight: 900,
      color: "#132333",
    } as React.CSSProperties,
    compactSub: {
      fontWeight: 800,
      fontSize: 12,
      color: "rgba(19,35,51,0.55)",
    } as React.CSSProperties,
    compactRight: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      color: "rgba(19,35,51,0.65)",
      fontWeight: 900,
    } as React.CSSProperties,

    // bottom note block (keep MVP note, but RN-friendly)
    noteCard: {
      marginTop: 14,
      background: "#fff",
      border: "2px solid #d9e2ee",
      borderRadius: 16,
      padding: 14,
    } as React.CSSProperties,
    noteTitle: {
      fontWeight: 900,
      color: "#132333",
    } as React.CSSProperties,
    noteBody: {
      marginTop: 8,
      fontWeight: 800,
      color: "rgba(19,35,51,0.65)",
      lineHeight: "20px",
    } as React.CSSProperties,
  };

  // Header content (placeholder until airport context wired)
  const airportCode = "AMS";

  // Range label (simple: today -> +6 days)
  const rangeLabel = useMemo(() => {
    if (days.length === 0) return "";
    const a = days[0].dateObj;
    const b = days[days.length - 1].dateObj;
    const aa = a.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" });
    const bb = b.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" });
    return `${aa} – ${bb}`;
  }, [days]);

  return (
    <div style={styles.screen}>
      <div style={styles.inner}>
	  
		{/* ===== AppHeader (RN style) ===== */}


        {/* Header card */}
        <section style={styles.headerCard}>
          <div style={styles.headerTopRow}>
            <div style={styles.headerLogo}>✈</div>

            <div style={styles.headerCode}>{airportCode}</div>

            <button type="button" style={styles.backPill} onClick={() => nav("/")}>
              Back
            </button>
          </div>

          <div style={styles.rangeText}>{rangeLabel}</div>
          <div style={styles.metaText}>Tap a day to open details</div>

          <div style={styles.segmented}>
            <button
              type="button"
              style={{
                ...styles.segBtn,
                ...(mode === "classic" ? styles.segBtnActive : null),
              }}
              onClick={() => setMode("classic")}
            >
              Classic
            </button>
            <button
              type="button"
              style={{
                ...styles.segBtn,
                ...(mode === "compact" ? styles.segBtnActive : null),
              }}
              onClick={() => setMode("compact")}
            >
              Compact
            </button>
          </div>
        </section>

        {/* Body */}
        {mode === "classic" ? (
          <section style={styles.weekGrid}>
            {days.map((d, idx) => (
              <article
                key={d.dateKey}
                style={styles.classicCard}
                onClick={() => nav(`/day/${d.dateKey}`)}
                title={d.dateKey}
              >
                <div style={styles.calendarWrap} />

                <div style={styles.calendarOverlay}>
                  <div style={styles.calDow}>{d.dowLong}</div>
                  <div style={styles.calMonth}>{d.monthLong}</div>
                  <div style={styles.calDayNum}>{d.dayNum}</div>
                </div>

                {/* Corner placeholders (RN shows dep/arr counts/chips) */}
                <button
                  type="button"
                  style={{ ...styles.corner, ...styles.cornerLeft }}
                  onClick={(e) => {
                    e.stopPropagation();
                    nav(`/day/${d.dateKey}`);
                  }}
                  aria-label="Departures"
                >
                  <div style={styles.cornerCount}>{idx % 6}</div>
                  <div style={styles.cornerIcon}>↑</div>
                </button>

                <button
                  type="button"
                  style={{ ...styles.corner, ...styles.cornerRight }}
                  onClick={(e) => {
                    e.stopPropagation();
                    nav(`/day/${d.dateKey}`);
                  }}
                  aria-label="Arrivals"
                >
                  <div style={styles.cornerCount}>{(idx + 2) % 7}</div>
                  <div style={styles.cornerIcon}>↓</div>
                </button>
              </article>
            ))}
          </section>
        ) : (
          <section style={styles.compactList}>
            {days.map((d) => (
              <div
                key={d.dateKey}
                style={styles.compactRow}
                onClick={() => nav(`/day/${d.dateKey}`)}
                title={d.dateKey}
              >
                <div style={styles.compactLeft}>
                  <div style={styles.compactTitle}>{d.label}</div>
                  <div style={styles.compactSub}>{airportCode} daily view</div>
                </div>

                <div style={styles.compactRight}>
                  <span>Open</span>
                  <span>›</span>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* MVP note (kept, but styled as RN card) */}
        <div style={styles.noteCard}>
          <div style={styles.noteTitle}>Next step (data)</div>
          <div style={styles.noteBody}>
            We will call the Day API 7 times and render the same weekly status semantics as RN (chips).
            No backend changes required — client composed first.
          </div>
        </div>
      </div>
    </div>
  );
}
