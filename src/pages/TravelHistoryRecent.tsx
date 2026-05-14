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

function formatUtcLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return String(value).replace("T", " ").replace("Z", " UTC");
}

function formatLocalLabel(value: string | null | undefined): string {
  if (!value) return "—";

  const raw = String(value);

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(raw)) {
    return raw.slice(0, 16);
  }

  return raw;
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

  return (
    <div
      className="profile-row"
      style={{
        cursor: "default",
        alignItems: "stretch",
        display: "block",
        textAlign: "left",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            className="profile-actionTitle"
            style={{
              marginBottom: 3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {row.flight_label || row.flight_number || "Flight"}
          </div>

          <div className="profile-actionSub">
            {row.route_label || `${row.dep_airport}-${row.arr_airport}`}
          </div>
        </div>

        <div
          style={{
            flexShrink: 0,
            borderRadius: 999,
            padding: "5px 9px",
            fontSize: 12,
            fontWeight: 800,
            background: "#eef2ff",
            color: "#1f2937",
            whiteSpace: "nowrap",
          }}
        >
          {row.booking_status_label || row.booking_status || "Unknown"}
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 5,
          fontSize: 12,
          color: "#4b5563",
          lineHeight: 1.35,
        }}
      >
        <div>
          <strong>STD local:</strong> {formatLocalLabel(row.std_local)}
        </div>

        <div>
          <strong>Requested:</strong> {formatUtcLabel(row.requested_at_utc)}
        </div>

        <div>
          <strong>Confirmed:</strong> {formatUtcLabel(row.confirmed_at_utc)}
        </div>

        <div>
          <strong>Source:</strong> {sourceLabel(row.source_system)}
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