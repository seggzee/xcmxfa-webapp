// src/pages/Day.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../app/authStore";
import FlightCard3x3 from "../components/FlightCard3x3";
import { getAirportLogo } from "../assets";

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

// deterministic placeholder (not real security no)
function securityNoFrom(staffNo: string, flightNo: string) {
  const s = String(staffNo || "");
  const f = String(flightNo || "");
  const a = Number((s.match(/\d+/g) || ["0"]).join("").slice(-4) || 0);
  const b = Number((f.match(/\d+/g) || ["0"]).join("").slice(-3) || 0);
  const n = (a + b) % 1000;
  return String(n).padStart(3, "0");
}

const ICON_SENT = "✉︎";
const ICON_PENDING = "⏳";
function statusIconChar(status: string) {
  if (status === "confirmed") return "✅";
  if (status === "sent") return ICON_SENT;
  return ICON_PENDING;
}
function statusIconStyle(status: string): React.CSSProperties {
  if (status === "sent") return { color: "#d97706" };
  return { color: "rgba(19,35,51,0.65)" };
}

function mapBookingStatusToIconKey(statusAny: any) {
  const s = String(statusAny || "").toLowerCase();
  if (s.includes("confirm") || s.includes("book")) return "confirmed";
  if (s.includes("sent")) return "sent";
  return "pending";
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
  staffNo: string;
  status: "confirmed" | "sent" | "pending";
  notes: string;
  securityNo: string | null;
  listedAt: string | null;
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

  const canGoPrev = useMemo(() => !isBefore(dateKey, minDateKey) && dateKey !== minDateKey, [dateKey, minDateKey]);
  const canGoNext = useMemo(() => !isAfter(dateKey, maxDateKey) && dateKey !== maxDateKey, [dateKey, maxDateKey]);

  const [dateBoundMsg, setDateBoundMsg] = useState("");
  const flashBoundMsg = (msg: string) => {
    setDateBoundMsg(msg);
    window.setTimeout(() => setDateBoundMsg(""), 1200);
  };

  const dateLabel = useMemo(() => {
    const d = new Date(`${dateKey}T00:00:00`);
    return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
  }, [dateKey]);

  const shortDateForModal = useMemo(() => {
    const d = new Date(`${dateKey}T00:00:00`);
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
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

      // 3) bookings (member only; hard-fail invariants)
      if (resolvedIsLoggedIn) {
        try {
          const bookingsResp: any = await getBookingsForDay({ airportCode, dateKey });

          const legacyBy = bookingsResp?.by_flight_instance_id;
          if (legacyBy && typeof legacyBy === "object") {
            Object.keys(legacyBy).forEach((k) => {
              invariant(Boolean(String(k).trim()), "Invariant violation: bookingsByFlight contains empty flight_instance_id key");
            });
            setBookingsByFlight(legacyBy);
          } else {
            const rows: BookingRow[] = Array.isArray(bookingsResp?.rows) ? bookingsResp.rows : [];

            const grouped: Record<string, BookingRow[]> = {};
            rows.forEach((b) => {
              const fid = String(b?.flight_instance_id || "").trim();
              const psnRow = String(b?.psn || "").trim();

              invariant(Boolean(fid), "Invariant violation: booking row missing flight_instance_id");
              invariant(Boolean(psnRow), "Invariant violation: booking row missing psn");

              if (!grouped[fid]) grouped[fid] = [];
              grouped[fid].push(b);
            });

            setBookingsByFlight(grouped);
          }
        } catch (e: any) {
          setErrorText(e?.message || "Failed to load crew list");
          setBookingsByFlight({});
        }
      } else {
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
  // IMPORTANT CHANGE (RN/Home parity for WEB):
  // - We do NOT build a synthetic FlightVM for FlightCard3x3.
  // - We pass the RAW API flight row (snake_case keys) into FlightCard3x3,
  //   exactly like the Home "My Next Flight" pipeline does.
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

  function crewListForFlight(flightInstanceId: string): CrewRow[] {
    const rows = Array.isArray(bookingsByFlight?.[flightInstanceId]) ? bookingsByFlight[flightInstanceId] : [];

    return rows
      .slice()
      .sort((a, b) => {
        const pa = Number(a?.listing_prio);
        const pb = Number(b?.listing_prio);
        if (!Number.isNaN(pa) || !Number.isNaN(pb)) {
          const na = Number.isNaN(pa) ? 9999 : pa;
          const nb = Number.isNaN(pb) ? 9999 : pb;
          if (na !== nb) return na - nb;
        }

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
        const fullName = `${first} ${last}`.trim() || "Member";

        const rawStatus = b?.booking_status ?? b?.status ?? "";

        return {
          bookingId: b?.id,
          role: b?.x_type || null,
          fullName,
          staffNo: rowPsn,
          status: mapBookingStatusToIconKey(rawStatus) as any,
          notes: "",
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
  const [actionSuccessByFlight, setActionSuccessByFlight] = useState<Record<string, "listed" | "unlisted" | null>>({});

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

    invariant(Boolean(String(flightInstanceId || "").trim()), "Invariant violation: missing flight_instance_id at Day write-path");
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
      securityNo: args.u.securityNo || securityNoFrom(args.u.staffNo, args.flightNo),
      statusText: "Booked",
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

  // ----------------------------- styles -----------------------------
  const styles: Record<string, React.CSSProperties> = {
    screen: { minHeight: "100vh", background: "#f6f7f9" },

    stickyPageHeader: {
      position: "sticky",
      top: "var(--appheader-sticky-offset, 86px)",
      zIndex: 40,
      background: "#f6f7f9",
      padding: "8px 14px 10px",
	  marginTop: 0,
	  marginBottom: 0,
    },

    pageHeaderWrap: { background: "#f6f7f9" },

    headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
    headerUpdatedLeft: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" },
    headerUpdatedText: { fontWeight: 800, fontSize: 12, color: "rgba(19,35,51,0.55)", lineHeight: "16px" },

    backBtn: {
      height: 36,
      minWidth: 84,
      borderRadius: 12,
      border: "1px solid #d9e2ee",
      background: "#ffffff",
      fontWeight: 900,
      color: "#132333",
      cursor: "pointer",
    },

    logoRow: { marginTop: 6, display: "flex", justifyContent: "center", alignItems: "center" },
    airportLogo: { width: 168, height: 72, objectFit: "contain" as const },

    tabsWrap: {
      marginTop: 14,
      display: "flex",
      background: "#ffffff",
      border: "1px solid #d9e2ee",
      borderRadius: 14,
      padding: 6,
      gap: 6,
    },
    tabBtn: {
      flex: 1,
      borderRadius: 12,
      padding: "10px 0",
      border: "1px solid transparent",
      background: "transparent",
      cursor: "pointer",
	  fontSize: 14,
      fontWeight: 900,
      color: "rgba(19,35,51,0.55)",
    },
    tabBtnActive: {
      background: "#e9f1ff",
      border: "1px solid #d6e3ff",
      color: "#132333",
    },

    dateStepperRow: {
      marginTop: 8,
      marginBottom: 8,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    dateStepperBtn: {
      width: 48,
      height: 36,
      borderRadius: 12,
      border: "1px solid #d9e2ee",
      background: "#ffffff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
	   fontSize: 14,
      fontWeight: 900,
      color: "#b91c1c",
    },
    headerDateRedCenter: {
      flex: 1,
      margin: "0 10px",
      fontWeight: 900,
      color: "#b91c1c",
      textAlign: "center",
      lineHeight: "16px",
    },

    body: { padding: "12px 14px 28px" },

    flightCard: {
      background: "#ffffff",
      border: "2px solid #d9e2ee",
      borderRadius: 16,
      padding: 10,
      marginBottom: 12,
    },
    publicSection: { paddingBottom: 10 },

    memberArea: {
      marginTop: 10,
      background: "rgba(19,35,51,0.03)",
      borderRadius: 12,
      padding: 10,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    },

    zoneDivider: { marginTop: 12, paddingTop: 12, borderTop: "1px solid #eef2f7" },

    zoneSubtitle: { fontWeight: 900, color: "#132333", fontSize: 12 },
    zoneRow2: { display: "flex", justifyContent: "space-between", gap: 10, marginTop: 6 },
    zoneMetaText: { fontWeight: 700, color: "rgba(19,35,51,0.60)", fontSize: 12 },

    zone5Row: { display: "flex", alignItems: "flex-start", gap: 8, padding: "3px 0" },
    zone5Pos: { width: 28, fontWeight: 700, color: "rgba(19,35,51,0.55)", fontSize: 12, paddingTop: 1 },
    zone5Name: { flex: 1, minWidth: 0, fontWeight: 700, color: "rgba(19,35,51,0.80)", fontSize: 12 },
    zone5NameSelf: { fontWeight: 900, color: "#b91c1c" },
    zone5Staff: { width: 84, textAlign: "right", fontWeight: 700, color: "rgba(19,35,51,0.70)", fontSize: 12 },
    zone5Group: { width: 44, textAlign: "right", fontWeight: 700, color: "rgba(19,35,51,0.70)", fontSize: 12 },

    actionBtn: {
      borderRadius: 14,
      padding: "12px 0",
      textAlign: "center",
      fontWeight: 900,
      color: "#132333",
      cursor: "pointer",
      border: "1.5px solid transparent",
      background: "transparent",
    },
    actionBtnGreen: { background: "rgba(34,197,94,0.18)", borderColor: "rgba(34,197,94,0.35)" },
    actionBtnAmber: { background: "rgba(245,158,11,0.16)", borderColor: "rgba(245,158,11,0.35)" },

    overlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 18,
      zIndex: 80,
    },
    modalCard: { width: "100%", maxWidth: 520, background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #d9e2ee" },
    modalTitle: { fontWeight: 900, fontSize: 16, color: "#132333" },
    modalBody: { marginTop: 10, color: "rgba(19,35,51,0.75)", fontWeight: 700, lineHeight: "18px" },
    modalErrorText: { marginTop: 10, fontWeight: 900, color: "#b91c1c" },
    modalBtns: { display: "flex", gap: 10, marginTop: 14 },
    modalBtn: { flex: 1, borderRadius: 14, padding: "12px 0", fontWeight: 900, cursor: "pointer", border: "1px solid transparent" },
    modalBtnGhost: { background: "#fff", borderColor: "#d9e2ee", color: "#132333" },
    modalBtnPrimary: { background: "#132333", color: "#ffffff" },

    infoText: { fontWeight: 700, color: "rgba(19,35,51,0.80)", lineHeight: "18px" },
    infoCloseBtn: { marginTop: 14, borderRadius: 14, padding: "12px 0", fontWeight: 900, background: "#e8f0ff", cursor: "pointer" },

    rowLine1: { display: "flex", alignItems: "center", gap: 8 },
    rowLine2: { display: "flex", alignItems: "center", marginTop: 4 },
    listRowTwoLine: { padding: "8px 0" },
    listRowDivider: { borderBottom: "1px solid #eef2f7" },
    listRowSelf: { background: "rgba(185,28,28,0.06)", borderRadius: 10, padding: 8 },

    listIndex: { width: 26, fontWeight: 900, color: "rgba(19,35,51,0.55)" },
    nameWrap: { flex: 1, minWidth: 0 },
    listNameTwoLine: { fontWeight: 900, color: "#132333" },
    listStatusIcon: { fontWeight: 900, fontSize: 16, cursor: "pointer", userSelect: "none" as const },
    staffIndentSpacer: { width: 26 },
    listStaffNoTwoLine: { fontWeight: 800, color: "rgba(19,35,51,0.65)" },
  };

  return (
    <div style={styles.screen}>
      <div style={styles.stickyPageHeader}>
        <div style={styles.pageHeaderWrap}>
          <div style={styles.headerRow}>
            <div style={styles.headerUpdatedLeft}>
              {loading || isRefreshing ? (
                <div style={styles.headerUpdatedText}>Updating…</div>
              ) : errorText ? (
                <div style={styles.headerUpdatedText} title={errorText}>
                  {errorText}
                </div>
              ) : (
                <>
                  {databaseLabel ? <div style={styles.headerUpdatedText}>Database {databaseLabel}</div> : null}
                  {refreshedLabel ? (
                    <div style={styles.headerUpdatedText}>Refreshed {refreshedLabel}</div>
                  ) : (
                    <div style={styles.headerUpdatedText}> </div>
                  )}
                </>
              )}

              {dateBoundMsg ? (
                <div style={{ ...styles.headerUpdatedText, color: "#b91c1c" }} title={dateBoundMsg}>
                  {dateBoundMsg}
                </div>
              ) : null}

				{/* Web-only equivalent of pull-to-refresh (kept small)====NOT USED HERE=========== 
				  <button
					type="button"
					onClick={onManualRefresh}
					disabled={Boolean(isRefreshing || refreshInFlightRef.current)}
					style={{
					  marginTop: 6,
					  width: 96,
					  height: 28,
					  borderRadius: 10,
					  border: "1px solid #d9e2ee",
					  background: "#ffffff",
					  fontWeight: 900,
					  color: "#132333",
					  cursor: "pointer",
					  opacity: isRefreshing || refreshInFlightRef.current ? 0.6 : 1,
					}}
				  >
					Refresh
				  </button>
				================================================================*/}
            </div>

            <button type="button" style={styles.backBtn} onClick={() => nav(-1)}>
              Back
            </button>
          </div>

          <div style={styles.logoRow}>
            {airportLogoSrc ? <img src={airportLogoSrc} alt={`${airportCode} logo`} style={styles.airportLogo} /> : null}
          </div>

          <div style={styles.tabsWrap}>
            <button
              type="button"
              onClick={() => {
                setTab("departures");
                nav(`/day/${dateKey}?tab=departures`, { state: { airport: airportCode }, replace: true });
              }}
              style={{ ...styles.tabBtn, ...(tab === "departures" ? styles.tabBtnActive : null) }}
            >
              Departures
            </button>

            <button
              type="button"
              onClick={() => {
                setTab("arrivals");
                nav(`/day/${dateKey}?tab=arrivals`, { state: { airport: airportCode }, replace: true });
              }}
              style={{ ...styles.tabBtn, ...(tab === "arrivals" ? styles.tabBtnActive : null) }}
            >
              Arrivals
            </button>
          </div>

          <div style={styles.dateStepperRow}>
            <button
              type="button"
              onClick={() => stepDateKey(-1)}
              disabled={!canGoPrev}
              style={{ ...styles.dateStepperBtn, opacity: canGoPrev ? 1 : 0.35 }}
            >
              {prevDowShort}
            </button>

            <div style={styles.headerDateRedCenter}>{dateLabel}</div>

            <button
              type="button"
              onClick={() => stepDateKey(1)}
              disabled={!canGoNext}
              style={{ ...styles.dateStepperBtn, opacity: canGoNext ? 1 : 0.35 }}
            >
              {nextDowShort}
            </button>
          </div>
        </div>
      </div>

      <div style={styles.body}>
        {flights.map((f) => {
          const fid = f.flightInstanceId;
          const row = f.row || {};

          const userListed = resolvedIsLoggedIn ? isUserListed(fid) : false;

          const crew = resolvedIsLoggedIn ? crewListForFlight(fid) : [];
          const xStaff = crew.length;

          const myBookingRow = (() => {
            if (!resolvedIsLoggedIn) return null;
            const rows = Array.isArray(bookingsByFlight?.[fid]) ? bookingsByFlight[fid] : [];
            return rows.find((b) => String(b?.psn || "").trim() === String(psn || "").trim()) || null;
          })();

          const myListingStatus = myBookingRow ? String(myBookingRow?.booking_status ?? myBookingRow?.status ?? "").trim() : "";
          const listPos = myBookingRow?.list_position ?? null;
          const listTotal = myBookingRow?.list_total ?? null;

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

          // RAW payload into FlightCard3x3, with ONLY the booking overlays added (still same schema).
          const cardFlight = {
            ...row,
            listing_status: myListingStatus || row?.listing_status || "",
            list_position: listPos ?? row?.list_position ?? null,
            list_total: listTotal ?? row?.list_total ?? null,
          };

          const xcm = crew.filter((u) => u.role === "XCM").length;
          const xfa = crew.filter((u) => u.role === "XFA").length;
          const other = crew.filter((u) => u.role !== "XCM" && u.role !== "XFA").length;

          return (
            <div key={f.uiKey} style={styles.flightCard}>
              <div style={styles.publicSection}>
                <FlightCard3x3 flight={cardFlight} showHeader={false} />
              </div>

              {resolvedIsLoggedIn ? (
                <div style={styles.memberArea}>
                  <div>
                    <div style={styles.zoneSubtitle}>Commuter summary</div>

                    <div style={styles.zoneRow2}>
                      <div style={styles.zoneMetaText}>XCM : {xcm}</div>
                      <div style={styles.zoneMetaText}>XFA : {xfa}</div>
                      <div style={styles.zoneMetaText}>Other : {other}</div>
                    </div>

                    <div style={{ marginTop: 6 }}>
                      <div style={styles.zoneMetaText}>Total listed: {xStaff}</div>
                    </div>
                  </div>

                  {userListed ? (
                    <>
                      <div style={styles.zoneDivider} />

                      <div>
                        <div style={styles.zoneSubtitle}>Listing information</div>

                        {(() => {
                          const me = crew.find((u) => String(u.staffNo || "").trim() === String(psn || "").trim());
                          return (
                            <div style={styles.zoneRow2}>
                              <div style={styles.zoneMetaText}>Requested: {me?.listedAt ? String(me.listedAt) : "--"}</div>
                              <div style={styles.zoneMetaText}>Status: {me?.status ? String(me.status) : "--"}</div>
                            </div>
                          );
                        })()}
                      </div>

                      <div style={styles.zoneDivider} />

                      <div>
                        <div style={styles.zoneSubtitle}>All listed commuters: {crew.length || 0}</div>

                        <div style={{ marginTop: 8 }}>
                          {crew.length === 0 ? (
                            <div style={styles.zoneMetaText}>--</div>
                          ) : (
                            crew.map((u, idx) => {
                              const isSelf = String(u.staffNo || "").trim() === String(psn || "").trim();

                              return (
                                <div key={`${u.staffNo}-${u.listedAt}-${idx}`} style={{ display: "flex", alignItems: "flex-start" }}>
                                  <div style={styles.zone5Row}>
                                    <div style={styles.zone5Pos}>{`P${idx + 1}.`}</div>
                                    <div style={{ ...styles.zone5Name, ...(isSelf ? styles.zone5NameSelf : null) }}>{u.fullName}</div>
                                    <div style={styles.zone5Staff} title={u.staffNo}>
                                      {u.staffNo}
                                    </div>
                                    <div style={styles.zone5Group} title={u.role || "Other"}>
                                      {u.role || "Other"}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Crew list rows w/ status icon press -> info modal (RN feature) */}
                        <div style={{ marginTop: 10 }}>
                          {crew.map((u, idx) => {
                            const isSelf = String(u.staffNo || "").trim() === String(psn || "").trim();
                            const isLast = idx === crew.length - 1;

                            // derive a display flight number for the info modal (best-effort, UI only)
                            const displayFlightNo = (() => {
                              const a = String(row?.airline_iata || "").trim();
                              const n = String(row?.flight_number || "").trim();
                              const merged = `${a}${n}`.trim();
                              return merged || String(row?.flight_no || "").trim() || "";
                            })();

                            return (
                              <div
                                key={`crewrow-${fid}-${u.staffNo}-${idx}`}
                                style={{
                                  ...styles.listRowTwoLine,
                                  ...(isSelf ? styles.listRowSelf : null),
                                  ...(!isLast ? styles.listRowDivider : null),
                                }}
                              >
                                <div style={styles.rowLine1}>
                                  <div style={styles.listIndex}>{idx + 1}</div>

                                  <div style={styles.nameWrap}>
                                    <div style={styles.listNameTwoLine}>{u.fullName}</div>
                                  </div>

                                  <div
                                    style={{ ...styles.listStatusIcon, ...statusIconStyle(u.status) }}
                                    onClick={() => openInfoModal({ flightNo: displayFlightNo, u, isSelf, notesText: "" })}
                                    title="Listing info"
                                  >
                                    {statusIconChar(u.status)}
                                  </div>
                                </div>

                                <div style={styles.rowLine2}>
                                  <div style={styles.staffIndentSpacer} />
                                  <div style={styles.listStaffNoTwoLine}>{u.staffNo}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : null}

                  {actionCfg.show ? (
                    <>
                      <div style={styles.zoneDivider} />

                      <button
                        type="button"
                        onClick={() => openConfirm(userListed ? "unlist" : "list", { flightInstanceId: fid, row })}
                        disabled={disableActionButton || busyMode !== null}
                        style={{
                          ...styles.actionBtn,
                          ...(userListed ? styles.actionBtnAmber : styles.actionBtnGreen),
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
          style={styles.overlay}
          onClick={() => {
            setConfirmVisible(false);
            setConfirmErrorText("");
          }}
        >
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>{confirmMode === "list" ? "Confirm listing" : "Confirm unlisting"}</div>

            <div style={styles.modalBody}>
              {confirmMode === "list"
                ? "You will be added to the crew list. Your position may change."
                : "You will lose your position in the list."}
            </div>

            {confirmErrorText ? <div style={styles.modalErrorText}>{confirmErrorText}</div> : null}

            <div style={styles.modalBtns}>
              <button
                type="button"
                style={{ ...styles.modalBtn, ...styles.modalBtnGhost }}
                onClick={() => {
                  setConfirmVisible(false);
                  setConfirmErrorText("");
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                style={{ ...styles.modalBtn, ...styles.modalBtnPrimary }}
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
        <div style={styles.overlay} onClick={() => setInfoVisible(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.infoText}>
              {infoMeta?.whoLabel || "Your"} security number for flight{" "}
              <span style={{ fontWeight: 900 }}>{infoMeta?.flightNo || ""}</span> on{" "}
              <span style={{ fontWeight: 900 }}>{shortDateForModal}</span> is:{" "}
              <span style={{ fontWeight: 900 }}>{infoMeta?.securityNo || ""}</span>
            </div>

            <div style={{ height: 14 }} />

            <div style={styles.infoText}>
              Status: <span style={{ fontWeight: 900 }}>{infoMeta?.statusText || "Booked"}</span>
            </div>

            <div style={{ height: 14 }} />

            <div style={styles.infoText}>Booking notes:</div>

            {String(infoMeta?.notesText || "").trim().length > 0 ? (
              <div style={{ ...styles.infoText, marginTop: 6 }}>{String(infoMeta?.notesText || "")}</div>
            ) : null}

            <button type="button" style={styles.infoCloseBtn} onClick={() => setInfoVisible(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
