// FILE: src/pages/TravelHistoryRecent.tsx
//
// =====================================================================================
// RECENT LISTING HISTORY REPORT VIEW
// =====================================================================================
//
// PURPOSE
// - Displays actual live listing-history rows for a selected recent period.
// - Opened from /profile/travel-history landing page presets/custom range.
//
// REPORT ROW DISPLAY
// - Status pill is deliberately not shown.
// - Rows are displayed as factual historical report lines:
//
//   Line 1:
//   [Date] · [Dep] → [Arr] · [Flight No.]
//
//   Line 2:
//   Requested: [date/time UTC] · Source: [KLM/HV]
//
//   Line 3:
//   Security No: [xxx]
//   OR Confirmed: [date/time UTC]
//   OR Confirmed: —
//
// DATE DISPLAY
// - Dates are displayed as DD-MM-YYYY.
// - Line 1 does not show "UTC" lettering.
// - Timestamp lines keep "UTC".
//
// CURRENT FEATURES
// - View report rows.
// - Print via browser print.
//
// FUTURE FEATURES
// - Download PDF/CSV after artifact strategy is locked.
// =====================================================================================

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import StickyPageHeaderCard from "../components/StickyPageHeaderCard";
import { UI_ICONS } from "../assets";
import { useAuth } from "../app/authStore";

import {
  getMyTravelHistory,
  type TravelHistoryResponse,
  type TravelHistoryRow,
} from "../api/travelHistoryApi";

function isoDateToDdMmYyyy(value: string | null | undefined): string {
  if (!value) return "—";

  const raw = String(value).trim();

  // Expected ISO UTC: YYYY-MM-DDTHH:MM:SSZ
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const yyyy = raw.slice(0, 4);
    const mm = raw.slice(5, 7);
    const dd = raw.slice(8, 10);

    return `${dd}-${mm}-${yyyy}`;
  }

  return raw;
}

function formatUtcLabel(value: string | null | undefined): string {
  if (!value) return "—";

  const raw = String(value).trim();

  // Expected ISO UTC: YYYY-MM-DDTHH:MM:SSZ
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) {
    return `${isoDateToDdMmYyyy(raw)} ${raw.slice(11, 16)} UTC`;
  }

  return raw.replace("T", " ").replace("Z", " UTC");
}

function formatUtcDateOnly(value: string | null | undefined): string {
  return isoDateToDdMmYyyy(value);
}

function formatUtcMinuteLabel(value: string | null | undefined): string {
  return formatUtcLabel(value);
}

function sourceLabel(source: string): string {
  const s = String(source || "").trim().toLowerCase();

  if (s === "klm") return "KLM";
  if (s === "hv") return "HV";

  return source ? source.toUpperCase() : "—";
}

function parsePresetRange(value: string | null): 7 | 28 | 90 {
  if (value === "7") return 7;
  if (value === "28") return 28;
  return 90;
}



function TravelHistoryRowCard(props: { row: TravelHistoryRow }) {
  const { row } = props;

  const flightLabel =
    row.flight_label ||
    `${row.airline_iata || ""}${row.flight_number || ""}` ||
    "Flight";

  const dateLabel = formatUtcDateOnly(row.std_utc);

  const routeLabel =
    row.dep_airport && row.arr_airport
      ? `${row.dep_airport} → ${row.arr_airport}`
      : row.route_label || "—";

  const securityNumber = String(row.security_number || "").trim();

  const isCancelled =
    String(row.booking_status || "").trim().toLowerCase() === "cancelled";

  const line3 = isCancelled
    ? row.cancelled_at_utc
      ? `Cancelled: ${formatUtcMinuteLabel(row.cancelled_at_utc)}`
      : "Cancelled"
    : securityNumber
      ? `Security No: ${securityNumber}`
      : `Confirmed: ${formatUtcMinuteLabel(row.confirmed_at_utc)}`;

  return (
    <div
      className="profile-row"
      style={{
        cursor: "default",
        alignItems: "stretch",
        display: "block",
        textAlign: "left",
        position: "relative",
        overflow: "hidden",
        background: isCancelled ? "#f3f4f6" : undefined,
        borderColor: isCancelled ? "#fecaca" : undefined,
      }}
    >
      {isCancelled ? (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "-12%",
            top: "50%",
            width: "124%",
            height: 2,
            background: "#fecaca",
            transform: "rotate(-12deg)",
            transformOrigin: "center",
            opacity: 0.75,
            pointerEvents: "none",
          }}
        />
      ) : null}

      <div
        style={{
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            fontSize: 16,
			fontWeight: isCancelled ? 600 : 900,			
            color: "#111827",
            lineHeight: 1.35,
            marginBottom: 8,
          }}
        >
          {dateLabel} · {routeLabel} · {flightLabel}
        </div>

        <div
          style={{
            fontSize: 13,

			fontWeight: isCancelled ? 600 : 700,				
            color: "#4b5563",
            lineHeight: 1.45,
            marginBottom: 4,
          }}
        >
          Requested: {formatUtcMinuteLabel(row.requested_at_utc)} · Source:{" "}
          {sourceLabel(row.source_system)}
        </div>

        <div
			style={{
			  fontSize: 13,
			  fontWeight: isCancelled ? 400 : 700,
			  color: isCancelled ? "#f87171" : "#4b5563",
			  lineHeight: 1.45,
			}}
        >
          {line3}
        </div>
      </div>
    </div>
  );
}


export default function TravelHistoryRecent() {
  const nav = useNavigate();
  const [params] = useSearchParams();

  const authCtx: any = useAuth();
  const auth = authCtx?.auth || null;

  const memberPsn = String(auth?.user?.username || authCtx?.psn || "")
    .trim()
    .toUpperCase();

  const range = parsePresetRange(params.get("range"));
  const from = String(params.get("from") || "").trim();
  const to = String(params.get("to") || "").trim();

  const isCustom = !!from || !!to;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TravelHistoryResponse | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadReport() {
      if (!memberPsn) {
        setLoading(false);
        setError("Missing member identity.");
        setData(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const resp = await getMyTravelHistory({
          staffNo: memberPsn,
          ...(isCustom ? { from, to } : { rangeDays: range }),
        });

        if (!alive) return;

        setData(resp);
      } catch (err) {
        if (!alive) return;

        const message = String(
          (err as any)?.message || "Could not load listing history."
        );

        setError(message);
        setData(null);
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    void loadReport();

    return () => {
      alive = false;
    };
  }, [memberPsn, range, from, to, isCustom]);

  const rows = useMemo(() => {
    return Array.isArray(data?.rows) ? data.rows : [];
  }, [data]);

  return (
    <div className="app-screen profile-page">
      <StickyPageHeaderCard
        leftContent={
          <img
            src={UI_ICONS.listing}
            alt="Recent history"
            style={{
              width: 52,
              height: 52,
              objectFit: "contain",
              borderRadius: 14,
            }}
          />
        }
        title="Recent History"
        onBack={() => nav(-1)}
        backAriaLabel="Back"
      />

      <div className="app-container" style={{ paddingTop: 0 }}>
        <div className="card">
          <div className="profile-section-title">
            {data?.range_label || (isCustom ? "Custom range" : `Last ${range} days`)}
          </div>

          <div
            style={{
              fontSize: 13,
              lineHeight: 1.45,
              color: "#4b5563",
              marginBottom: 12,
            }}
          >
            {data?.disclaimer ||
              "This report shows XCM/XFA listing history only. It is not proof of travel, boarding, payroll deduction, tax settlement, or airport acceptance."}
          </div>

          <div
            style={{
              fontSize: 12,
              lineHeight: 1.4,
              color: "#6b7280",
              marginBottom: 12,
            }}
          >
            Period: {formatUtcLabel(data?.window_start_utc)} →{" "}
            {formatUtcLabel(data?.window_end_utc)}
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            style={{
              width: "100%",
              border: "1px solid #d7deef",
              borderRadius: 12,
              padding: "10px 12px",
              fontWeight: 800,
              cursor: "pointer",
              background: "#ffffff",
            }}
          >
            Print view
          </button>
        </div>

        <div className="card">
          <div className="profile-section-title">Listing records</div>

          {loading ? (
            <div className="profile-row" style={{ cursor: "default" }}>
              <div className="profile-actionText">
                <div className="profile-actionTitle">Loading...</div>
                <div className="profile-actionSub">
                  Checking listing records
                </div>
              </div>
            </div>
          ) : null}

          {!loading && error ? (
            <div className="profile-row" style={{ cursor: "default" }}>
              <div className="profile-actionText">
                <div className="profile-actionTitle">Could not load report</div>
                <div className="profile-actionSub">{error}</div>
              </div>
            </div>
          ) : null}

          {!loading && !error && rows.length === 0 ? (
            <div className="profile-row" style={{ cursor: "default" }}>
              <div className="profile-actionText">
                <div className="profile-actionTitle">
                  {data?.empty_message || "No listing history found for the selected period."}
                </div>
                <div className="profile-actionSub">
                  Try a wider date range.
                </div>
              </div>
            </div>
          ) : null}

          {!loading && !error && rows.length > 0
            ? rows.map((row, idx) => (
                <TravelHistoryRowCard
                  key={`${row.source_system}:${row.flight_instance_id}:${idx}`}
                  row={row}
                />
              ))
            : null}
        </div>
      </div>
    </div>
  );
}