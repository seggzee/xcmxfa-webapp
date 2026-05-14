// FILE: src/pages/TravelHistory.tsx
//
// =====================================================================================
// PERSONAL TRAVEL HISTORY LANDING PAGE
// =====================================================================================
//
// PURPOSE
// - Landing/index page for listing-history reporting.
// - Does NOT display live listing rows.
// - Provides:
//     1. General notes
//     2. Recent history presets
//     3. Quarterly report cards
//
// =====================================================================================

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import StickyPageHeaderCard from "../components/StickyPageHeaderCard";
import { UI_ICONS } from "../assets";
import { useAuth } from "../app/authStore";

import {
  getMyTravelHistoryReports,
  type TravelHistoryReportsResponse,
  type TravelHistoryQuarterlyReport,
} from "../api/travelHistoryApi";

function formatUtcShort(value: string | null | undefined): string {
  if (!value) return "—";
  return String(value).replace("T", " ").replace("Z", " UTC");
}

function PickerTile(props: {
  iconSrc: string;
  title: string;
  subtext: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const { iconSrc, title, subtext, onClick, disabled = false } = props;

  return (
    <button
      type="button"
      className="profile-row"
      onClick={onClick}
      disabled={disabled}
      style={disabled ? { opacity: 0.7, cursor: "default" } : undefined}
    >
      <div className="profile-actionMain">
        <div className="profile-actionIconWrap">
          <img src={iconSrc} alt="" className="profile-actionIcon" />
        </div>

        <div className="profile-actionText">
          <div className="profile-actionTitle">{title}</div>
          <div className="profile-actionSub">{subtext}</div>
        </div>
      </div>

      <span className="profile-chevron">›</span>
    </button>
  );
}

function QuarterlyReportTile(props: {
  report: TravelHistoryQuarterlyReport;
  onClick: () => void;
}) {
  const { report, onClick } = props;

  return (
    <button
      type="button"
      className="profile-row"
      onClick={onClick}
      style={{ textAlign: "left" }}
    >
      <div className="profile-actionMain">
        <div className="profile-actionIconWrap">
          <img src={UI_ICONS.listing} alt="" className="profile-actionIcon" />
        </div>

        <div className="profile-actionText">
          <div className="profile-actionTitle">
            {report.label || `Q${report.quarter_number} ${report.quarter_year}`}
          </div>

          <div className="profile-actionSub">
            {report.row_count} listing record{report.row_count === 1 ? "" : "s"}
            {" · "}
            Generated {formatUtcShort(report.generated_at_utc)}
          </div>
        </div>
      </div>

      <span className="profile-chevron">›</span>
    </button>
  );
}

export default function TravelHistory() {
  const nav = useNavigate();

  const authCtx: any = useAuth();
  const auth = authCtx?.auth || null;

  const memberPsn = String(auth?.user?.username || authCtx?.psn || "")
    .trim()
    .toUpperCase();

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reportsData, setReportsData] =
    useState<TravelHistoryReportsResponse | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadQuarterlyReports() {
      if (!memberPsn) {
        setReportsLoading(false);
        setReportsError("Missing member identity.");
        setReportsData(null);
        return;
      }

      setReportsLoading(true);
      setReportsError(null);

      try {
        const resp = await getMyTravelHistoryReports({ staffNo: memberPsn });

        if (!alive) return;

        setReportsData(resp);
      } catch (err) {
        if (!alive) return;

        const message = String(
          (err as any)?.message || "Could not load quarterly reports."
        );

        setReportsError(message);
        setReportsData(null);
      } finally {
        if (alive) {
          setReportsLoading(false);
        }
      }
    }

    void loadQuarterlyReports();

    return () => {
      alive = false;
    };
  }, [memberPsn]);

  const quarterlyReports = useMemo(() => {
    const rows = Array.isArray(reportsData?.reports) ? reportsData.reports : [];
    return rows.slice(0, 4);
  }, [reportsData]);

  const openRecentPreset = (days: 7 | 28 | 90) => {
    nav(`/profile/travel-history/recent?range=${days}`);
  };

  const openCustomRange = () => {
    const from = String(fromDate || "").trim();
    const to = String(toDate || "").trim();

    if (!from || !to) {
      window.alert("Please select both a from date and a to date.");
      return;
    }

    if (from > to) {
      window.alert("The from date must be before the to date.");
      return;
    }

    nav(
      `/profile/travel-history/recent?from=${encodeURIComponent(
        from
      )}&to=${encodeURIComponent(to)}`
    );
  };

  return (
    <div className="app-screen profile-page">
      <StickyPageHeaderCard
        leftContent={
          <img
            src={UI_ICONS.listing}
            alt="Listings history"
            style={{
              width: 52,
              height: 52,
              objectFit: "contain",
              borderRadius: 14,
            }}
          />
        }
        title="Listings History"
        onBack={() => nav(-1)}
        backAriaLabel="Back"
      />

      <div className="app-container" style={{ paddingTop: 0 }}>
        <div className="card">
          <div className="profile-section-title">About listing history</div>

          <div
            style={{
              fontSize: 14,
              lineHeight: 1.5,
              color: "#4b5563",
            }}
          >
            <p style={{ marginTop: 0 }}>
              This section shows your XCM/XFA listing records.
            </p>

            <p style={{ marginBottom: 0 }}>
              It is not proof of travel, boarding, payroll deduction, tax
              settlement, or airport acceptance.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="profile-section-title">Recent history</div>

          <PickerTile
            iconSrc={UI_ICONS.calendar}
            title="Last 7 days"
            subtext="View recent listing records"
            onClick={() => openRecentPreset(7)}
          />

          <PickerTile
            iconSrc={UI_ICONS.calendar}
            title="Last 28 days"
            subtext="View recent listing records"
            onClick={() => openRecentPreset(28)}
          />

          <PickerTile
            iconSrc={UI_ICONS.calendar}
            title="Last 90 days"
            subtext="View recent listing records"
            onClick={() => openRecentPreset(90)}
          />

          <div
            className="profile-row"
            style={{
              cursor: "default",
              display: "block",
              textAlign: "left",
            }}
          >
            <div className="profile-actionTitle" style={{ marginBottom: 6 }}>
              Custom date range
            </div>

            <div className="profile-actionSub" style={{ marginBottom: 10 }}>
              Select a period within the recent live-history window.
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                aria-label="From date"
                style={{
                  width: "100%",
                  border: "1px solid #d7deef",
                  borderRadius: 10,
                  padding: "10px 8px",
                  fontSize: 13,
                }}
              />

              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                aria-label="To date"
                style={{
                  width: "100%",
                  border: "1px solid #d7deef",
                  borderRadius: 10,
                  padding: "10px 8px",
                  fontSize: 13,
                }}
              />
            </div>

            <button
              type="button"
              onClick={openCustomRange}
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
              View custom range
            </button>
          </div>
        </div>

        <div className="card">
          <div className="profile-section-title">Quarterly reports</div>

          {reportsLoading ? (
            <div className="profile-row" style={{ cursor: "default" }}>
              <div className="profile-actionText">
                <div className="profile-actionTitle">Loading...</div>
                <div className="profile-actionSub">
                  Checking available quarterly reports
                </div>
              </div>
            </div>
          ) : null}

          {!reportsLoading && reportsError ? (
            <div className="profile-row" style={{ cursor: "default" }}>
              <div className="profile-actionText">
                <div className="profile-actionTitle">
                  Could not load quarterly reports
                </div>
                <div className="profile-actionSub">{reportsError}</div>
              </div>
            </div>
          ) : null}

          {!reportsLoading && !reportsError && quarterlyReports.length === 0 ? (
            <div className="profile-row" style={{ cursor: "default" }}>
              <div className="profile-actionText">
                <div className="profile-actionTitle">
                  {reportsData?.empty_message || "No quarterly reports available yet."}
                </div>
                <div className="profile-actionSub">
                  Reports will appear here after quarterly archive generation.
                </div>
              </div>
            </div>
          ) : null}

          {!reportsLoading && !reportsError && quarterlyReports.length > 0
            ? quarterlyReports.map((report) => (
                <QuarterlyReportTile
                  key={report.report_id}
                  report={report}
                  onClick={() =>
                    nav(`/profile/travel-history/quarterly/${report.report_id}`)
                  }
                />
              ))
            : null}
        </div>
      </div>
    </div>
  );
}