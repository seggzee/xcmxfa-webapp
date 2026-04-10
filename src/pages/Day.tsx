// src/pages/Day.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../app/authStore";


import FlightCard3x3 from "../components/FlightCard3x3";
import BackButton from "../components/BackButton";
import AirportInfoModal from "../components/AirportInfoModal";
import { getAirportLogo, LISTING_STATUS_ICONS } from "../assets";
import "../styles/day.css";

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

function safeUpper(v: unknown) {
  return String(v || "").trim().toUpperCase();
}

function fmtTimeLocal(dtLike: unknown) {
  if (!dtLike) return "";
  const d = new Date(String(dtLike));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function normalizeBookingStatusStrict(raw: any): "confirmed" | "sent" | "pending" {
  const s = String(raw || "").trim().toLowerCase();
  invariant(Boolean(s), "Invariant violation: booking row missing status");
  invariant(
    s === "confirmed" || s === "sent" || s === "pending",
    `Invariant violation: unexpected booking status "${s}" (expected confirmed|sent|pending)`
  );
  return s as any;
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

/* ----------------------------- Schiphol Ultra overlay (LOCKED) ----------------------------- */
function SchipholOpsPanel({ row }: { row: ApiFlightRow }) {
  const dep = safeUpper(row?.dep_airport);
  const arr = safeUpper(row?.arr_airport);

  const isDepAMS = dep === "AMS";
  const isArrAMS = !isDepAMS && arr === "AMS";
  if (!isDepAMS && !isArrAMS) return null;

  const s = row?.schiphol ?? null;
  if (!s || typeof s !== "object") return null;

  const title = isDepAMS ? "AMS Departure info" : "AMS Arrival info";

  const terminalRaw = String((s as any)?.terminal ?? "").trim();
  const pierRaw = String((s as any)?.pier ?? "").trim();
  const gateRaw = String((s as any)?.gate ?? "").trim();

  const locationParts: string[] = [];
  if (terminalRaw) {
    const t = terminalRaw.toUpperCase().startsWith("T") ? terminalRaw.toUpperCase() : `Terminal ${terminalRaw}`;
    locationParts.push(t);
  }
  if (pierRaw) locationParts.push(`Pier ${pierRaw}`);
  if (gateRaw) locationParts.push(`Gate ${gateRaw}`);
  const locationLine = locationParts.join(" · ");

  const timeParts: string[] = [];
  let movementLine = "";

  if (isDepAMS) {
    const board = fmtTimeLocal((s as any)?.expected_boarding_time_utc);
    const open = fmtTimeLocal((s as any)?.expected_gate_open_utc);
    const close = fmtTimeLocal((s as any)?.expected_gate_closing_utc);
    if (open) timeParts.push(`Open: ${open}`);
    if (board) timeParts.push(`Boarding: ${board}`);
    if (close) timeParts.push(`Close: ${close}`);

    const offb = fmtTimeLocal((s as any)?.actual_off_block_time_utc);
    if (offb) movementLine = `Off-block ${offb}`;
  } else {
    const land = fmtTimeLocal((s as any)?.estimated_landing_time_utc);
    if (land) timeParts.push(`Est. landing ${land}`);
  }

  const timesLine = timeParts.join(" · ");

  const stateRaw = String((s as any)?.public_flight_state ?? "").toUpperCase();
  const stateLabel = (() => {
    if (!stateRaw) return "";
    if (stateRaw.includes("BRD") || stateRaw.includes("BOARD")) return "Boarding";
    if (stateRaw.includes("GCL") || stateRaw.includes("GATECLOS") || stateRaw.includes("GATE_CLOS")) return "Gate closing";
    return "";
  })();

  if (!locationLine && !timesLine && !movementLine && !stateLabel) return null;

  return (
    <div
      style={{
        marginTop: 10,
        borderRadius: 14,
        padding: "10px 12px",
        background: "rgba(232, 240, 255, 0.85)",
        border: "1px solid rgba(19,35,51,0.08)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 900, color: "#132333", fontSize: 13 }}>{title}</div>

        {stateLabel ? (
          <div
            style={{
              fontWeight: 900,
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 999,
              background: "rgba(19,35,51,0.08)",
              color: "rgba(19,35,51,0.85)",
              whiteSpace: "nowrap",
            }}
          >
            {stateLabel}
          </div>
        ) : null}
      </div>

      {locationLine ? (
        <div style={{ marginTop: 6, fontWeight: 800, color: "rgba(19,35,51,0.82)", fontSize: 12 }}>
          {locationLine}
        </div>
      ) : null}

      {timesLine ? (
        <div style={{ marginTop: 6, fontWeight: 800, color: "rgba(19,35,51,0.75)", fontSize: 12 }}>
          {timesLine}
        </div>
      ) : null}

      {movementLine ? (
        <div style={{ marginTop: 6, fontWeight: 800, color: "rgba(19,35,51,0.75)", fontSize: 12 }}>
          {movementLine}
        </div>
      ) : null}
    </div>
  );
}

/* ----------------------------- AMS previous duty modal (NEW, LOCKED RULE) ----------------------------- */

type PrevDutyChoice = "Flight duty" | "Training" | "Simulator" | "Office duty" | "Other";

const PREV_DUTY_CHOICES: PrevDutyChoice[] = ["Flight duty", "Training", "Simulator", "Office duty", "Other"];

function requiresDetails(choice: PrevDutyChoice) {
  return choice === "Flight duty" || choice === "Other";
}

export default function Day() {
  const nav = useNavigate();
  const loc = useLocation();
  const { auth } = useAuth();
  const { dateKey: dateKeyParam } = useParams();

  const airport = (loc.state as any)?.airport;
  invariant(Boolean(airport), "Day: missing airport in navigation state");
  const airportCode = String(airport).toUpperCase();

  const resolvedIsLoggedIn = auth?.mode === "member";

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
      weekday: "short",
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
      // ignore
    }
  };

  // ---- API state ----
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [lastStatusUpdatedUtc, setLastStatusUpdatedUtc] = useState<string | null>(null);
  const [lastScheduleUpdatedUtc, setLastScheduleUpdatedUtc] = useState<string | null>(null);

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
          ensureResp?.meta?.status_last_updated_utc ??
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
        dayResp?.meta?.status_last_updated_utc ??
        dayResp?.last_updated_utc ??
        dayResp?.meta?.last_updated_utc ??
        dayResp?.lastUpdatedUtc ??
        null;
      if (last2) setLastStatusUpdatedUtc(String(last2));

      const sched =
        dayResp?.schedule_last_updated_utc ??
        dayResp?.meta?.schedule_last_updated_utc ??
        dayResp?.scheduleLastUpdatedUtc ??
        dayResp?.meta?.scheduleLastUpdatedUtc ??
        null;
      if (sched) setLastScheduleUpdatedUtc(String(sched));

      // 3) bookings (ALWAYS load)
      try {
        const bookingsResp: any = await getBookingsForDay({ airportCode, dateKey, staffNo: psn });

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
        setErrorText(e?.message || "Failed to load commuter list");
        setBookingsByFlight({});
      }

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
  }, [airportCode, dateKey, psn]);

  type FlightItem = {
    flightInstanceId: string;
    uiKey: string;
    row: ApiFlightRow;
  };

  const flights: FlightItem[] = useMemo(() => {
    const hub = "AMS";
    const airport = String(airportCode || "").toUpperCase();

    const fromApiDepartures = Array.isArray(rawRows?.departures) ? rawRows.departures : null;
    const fromApiArrivals = Array.isArray(rawRows?.arrivals) ? rawRows.arrivals : null;

    let filtered: ApiFlightRow[] = [];
    if (tab === "departures") filtered = fromApiDepartures || [];
    else filtered = fromApiArrivals || [];

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

  function getMyBookingRow(flightInstanceId: string): BookingRow | null {
    if (!resolvedIsLoggedIn) return null;
    const rows = bookingsByFlight?.[flightInstanceId] || [];
    return rows.find((b) => String(b?.psn || "").trim() === String(psn || "").trim()) || null;
  }

  function canShowUnlistButton(flightInstanceId: string): boolean {
    const myRow = getMyBookingRow(flightInstanceId);
    return myRow?.can_unlist === true;
  }

  function getUnlistModeForFlight(flightInstanceId: string): "type1" | "type2" | "none" {
    const myRow = getMyBookingRow(flightInstanceId);
    const mode = String(myRow?.unlist_mode || "").trim().toLowerCase();
    if (mode === "type1") return "type1";
    if (mode === "type2") return "type2";
    return "none";
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

  // ---- AMS previous duty modal state (only used when dep_airport === AMS and listing) ----
  const [amsDutyVisible, setAmsDutyVisible] = useState(false);
  const [amsDutyFlightMeta, setAmsDutyFlightMeta] = useState<{ flightInstanceId: string; row: ApiFlightRow } | null>(
    null
  );
  const [amsDutyChoice, setAmsDutyChoice] = useState<PrevDutyChoice>("Flight duty");
  const [amsDutyDetails, setAmsDutyDetails] = useState("");
  const [amsDutyError, setAmsDutyError] = useState("");

  // ---- Info modal (for ALL listed commuters) ----
  type InfoMeta = {
    fullName: string;
    staffNo: string;
    role: string | null;
    listedAt: string | null;
    status: "confirmed" | "sent" | "pending";
    flightNo: string;
  };

  const [infoVisible, setInfoVisible] = useState(false);
  const [infoMeta, setInfoMeta] = useState<InfoMeta | null>(null);

  const [airportInfoOpen, setAirportInfoOpen] = useState(false);
  const [airportInfoCode, setAirportInfoCode] = useState<string | null>(null);

  function openConfirm(mode: "list" | "unlist", args: { flightInstanceId: string; row: ApiFlightRow }) {
    setConfirmMode(mode);
    setConfirmErrorText("");
    setConfirmMeta({ flightInstanceId: args.flightInstanceId, row: args.row });
    setConfirmVisible(true);
  }

  function openAmsDutyModal(args: { flightInstanceId: string; row: ApiFlightRow }) {
    setAmsDutyFlightMeta(args);
    setAmsDutyChoice("Flight duty");
    setAmsDutyDetails("");
    setAmsDutyError("");
    setAmsDutyVisible(true);
  }

	  
	function openInfoModal(meta: InfoMeta) {
    setInfoMeta(meta);
    setInfoVisible(true);
  }

  function openAirportInfo(codeLike: string | null | undefined) {
    const code = String(codeLike || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 3);

    if (!code) return;

    setAirportInfoCode(code);
    setAirportInfoOpen(true);
  }

  function closeAirportInfo() {
    setAirportInfoOpen(false);
    setAirportInfoCode(null);
  }
  

  function mapBackendErrorToUserMessage(e: any): string {
    // We expect backend to return { ok:false, code, message } and requestJson throws message
    const msg = String(e?.message || "Request failed");

    // Make the known rule failures explicit to the user
    if (msg.toLowerCase().includes("not allowed to have 2 listings")) {
      return "Not allowed to have 2 listings from the same airport on the same day.";
    }
    if (msg.toLowerCase().includes("cutoff")) {
      return "Listing cutoff has passed for this departure station.";
    }
    if (msg.toLowerCase().includes("day of travel")) {
      return "Listing is not allowed on the day of travel.";
    }
    if (msg.toLowerCase().includes("00:30 local")) {
      return "Unlisting is not available after station cutoff until 00:30 local on the day of travel.";
    }
    if (msg.toLowerCase().includes("60 minutes")) {
      return "Unlisting is not allowed within 60 minutes of departure (or after departure).";
    }
    if (msg.toLowerCase().includes("cancelled flight")) {
      return "Action not available: flight is cancelled.";
    }
    return msg;
  }

  async function commitConfirm(extra?: { previous_duty?: string; previous_duty_details?: string }) {
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
        ...(mode === "list" ? extra : null),
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
      setConfirmErrorText(mapBackendErrorToUserMessage(e));
    } finally {
      setActionBusyByFlight((prev) => {
        const next = { ...prev };
        delete next[flightInstanceId];
        return next;
      });
    }
  }

  const onManualRefresh = async () => {
    if (isRefreshing || refreshInFlightRef.current) return;
    setIsRefreshing(true);
    await refreshDay({ showLoading: false });
    startAutoRefreshTimer();
  };

  const databaseLabel = useMemo(() => {
    if (!lastScheduleUpdatedUtc) return "";
    return new Date(lastScheduleUpdatedUtc).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }, [lastScheduleUpdatedUtc]);

  const refreshedLabel = useMemo(() => {
    if (!lastStatusUpdatedUtc) return "";
    return new Date(lastStatusUpdatedUtc).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }, [lastStatusUpdatedUtc]);

  const airportLogoSrc = getAirportLogo(airportCode);

  const metaD = databaseLabel ? `D: ${databaseLabel}` : "";
  const metaR = refreshedLabel ? `R: ${refreshedLabel}` : "";

  const metaHelpText =
    "D = Schedule refresh: when the backend last refreshed scheduled times.\n" +
    "R = Status refresh: when the backend last refreshed live status.";

  return (
    <div className="app-screen">
      <div className="day-sticky">
        <div className="app-container">
          <section className="day-headerCard">
            <div className="day-headerTopRow">
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

                <div className="day-logoCenter">
                {airportLogoSrc ? (
                  <button
                    type="button"
                    className="day-airportLogoBtn"
                    onClick={() => openAirportInfo(airportCode)}
                    aria-label={`Open airport info for ${airportCode}`}
                    title="Airport info"
                  >
                    <img src={airportLogoSrc} alt={`${airportCode} logo`} className="day-airportLogo" />
                  </button>
                ) : null}
              </div>

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

          const xStaff = Array.isArray(bookingsByFlight?.[fid]) ? bookingsByFlight[fid].length : 0;
          const crew = resolvedIsLoggedIn ? crewListForFlight(fid) : [];

          const actionCfg = actionConfigForFlight(row?.airline_iata, userListed);

          const busyMode = actionBusyByFlight?.[fid] || null;
          const successState = actionSuccessByFlight?.[fid] || null;

          const myBooking = getMyBookingRow(fid);
          const canUnlist = canShowUnlistButton(fid);
          const unlistMode = getUnlistModeForFlight(fid);

          const todayKey = dateToLocalDateKey(new Date());
          const isDayOfTravel = dateKey === todayKey;

          const opStatusKey = String(row?.op_status || "").trim().toUpperCase();

          const showActionButton =
            actionCfg.show &&
            (userListed ? canUnlist : !isDayOfTravel);

          const disableActionButton =
            opStatusKey === "CANCELLED" ||
            busyMode !== null;

          const actionLabel = (() => {
            if (opStatusKey === "CANCELLED") return "Flight cancelled";
            if (busyMode === "list") return "Listing…";
            if (busyMode === "unlist") return "Unlisting…";
            if (successState === "listed") return "Listed me";
            if (successState === "unlisted") return "Unlisted me";

            if (userListed) {
              if (unlistMode === "type1") return "Unlist from flight";
              if (unlistMode === "type2") return "Cancel flight listing";
            }

            return actionCfg.label;
          })();

          const cardFlight = row;

          const xcm = crew.filter((u) => u.role === "XCM").length;
          const xfa = crew.filter((u) => u.role === "XFA").length;
          const other = crew.filter((u) => u.role !== "XCM" && u.role !== "XFA").length;

          const willRenderOps =
            (safeUpper(row?.dep_airport) === "AMS" || safeUpper(row?.arr_airport) === "AMS") && Boolean(row?.schiphol);

          const isDepAMS = safeUpper(row?.dep_airport) === "AMS";

          const flightNo = `${String(row?.airline_iata || "").toUpperCase()}${String(row?.flight_number || "").trim()}`.trim();

          return (
            <div key={f.uiKey} className="card day-flightCard">
              <div className="day-publicSection">
                <FlightCard3x3
                  flight={cardFlight}
                  showHeader={false}
                  footerRightContent={<span className="flightCard-xstaff">X-staff: {xStaff}</span>}
                />

                {willRenderOps ? (
                  <>
                    <div className="day-zoneDivider" />
                    <SchipholOpsPanel row={row} />
                  </>
                ) : null}
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

                  {/* Listing information block removed (per confirmed scope) */}

                  {userListed && crew.length > 0 ? (
                    <>
                      <div className="day-zoneDivider" />

                      <div>
                        <div className="day-zoneSubtitle">Listed commuters: {crew.length}</div>

                        <div style={{ marginTop: 8 }}>
                          {crew.map((u, idx) => {
                            const isSelf = String(u.staffNo || "").trim() === String(psn || "").trim();

                            const statusIcon =
                              u.status === "confirmed"
                                ? LISTING_STATUS_ICONS.booked
                                : u.status === "sent"
                                ? LISTING_STATUS_ICONS.sent
                                : LISTING_STATUS_ICONS.pending;

                            return (
                              <div
                                key={`${u.staffNo}-${u.listedAt}-${idx}`}
                                onClick={() =>
                                  openInfoModal({
                                    fullName: u.fullName,
                                    staffNo: u.staffNo,
                                    role: u.role || null,
                                    listedAt: u.listedAt || null,
                                    status: u.status,
                                    flightNo,
                                  })
                                }
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: 10,
                                  padding: "8px 8px",
                                  borderRadius: 12,
                                  background: "rgba(19,35,51,0.04)",
                                  border: "1px solid rgba(19,35,51,0.06)",
                                  marginBottom: 8,
                                  WebkitTapHighlightColor: "rgba(0,0,0,0)",
                                }}
                                aria-label={`Open info for ${u.fullName}`}
                              >
                                <div
                                  style={{
                                    width: 28,
                                    fontWeight: 700,
                                    color: "rgba(19,35,51,0.55)",
                                    fontSize: 12,
                                    paddingTop: 2,
                                    flexShrink: 0,
                                  }}
                                >
                                  {`P${idx + 1}.`}
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontWeight: isSelf ? 900 : 800,
                                      color: isSelf ? "#b91c1c" : "rgba(19,35,51,0.86)",
                                      fontSize: 12,
                                      lineHeight: "16px",
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    {u.fullName}
                                  </div>

                                  <div
                                    style={{
                                      marginTop: 2,
                                      fontWeight: 800,
                                      color: "rgba(19,35,51,0.62)",
                                      fontSize: 12,
                                      lineHeight: "16px",
                                      display: "flex",
                                      gap: 10,
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <span title={u.staffNo}>{u.staffNo}</span>
                                    <span title={u.role || "Other"}>{u.role || "Other"}</span>
                                  </div>
                                </div>

                                <div style={{ width: 22, flexShrink: 0, paddingTop: 1 }}>
                                  <img
                                    src={statusIcon}
                                    alt={u.status}
                                    style={{ width: 20, height: 20, display: "block" }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : null}

                  {showActionButton ? (
                    <>
                      <div className="day-zoneDivider" />

                      <button
                        type="button"
                        onClick={() => {
                          // CANCELLED: no action at all (server also enforces)
                          if (opStatusKey === "CANCELLED") return;

                          if (!userListed && isDepAMS) {
                            // Step 1: open AMS duty modal, which will then open Confirm
                            openAmsDutyModal({ flightInstanceId: fid, row });
                            return;
                          }

                          // Normal flow: confirm list/unlist
                          openConfirm(userListed ? "unlist" : "list", { flightInstanceId: fid, row });
                        }}
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

      {/* AMS previous duty modal */}
      {amsDutyVisible ? (
        <div
          className="day-overlay"
          onClick={() => {
            setAmsDutyVisible(false);
            setAmsDutyError("");
          }}
        >
          <div className="day-modalCard" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 900, fontSize: 16, color: "#132333" }}>Previous duty (AMS)</div>

            <div style={{ marginTop: 10, color: "rgba(19,35,51,0.75)", fontWeight: 700, lineHeight: "18px" }}>
              Required for Amsterdam departures.
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 12, color: "rgba(19,35,51,0.75)", marginBottom: 6 }}>Select duty</div>
              <select
                className="select"
                value={amsDutyChoice}
                onChange={(e) => {
                  const v = e.target.value as PrevDutyChoice;
                  setAmsDutyChoice(v);
                  setAmsDutyError("");
                }}
                style={{ width: "100%" }}
              >
                {PREV_DUTY_CHOICES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {requiresDetails(amsDutyChoice) ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 12, color: "rgba(19,35,51,0.75)", marginBottom: 6 }}>
                  {amsDutyChoice === "Flight duty" ? "Flight number" : "More details"}
                </div>
                <input
                  className="input"
                  value={amsDutyDetails}
                  onChange={(e) => {
                    setAmsDutyDetails(e.target.value);
                    setAmsDutyError("");
                  }}
                  placeholder={amsDutyChoice === "Flight duty" ? "e.g. KL1234" : "Type details"}
                  style={{ width: "100%" }}
                />
              </div>
            ) : null}

            {amsDutyError ? <div style={{ marginTop: 10, fontWeight: 900, color: "#b91c1c" }}>{amsDutyError}</div> : null}

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
                  setAmsDutyVisible(false);
                  setAmsDutyError("");
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
                }}
                onClick={() => {
                  // Local validation mirrors server expectation (server is authoritative)
                  if (requiresDetails(amsDutyChoice) && String(amsDutyDetails || "").trim() === "") {
                    setAmsDutyError(amsDutyChoice === "Flight duty" ? "Flight number required." : "Details required.");
                    return;
                  }

                  // Close this modal, then open confirm in LIST mode for that flight
                  const meta = amsDutyFlightMeta;
                  if (!meta?.flightInstanceId) {
                    setAmsDutyVisible(false);
                    return;
                  }

                  setAmsDutyVisible(false);

                  // Open confirm explicitly as LIST
                  setConfirmMode("list");
                  setConfirmErrorText("");
                  setConfirmMeta({ flightInstanceId: meta.flightInstanceId, row: meta.row });
                  setConfirmVisible(true);
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}

	  
	  
	  
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
              {confirmMode === "list"
                ? "Confirm listing"
                : confirmMeta?.row && getUnlistModeForFlight(confirmMeta.flightInstanceId) === "type2"
                ? "Cancel flight listing"
                : "Unlist from flight"}
            </div>

            {/* ============================================================
               THIS CHANGE ONLY
               - Branch modal body by unlist type
               - Type 1 → internal only warning
               - Type 2 → destructive + airport notification
               ============================================================ */}
            <div style={{ marginTop: 10, color: "rgba(19,35,51,0.75)", fontWeight: 700, lineHeight: "18px", whiteSpace: "pre-line" }}>
              {confirmMode === "list"
                ? "You will be added to the commuter list in order of priority. Your position may change as other xcm/xfa list on the flight."
                : (() => {
                    const mode = confirmMeta?.flightInstanceId
                      ? getUnlistModeForFlight(confirmMeta.flightInstanceId)
                      : "none";

                    if (mode === "type2") {
                      return `\u2022 This will cancel your check-in and flight listing for this flight.\n\n\u2022 The airport will be notified of your cancellation.\n\n\u2022 This action cannot be undone.`;
                    }

                    // default = type1
                    return `\u2022 You will be removed from this flight’s commuter list.\n\n\u2022 Your current position will be lost and may change if you re-list later.`;
                  })()}
            </div>

            {confirmErrorText ? (
              <div style={{ marginTop: 10, fontWeight: 900, color: "#b91c1c" }}>
                {confirmErrorText}
              </div>
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
                  opacity: Boolean(
                    confirmMeta?.flightInstanceId &&
                      actionBusyByFlight?.[confirmMeta.flightInstanceId]
                  )
                    ? 0.55
                    : 1,
                }}
                disabled={Boolean(
                  confirmMeta?.flightInstanceId &&
                    actionBusyByFlight?.[confirmMeta.flightInstanceId]
                )}
                onClick={() => {
                  const meta = confirmMeta;
                  if (!meta?.flightInstanceId) {
                    setConfirmVisible(false);
                    return;
                  }

                  const dep = safeUpper(meta.row?.dep_airport);
                  if (confirmMode === "list" && dep === "AMS") {
                    commitConfirm({
                      previous_duty: amsDutyChoice,
                      previous_duty_details: amsDutyDetails,
                    });
                    return;
                  }

                  commitConfirm();
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}

	  

      {/* Airport info modal */}
	  <AirportInfoModal
        isOpen={airportInfoOpen}
        airportCode={airportInfoCode}
        onClose={closeAirportInfo}
      />

	  
	  
      {/* Info modal (updated per confirmed scope) */}
      {infoVisible ? (
        <div
          className="day-overlay"
          onClick={() => {
            setInfoVisible(false);
            setInfoMeta(null);
          }}
        >
          <div className="day-modalCard" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 900, fontSize: 16, color: "#132333" }}>
              {(infoMeta?.fullName || "").trim() || "Commuter"}{" "}
              <span style={{ fontWeight: 800, color: "rgba(19,35,51,0.70)", fontSize: 13 }}>
                — {infoMeta?.flightNo || ""} — {shortDateForModal}
              </span>
            </div>

            <div style={{ height: 12 }} />

            <div style={{ fontWeight: 800, color: "rgba(19,35,51,0.78)", lineHeight: "18px" }}>
              PSN: <span style={{ fontWeight: 900 }}>{infoMeta?.staffNo || "--"}</span>
            </div>

            <div style={{ height: 8 }} />

            <div style={{ fontWeight: 800, color: "rgba(19,35,51,0.78)", lineHeight: "18px" }}>
              Role: <span style={{ fontWeight: 900 }}>{infoMeta?.role || "Other"}</span>
            </div>

            <div style={{ height: 8 }} />

            <div style={{ fontWeight: 800, color: "rgba(19,35,51,0.78)", lineHeight: "18px" }}>
              Requested: <span style={{ fontWeight: 900 }}>{formatListedAtDisplay(infoMeta?.listedAt || null)}</span>
            </div>

            <div style={{ height: 8 }} />

            <div style={{ fontWeight: 800, color: "rgba(19,35,51,0.78)", lineHeight: "18px" }}>
              Status:{" "}
              <span style={{ fontWeight: 900, textTransform: "capitalize" }}>{infoMeta?.status || "--"}</span>
              {infoMeta?.status ? (
                <img
                  src={
                    infoMeta.status === "confirmed"
                      ? LISTING_STATUS_ICONS.booked
                      : infoMeta.status === "sent"
                      ? LISTING_STATUS_ICONS.sent
                      : LISTING_STATUS_ICONS.pending
                  }
                  alt={infoMeta.status}
                  style={{ width: 20, height: 20, marginLeft: 8, verticalAlign: "middle" }}
                />
              ) : null}
            </div>

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
              onClick={() => {
                setInfoVisible(false);
                setInfoMeta(null);
              }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}