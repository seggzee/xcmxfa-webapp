// src/pages/Day.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../app/authStore";
import FlightCard3x3 from "../components/FlightCard3x3";
import BackButton from "../components/BackButton";
import { getAirportLogo, LISTING_STATUS_ICONS } from "../assets";

// ✅ Day adopts global primitives + Day-only fixes
import "../styles/day.css";

// IMPORTANT: these MUST exist in your web flightsApi (same names as RN parity)
import {
  ensureDayStatusFresh,
  getFlightsForDay,
  getBookingsForDay,
  setBookingListed,
} from "../api/flightsApi";

/* ----------------------------- invariants/helpers ----------------------------- */

function invariant(condition: any, message: string) {
  if (!condition) throw new Error(message);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function dateToLocalDateKey(d: Date) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function isBefore(a: string, b: string) {
  return String(a) < String(b);
}
function isAfter(a: string, b: string) {
  return String(a) > String(b);
}

function extractHHMM(localDateTimeString: any) {
  const s = String(localDateTimeString || "");
  if (!s) return "";
  const m = s.match(/T(\d{2}:\d{2})/);
  if (m) return m[1];
  const m2 = s.match(/\s(\d{2}:\d{2})/);
  if (m2) return m2[1];
  const m3 = s.match(/^(\d{2}:\d{2})/);
  if (m3) return m3[1];
  return "";
}

const ICON_SENT = "✉︎";
const ICON_PENDING = "⏳";

function normalizeBookingStatusStrict(raw: any): "confirmed" | "sent" | "pending" {
  const s = String(raw || "").trim().toLowerCase();
  invariant(Boolean(s), "Invariant violation: booking row missing status");
  invariant(
    s === "confirmed" || s === "sent" || s === "pending",
    `Invariant violation: unexpected booking status "${s}" (expected confirmed|sent|pending)`
  );
  return s as any;
}

function statusIconChar(status: "confirmed" | "sent" | "pending") {
  if (status === "confirmed") return "✅";
  if (status === "sent") return ICON_SENT;
  return ICON_PENDING;
}
function statusIconStyle(status: "confirmed" | "sent" | "pending"): React.CSSProperties {
  if (status === "sent") return { color: "#d97706" };
  return { color: "rgba(19,35,51,0.65)" };
}

function actionConfigForFlight(airlineIata: any, userListed: boolean) {
  const code = String(airlineIata || "").toUpperCase();
  if (code === "KL") return { show: true, label: userListed ? "Unlist me" : "List me" };
  if (code === "HV") return { show: true, label: userListed ? "Remove me" : "Show me" };
  return { show: false, label: "" };
}

type ApiFlightRow = Record<string, any>;
type BookingRow = Record<string, any>;

type CrewRow = {
  bookingId: any;
  role: string | null;
  fullName: string;
  staffNo: string; // psn
  status: "confirmed" | "sent" | "pending";
  securityNo: string | null;
  listedAt: string | null; // requested_at_utc
};

const POLL_MS = 2.5 * 60 * 1000;

export default function Day() {
  const nav = useNavigate();
  const loc = useLocation();
  const { auth } = useAuth();
  const { dateKey: dateKeyParam } = useParams();

  const airport = (loc.state as any)?.airport;
  invariant(Boolean(airport), "Day: missing airport in navigation state");
  const airportCode = String(airport).toUpperCase();

  const resolvedIsLoggedIn = auth?.mode === "member";

  // Identity invariant: member must have psn; no fallbacks beyond explicit auth fields, and hard error if missing.
  const psn = useMemo(() => {
    if (!resolvedIsLoggedIn) return null;

    const raw =
      (auth as any)?.user?.staffNo ??
      (auth as any)?.user?.staff_number ??
      (auth as any)?.user?.staff_identity ??
      (auth as any)?.user?.username ??
      null;

    const v = String(raw || "").trim();
    invariant(Boolean(v), "Invariant violation: missing psn (canonical) for member in Day");
    return v;
  }, [resolvedIsLoggedIn, auth]);

  invariant(Boolean(dateKeyParam), "Day: missing :dateKey param");
  const [dateKey, setDateKey] = useState<string>(String(dateKeyParam));
  useEffect(() => setDateKey(String(dateKeyParam)), [dateKeyParam]);

  // tab: "departures" | "arrivals" (RN)
  const initialTab = useMemo(() => {
    const qs = new URLSearchParams(loc.search || "");
    const t = String(qs.get("tab") || "").trim().toLowerCase();
    if (t === "arrivals") return "arrivals";
    if (t === "departures") return "departures";
    return "departures";
  }, [loc.search]);

  const [tab, setTab] = useState<"departures" | "arrivals">(initialTab);
  useEffect(() => setTab(initialTab), [initialTab]);

  const minDateKey = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return dateToLocalDateKey(d);
  }, []);

  const maxDateKey = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 8);
    return dateToLocalDateKey(d);
  }, []);

  const canGoPrev = useMemo(
    () => !isBefore(dateKey, minDateKey) && dateKey !== minDateKey,
    [dateKey, minDateKey]
  );
  const canGoNext = useMemo(
    () => !isAfter(dateKey, maxDateKey) && dateKey !== maxDateKey,
    [dateKey, maxDateKey]
  );

  const [dateBoundMsg, setDateBoundMsg] = useState("");
  const flashBoundMsg = (msg: string) => {
    setDateBoundMsg(msg);
    window.setTimeout(() => setDateBoundMsg(""), 1200);
  };

  const dateLabel = useMemo(() => {
    const d = new Date(`${dateKey}T00:00:00`);
    return d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [dateKey]);

  const shortDateForModal = useMemo(() => {
    const d = new Date(`${dateKey}T00:00:00`);
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [dateKey]);

  const prevDowShort = useMemo(() => {
    try {
      const d = new Date(`${dateKey}T00:00:00`);
      d.setDate(d.getDate() - 1);
      return d.toLocaleDateString("en-GB", { weekday: "short" });
    } catch {
      return "−";
    }
  }, [dateKey]);

  const nextDowShort = useMemo(() => {
    try {
      const d = new Date(`${dateKey}T00:00:00`);
      d.setDate(d.getDate() + 1);
      return d.toLocaleDateString("en-GB", { weekday: "short" });
    } catch {
      return "+";
    }
  }, [dateKey]);

  const stepDateKey = (deltaDays: number) => {
    try {
      const d = new Date(`${dateKey}T00:00:00`);
      if (Number.isNaN(d.getTime())) return;
      d.setDate(d.getDate() + deltaDays);
      const nextKey = dateToLocalDateKey(d);

      if (isBefore(nextKey, minDateKey)) {
        flashBoundMsg("You can’t go earlier than yesterday.");
        return;
      }
      if (isAfter(nextKey, maxDateKey)) {
        flashBoundMsg("No more days available.");
        return;
      }

      const qs = tab === "arrivals" ? "tab=arrivals" : "tab=departures";
      nav(`/day/${nextKey}?${qs}`, { state: { airport: airportCode } });
    } catch {
      // RN parity: ignore
    }
  };

  // ---- API state ----
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [lastStatusUpdatedUtc, setLastStatusUpdatedUtc] = useState<string | null>(null);
  const [lastRefreshedAtUtc, setLastRefreshedAtUtc] = useState<string | null>(null);

  const [rawRows, setRawRows] = useState<any>({
    departures: [],
    arrivals: [],
    flights: [],
  });

  const [bookingsByFlight, setBookingsByFlight] = useState<Record<string, BookingRow[]>>({});

  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshInFlightRef = useRef(false);
  const pollTimerRef = useRef<number | null>(null);

  const startAutoRefreshTimer = () => {
    if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    pollTimerRef.current = window.setInterval(() => {
      refreshDay({ showLoading: false });
    }, POLL_MS);
  };

  async function refreshDay({ showLoading = false }: { showLoading?: boolean } = {}) {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;

    try {
      setErrorText("");
      if (showLoading) setLoading(true);

      // 1) ensure fresh (ignore errors per RN)
      try {
        const ensureResp: any = await ensureDayStatusFresh({ airportCode, dateKey });
        const last =
          ensureResp?.last_updated_utc ??
          ensureResp?.lastUpdatedUtc ??
          ensureResp?.status_last_updated_utc ??
          null;
        if (last) setLastStatusUpdatedUtc(String(last));
      } catch {
        // ignore
      }

      // 2) flights
      const dayResp: any = await getFlightsForDay({ airportCode, dateKey });

      const depRows = Array.isArray(dayResp?.departures) ? dayResp.departures : [];
      const arrRows = Array.isArray(dayResp?.arrivals) ? dayResp.arrivals : [];
      const flatRows = Array.isArray(dayResp?.flights) ? dayResp.flights : [];

      setRawRows({
        departures: depRows,
        arrivals: arrRows,
        flights: flatRows,
      });

      const last2 =
        dayResp?.status_last_updated_utc ??
        dayResp?.last_updated_utc ??
        dayResp?.lastUpdatedUtc ??
        null;
      if (last2) setLastStatusUpdatedUtc(String(last2));

      // 3) bookings (ALWAYS load; required for X-staff 3:3)
      try {
        const bookingsResp: any = await getBookingsForDay({ airportCode, dateKey });

        const by = bookingsResp?.by_flight_instance_id;

        invariant(
          Boolean(by && typeof by === "object"),
          "Invariant violation: bookings response missing by_flight_instance_id"
        );

        Object.keys(by).forEach((k) => {
          invariant(
            Boolean(String(k).trim()),
            "Invariant violation: bookingsByFlight contains empty flight_instance_id key"
          );
        });

        setBookingsByFlight(by);
      } catch (e: any) {
        setErrorText(e?.message || "Failed to load crew list");
        setBookingsByFlight({});
      }

      setLastRefreshedAtUtc(new Date().toISOString());
      setLoading(false);
    } catch (e: any) {
      setErrorText(e?.message || "Failed to load flights");
      setLoading(false);
    } finally {
      refreshInFlightRef.current = false;
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    let alive = true;

    async function start() {
      await refreshDay({ showLoading: true });
      if (!alive) return;
      startAutoRefreshTimer();
    }

    start();

    return () => {
      alive = false;
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airportCode, dateKey]);

  // ---------------------------------------------------------------------------
  // RN parity:
  // - Do NOT build a synthetic FlightVM for FlightCard3x3.
  // - Pass the RAW API flight row (snake_case) into FlightCard3x3.
  // ---------------------------------------------------------------------------

  type FlightItem = {
    flightInstanceId: string;
    uiKey: string;
    row: ApiFlightRow; // RAW row from API (snake_case)
  };

  const flights: FlightItem[] = useMemo(() => {
    const hub = "AMS";
    const airport = String(airportCode || "").toUpperCase();

    const fromApiDepartures = Array.isArray(rawRows?.departures) ? rawRows.departures : null;
    const fromApiArrivals = Array.isArray(rawRows?.arrivals) ? rawRows.arrivals : null;

    let filtered: ApiFlightRow[] = [];
    if (tab === "departures") filtered = fromApiDepartures || [];
    else filtered = fromApiArrivals || [];

    // RN fallback path (only if API doesn't return split arrays)
    if ((!fromApiDepartures || !fromApiArrivals) && Array.isArray(rawRows?.flights)) {
      const legacyRows: ApiFlightRow[] = rawRows.flights;
      if (tab === "departures") {
        filtered = legacyRows.filter(
          (r) =>
            String(r.dep_airport || "").toUpperCase() === airport &&
            String(r.arr_airport || "").toUpperCase() === hub
        );
      } else {
        filtered = legacyRows.filter(
          (r) =>
            String(r.dep_airport || "").toUpperCase() === hub &&
            String(r.arr_airport || "").toUpperCase() === airport
        );
      }
    }

    return filtered.map((r) => {
      const flightInstanceId = String(r?.flight_instance_id || "").trim();
      invariant(Boolean(flightInstanceId), "Invariant violation: flight row missing flight_instance_id in Day");

      return {
        flightInstanceId,
        uiKey: `flight-${flightInstanceId}`,
        row: r,
      };
    });
  }, [rawRows, tab, airportCode]);

  function formatListedAtDisplay(raw: string | null | undefined): string {
    if (!raw) return "--";

    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "--";

    const day = d.toLocaleDateString("en-GB", { day: "2-digit" });
    const month = d.toLocaleDateString("en-GB", { month: "short" });
    const time = d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    return `${day} ${month} / ${time}`;
  }

  function crewListForFlight(flightInstanceId: string): CrewRow[] {
    const rows = Array.isArray(bookingsByFlight?.[flightInstanceId])
      ? bookingsByFlight[flightInstanceId]
      : [];

    // RN canonical order:
    // listing_prio ASC, requested_at_utc ASC, id ASC
    return rows
      .slice()
      .sort((a, b) => {
        const pa = Number(a?.listing_prio);
        const pb = Number(b?.listing_prio);

        const na = Number.isNaN(pa) ? 9999 : pa;
        const nb = Number.isNaN(pb) ? 9999 : pb;
        if (na !== nb) return na - nb;

        const ta = String(a?.requested_at_utc || "");
        const tb = String(b?.requested_at_utc || "");
        if (ta !== tb) return ta.localeCompare(tb);

        const ia = Number(a?.id) || 0;
        const ib = Number(b?.id) || 0;
        return ia - ib;
      })
      .map((b) => {
        const rowPsn = String(b?.psn || "").trim();
        invariant(Boolean(rowPsn), "Invariant violation: booking row missing psn");

        const first = String(b?.firstname || "").trim();
        const last = String(b?.lastname || "").trim();
        const fullName = `${first} ${last}`.trim();
        invariant(Boolean(fullName), "Invariant violation: booking row missing firstname/lastname");

        // Backend contract: status field is "status" (pending|sent|confirmed)
        const status = normalizeBookingStatusStrict(b?.status);

        return {
          bookingId: b?.id,
          role: b?.x_type || null,
          fullName,
          staffNo: rowPsn,
          status,
          securityNo: b?.security_number || null,
          listedAt: b?.requested_at_utc || null,
        };
      });
  }

  function isUserListed(flightInstanceId: string) {
    if (!resolvedIsLoggedIn) return false;
    const rows = bookingsByFlight?.[flightInstanceId] || [];
    return rows.some((b) => String(b?.psn || "").trim() === String(psn || "").trim());
  }

  // ---- confirm modal ----
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmMode, setConfirmMode] = useState<"list" | "unlist">("list");
  const [confirmMeta, setConfirmMeta] = useState<{ flightInstanceId: string; row: ApiFlightRow } | null>(null);
  const [confirmErrorText, setConfirmErrorText] = useState("");

  const [actionBusyByFlight, setActionBusyByFlight] = useState<Record<string, "list" | "unlist" | null>>({});
  const [actionSuccessByFlight, setActionSuccessByFlight] = useState<Record<string, "listed" | "unlisted" | null>>(
    {}
  );

  function openConfirm(mode: "list" | "unlist", args: { flightInstanceId: string; row: ApiFlightRow }) {
    setConfirmMode(mode);
    setConfirmErrorText("");
    setConfirmMeta({ flightInstanceId: args.flightInstanceId, row: args.row });
    setConfirmVisible(true);
  }

  async function commitConfirm() {
    if (!confirmMeta?.flightInstanceId) {
      setConfirmVisible(false);
      return;
    }

    const flightInstanceId = confirmMeta.flightInstanceId;
    const mode = confirmMode;

    invariant(
      Boolean(String(flightInstanceId || "").trim()),
      "Invariant violation: missing flight_instance_id at Day write-path"
    );
    invariant(Boolean(psn), "Invariant violation: missing psn at Day write-path");

    setActionBusyByFlight((prev) => ({ ...prev, [flightInstanceId]: mode }));

    try {
      await setBookingListed({
        mode,
        flightInstanceId,
        staffNo: psn,
      });

      setConfirmVisible(false);
      await refreshDay();

      setActionSuccessByFlight((prev) => ({ ...prev, [flightInstanceId]: mode === "list" ? "listed" : "unlisted" }));
      window.setTimeout(() => {
        setActionSuccessByFlight((prev) => {
          const next = { ...prev };
          delete next[flightInstanceId];
          return next;
        });
      }, 1200);
    } catch (e: any) {
      setConfirmErrorText(e?.message || "Request failed");
    } finally {
      setActionBusyByFlight((prev) => {
        const next = { ...prev };
        delete next[flightInstanceId];
        return next;
      });
    }
  }

  // ---- info modal ----
  const [infoVisible, setInfoVisible] = useState(false);
  const [infoMeta, setInfoMeta] = useState<any>(null);

  function openInfoModal(args: { flightNo: string; u: CrewRow; isSelf: boolean; notesText?: string }) {
    const whoLabel = args.isSelf ? "Your" : `${args.u.fullName}'s`;
    setInfoMeta({
      flightNo: args.flightNo,
      whoLabel,
      securityNo: args.u.securityNo, // STRICT: no fabricated fallback
      statusText: args.u.status,
      notesText: args.notesText || "",
    });
    setInfoVisible(true);
  }

  const onManualRefresh = async () => {
    if (isRefreshing || refreshInFlightRef.current) return;
    setIsRefreshing(true);
    await refreshDay({ showLoading: false });
    startAutoRefreshTimer();
  };

  // --- header lines ---
  const databaseLabel = useMemo(() => {
    if (!lastStatusUpdatedUtc) return "";
    return new Date(lastStatusUpdatedUtc).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }, [lastStatusUpdatedUtc]);

  const refreshedLabel = useMemo(() => {
    if (!lastRefreshedAtUtc) return "";
    return new Date(lastRefreshedAtUtc).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }, [lastRefreshedAtUtc]);

  const airportLogoSrc = getAirportLogo(airportCode);

  // Compact meta text (matches Week compact look)
  const metaD = databaseLabel ? `D: ${databaseLabel}` : "";
  const metaR = refreshedLabel ? `R: ${refreshedLabel}` : "";

  // ✅ Single helper text for the one "i" button
  const metaHelpText =
    "D = Database time: when the backend last updated its schedule/status data from the airline feed.\n" +
    "R = Refreshed time: when this app last synced (fetched) this screen from the backend.";

  return (
    <div className="app-screen">
      {/* Day-local sticky header stack (Day-only bleed fix lives in .day-sticky) */}
      <div className="day-sticky">
        <div className="app-container">
          <section className="day-headerCard">
            <div className="day-headerTopRow">
              {/* Left: meta + info helper */}
              <div className="day-metaLeft">
                <div className="day-metaHead">
                  <div className="day-metaLines">
                    {loading || isRefreshing ? (
                      <div className="day-metaLine">
                        <span className="day-spinner" aria-label="Updating" />
                      </div>
                    ) : errorText ? (
                      <div className="day-metaLine" title={errorText}>
                        {errorText}
                      </div>
                    ) : (
                      <>
                        {!!metaD && <div className="day-metaLine">{metaD}</div>}
                        {!!metaR && <div className="day-metaLine">{metaR}</div>}
                        {!metaD && !metaR ? <div className="day-metaLine"> </div> : null}
                      </>
                    )}

                    {dateBoundMsg ? (
                      <div className="day-metaLine day-metaLineWarn" title={dateBoundMsg}>
                        {dateBoundMsg}
                      </div>
                    ) : null}
                  </div>

                  {/* ✅ ONE "i" button. It MUST do something on tap, so we use alert. */}
                  <button
                    type="button"
                    className="day-metaInfo"
                    aria-label="What are D and R?"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.alert(metaHelpText);
                    }}
                  >
                    i
                  </button>
                </div>
              </div>

              {/* Centre: airport logo (no airport code on Day) */}
              <div className="day-logoCenter">
                {airportLogoSrc ? (
                  <img src={airportLogoSrc} alt={`${airportCode} logo`} className="day-airportLogo" />
                ) : null}
              </div>

              {/* Right: unified back image button */}
              <div className="day-backRight">
                <BackButton onClick={() => nav(-1)} ariaLabel="Back" size={38} />
              </div>
            </div>

            <div className="day-tabsWrap">
              <button
                type="button"
                onClick={() => {
                  setTab("departures");
                  nav(`/day/${dateKey}?tab=departures`, { state: { airport: airportCode }, replace: true });
                }}
                className={`day-tabBtn ${tab === "departures" ? "day-tabBtnActive" : ""}`}
              >
                Departures
              </button>

              <button
                type="button"
                onClick={() => {
                  setTab("arrivals");
                  nav(`/day/${dateKey}?tab=arrivals`, { state: { airport: airportCode }, replace: true });
                }}
                className={`day-tabBtn ${tab === "arrivals" ? "day-tabBtnActive" : ""}`}
              >
                Arrivals
              </button>
            </div>

            <div className="day-dateStepperRow">
              <button
                type="button"
                onClick={() => stepDateKey(-1)}
                disabled={!canGoPrev}
                className="day-dateStepperBtn"
                style={{ opacity: canGoPrev ? 1 : 0.35 }}
              >
                {prevDowShort}
              </button>

              <div className="day-dateLabel">{dateLabel}</div>

              <button
                type="button"
                onClick={() => stepDateKey(1)}
                disabled={!canGoNext}
                className="day-dateStepperBtn"
                style={{ opacity: canGoNext ? 1 : 0.35 }}
              >
                {nextDowShort}
              </button>
            </div>
          </section>
        </div>
      </div>

      <div className="app-container day-body">
        {flights.map((f) => {
          const fid = f.flightInstanceId;
          const row = f.row || {};

          const userListed = resolvedIsLoggedIn ? isUserListed(fid) : false;

          // Step 1 (RN parity): X-staff total ALWAYS derived from bookingsByFlight (guests + members)
          const xStaff = Array.isArray(bookingsByFlight?.[fid]) ? bookingsByFlight[fid].length : 0;

          // Crew list remains member-only (unchanged behaviour)
          const crew = resolvedIsLoggedIn ? crewListForFlight(fid) : [];

          const actionCfg = actionConfigForFlight(row?.airline_iata, userListed);

          const busyMode = actionBusyByFlight?.[fid] || null;
          const successState = actionSuccessByFlight?.[fid] || null;

          const todayKey = dateToLocalDateKey(new Date());
          const isDayOfTravel = dateKey === todayKey;

          let tooLateToUnlist = false;
          try {
            const hhmm = extractHHMM(row?.std_local || "") || extractHHMM(row?.std_utc || "");
            if (/^\d{2}:\d{2}$/.test(hhmm) && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
              const stdGuess = new Date(`${dateKey}T${hhmm}:00`);
              const cutoff = new Date(stdGuess.getTime() - 60 * 60 * 1000);
              tooLateToUnlist = Date.now() >= cutoff.getTime();
            }
          } catch {
            // ignore
          }

          const opStatusKey = String(row?.op_status || "").trim().toUpperCase();

          const disableActionButton =
            opStatusKey === "CANCELLED" ||
            busyMode !== null ||
            (userListed && tooLateToUnlist) ||
            (!userListed && isDayOfTravel);

          const actionLabel = (() => {
            if (opStatusKey === "CANCELLED") return "Flight cancelled";
            if (busyMode === "list") return "Listing…";
            if (busyMode === "unlist") return "Unlisting…";
            if (successState === "listed") return "Listed me";
            if (successState === "unlisted") return "Unlisted me";
            return actionCfg.label;
          })();

          // STRICT RN parity: FlightCard3x3 receives RAW API row only (no booking overlays invented here)
          const cardFlight = row;

          const xcm = crew.filter((u) => u.role === "XCM").length;
          const xfa = crew.filter((u) => u.role === "XFA").length;
          const other = crew.filter((u) => u.role !== "XCM" && u.role !== "XFA").length;

          return (
            <div key={f.uiKey} className="card day-flightCard">
              <div className="day-publicSection">
                <FlightCard3x3
                  flight={cardFlight}
                  showHeader={false}
                  footerRightContent={<span className="flightCard-xstaff">X-staff: {xStaff}</span>}
                />
              </div>

              {resolvedIsLoggedIn ? (
                <div className="day-memberArea">
                  {xStaff > 0 ? (
                    <div>
                      <div className="day-zoneSubtitle">Commuter summary</div>

                      <div className="day-zoneRow2">
                        <div className="day-zoneMetaText">XCM : {xcm}</div>
                        <div className="day-zoneMetaText">XFA : {xfa}</div>
                        <div className="day-zoneMetaText">Other : {other}</div>
                      </div>
                    </div>
                  ) : null}

                  {userListed ? (
                    <>
                      <div className="day-zoneDivider" />

                      <div>
                        <div className="day-zoneSubtitle">Listing information</div>

                        {(() => {
                          const me = crew.find((u) => String(u.staffNo || "").trim() === String(psn || "").trim());
                          return (
                            <div className="day-zoneRow2">
                              <div className="day-zoneMetaText">Requested: {formatListedAtDisplay(me?.listedAt)}</div>

                              <div className="day-zoneMetaText">
                                Status:{" "}
                                {me?.status ? (
                                  <>
                                    {me.status}
                                    <img
                                      src={
                                        me.status === "confirmed"
                                          ? LISTING_STATUS_ICONS.booked
                                          : me.status === "sent"
                                          ? LISTING_STATUS_ICONS.sent
                                          : LISTING_STATUS_ICONS.pending
                                      }
                                      alt={me.status}
                                      style={{ width: 20, height: 20, marginLeft: 6, verticalAlign: "middle" }}
                                    />
                                  </>
                                ) : (
                                  "--"
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* RN rule: "All listed commuters" only renders when there are commuters */}
                      {crew.length > 0 ? (
                        <>
                          <div className="day-zoneDivider" />

                          <div>
                            <div className="day-zoneSubtitle">All listed commuters: {crew.length}</div>

                            <div style={{ marginTop: 8 }}>
                              {crew.map((u, idx) => {
                                const isSelf = String(u.staffNo || "").trim() === String(psn || "").trim();

                                return (
                                  <div
                                    key={`${u.staffNo}-${u.listedAt}-${idx}`}
                                    style={{ display: "flex", alignItems: "flex-start" }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "flex-start",
                                        gap: 8,
                                        padding: "3px 0",
                                      }}
                                    >
                                      <div
                                        style={{
                                          width: 28,
                                          fontWeight: 700,
                                          color: "rgba(19,35,51,0.55)",
                                          fontSize: 12,
                                          paddingTop: 1,
                                        }}
                                      >
                                        {`P${idx + 1}.`}
                                      </div>
                                      <div
                                        style={{
                                          flex: 1,
                                          minWidth: 0,
                                          fontWeight: isSelf ? 900 : 700,
                                          color: isSelf ? "#b91c1c" : "rgba(19,35,51,0.80)",
                                          fontSize: 12,
                                        }}
                                      >
                                        {u.fullName}
                                      </div>
                                      <div
                                        style={{
                                          width: 84,
                                          textAlign: "right",
                                          fontWeight: 700,
                                          color: "rgba(19,35,51,0.70)",
                                          fontSize: 12,
                                        }}
                                        title={u.staffNo}
                                      >
                                        {u.staffNo}
                                      </div>
                                      <div
                                        style={{
                                          width: 44,
                                          textAlign: "right",
                                          fontWeight: 700,
                                          color: "rgba(19,35,51,0.70)",
                                          fontSize: 12,
                                        }}
                                        title={u.role || "Other"}
                                      >
                                        {u.role || "Other"}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      ) : null}
                    </>
                  ) : null}

                  {actionCfg.show ? (
                    <>
                      <div className="day-zoneDivider" />

                      <button
                        type="button"
                        onClick={() => openConfirm(userListed ? "unlist" : "list", { flightInstanceId: fid, row })}
                        disabled={disableActionButton || busyMode !== null}
                        className={`day-actionBtn ${userListed ? "day-actionBtnAmber" : "day-actionBtnGreen"}`}
                        style={{
                          width: "70%",
                          alignSelf: "center",
                          opacity: disableActionButton || busyMode !== null ? 0.45 : 1,
                        }}
                      >
                        {actionLabel}
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Confirm modal */}
      {confirmVisible ? (
        <div
          className="day-overlay"
          onClick={() => {
            setConfirmVisible(false);
            setConfirmErrorText("");
          }}
        >
          <div className="day-modalCard" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 900, fontSize: 16, color: "#132333" }}>
              {confirmMode === "list" ? "Confirm listing" : "Confirm unlisting"}
            </div>

            <div style={{ marginTop: 10, color: "rgba(19,35,51,0.75)", fontWeight: 700, lineHeight: "18px" }}>
              {confirmMode === "list"
                ? "You will be added to the crew list. Your position may change."
                : "You will lose your position in the list."}
            </div>

            {confirmErrorText ? (
              <div style={{ marginTop: 10, fontWeight: 900, color: "#b91c1c" }}>{confirmErrorText}</div>
            ) : null}

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                type="button"
                style={{
                  flex: 1,
                  borderRadius: 14,
                  padding: "12px 0",
                  fontWeight: 900,
                  cursor: "pointer",
                  border: "1px solid #d9e2ee",
                  fontSize: 14,
                  background: "#fff",
                  color: "#132333",
                }}
                onClick={() => {
                  setConfirmVisible(false);
                  setConfirmErrorText("");
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                style={{
                  flex: 1,
                  borderRadius: 14,
                  padding: "12px 0",
                  fontWeight: 900,
                  cursor: "pointer",
                  border: "1px solid transparent",
                  fontSize: 14,
                  background: "#132333",
                  color: "#ffffff",
                  opacity: Boolean(confirmMeta?.flightInstanceId && actionBusyByFlight?.[confirmMeta.flightInstanceId])
                    ? 0.55
                    : 1,
                }}
                disabled={Boolean(confirmMeta?.flightInstanceId && actionBusyByFlight?.[confirmMeta.flightInstanceId])}
                onClick={commitConfirm}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Info modal */}
      {infoVisible ? (
        <div className="day-overlay" onClick={() => setInfoVisible(false)}>
          <div className="day-modalCard" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, color: "rgba(19,35,51,0.80)", lineHeight: "18px" }}>
              {infoMeta?.whoLabel || "Your"} security number for flight{" "}
              <span style={{ fontWeight: 900 }}>{infoMeta?.flightNo || ""}</span> on{" "}
              <span style={{ fontWeight: 900 }}>{shortDateForModal}</span> is:{" "}
              <span style={{ fontWeight: 900 }}>
                {infoMeta?.securityNo ? String(infoMeta.securityNo) : "--"}
              </span>
            </div>

            <div style={{ height: 14 }} />

            <div style={{ fontWeight: 700, color: "rgba(19,35,51,0.80)", lineHeight: "18px" }}>
              Status: <span style={{ fontWeight: 900 }}>{infoMeta?.statusText ? String(infoMeta.statusText) : "--"}</span>
            </div>

            <div style={{ height: 14 }} />

            <div style={{ fontWeight: 700, color: "rgba(19,35,51,0.80)", lineHeight: "18px" }}>Booking notes:</div>

            {String(infoMeta?.notesText || "").trim().length > 0 ? (
              <div style={{ fontWeight: 700, color: "rgba(19,35,51,0.80)", lineHeight: "18px", marginTop: 6 }}>
                {String(infoMeta?.notesText || "")}
              </div>
            ) : null}

            <button
              type="button"
              style={{
                marginTop: 14,
                borderRadius: 14,
                padding: "12px 0",
                fontWeight: 900,
                background: "#e8f0ff",
                cursor: "pointer",
                fontSize: 14,
                width: "100%",
                border: "1px solid transparent",
              }}
              onClick={() => setInfoVisible(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
