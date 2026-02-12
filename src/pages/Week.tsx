// src/pages/Week.tsx
import React from "react";
import { useAuth } from "../app/authStore";
import { getAirportWindowFlights } from "../api/flightsApi";
import { APP_IMAGES, UI_ICONS, getAirportLogo } from "../assets";

const WINDOW_DAYS = 9;
const SCHEDULE_MAX_AGE_MS = 3 * 60 * 60 * 1000; // 3 hours

type WeeklyMode = "classic" | "compact";

type WindowFlight = {
  dep_airport: string;
  arr_airport: string;
  std_local?: string | null;
  sta_local?: string | null;
  [k: string]: unknown;
};

export type WeeklyDayItem = {
  key: string;
  dateKey: string; // YYYY-MM-DD
  date: Date;
  dow: string;
  day: string;
  mon: string;
  arrivals: number;
  departures: number;
};

type WindowCacheRecord = {
  savedAtMs: number;
  airportCode: string;
  startLocalDate: string;
  days: number;
  flights: WindowFlight[];
  scheduleLastUpdatedUtc: string | null;
};

export default function Week(props: {
  airportCode: string;
  onBack?: () => void;
  onOpenDayArrivals?: (item: WeeklyDayItem) => void;
  onOpenDayDepartures?: (item: WeeklyDayItem) => void;
}) {
  useAuth();

  const airportCode = String(props.airportCode || "").toUpperCase();
  if (!airportCode) throw new Error("Week: airportCode is required");

  const [mode, setMode] = React.useState<WeeklyMode>("classic");
  const [loading, setLoading] = React.useState(true);
  const [errorText, setErrorText] = React.useState("");
  const [windowMeta, setWindowMeta] = React.useState<{ schedule_last_updated_utc: string | null }>({
    schedule_last_updated_utc: null,
  });
  const [refreshedAtMs, setRefreshedAtMs] = React.useState<number | null>(null);
  const [days, setDays] = React.useState<WeeklyDayItem[]>([]);

  const startLocalDate = React.useMemo(() => dateToLocalDateKey(new Date()), []);

  const openArrivals = React.useCallback(
    (item: WeeklyDayItem) => {
      if (typeof props.onOpenDayArrivals === "function") props.onOpenDayArrivals(item);
    },
    [props]
  );

  const openDepartures = React.useCallback(
    (item: WeeklyDayItem) => {
      if (typeof props.onOpenDayDepartures === "function") props.onOpenDayDepartures(item);
    },
    [props]
  );

  React.useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErrorText("");

      try {
        const cached = getCachedWindow({ airportCode, startLocalDate, days: WINDOW_DAYS });
        const cacheUsable = cached && !isWindowStale(cached, { maxAgeMs: SCHEDULE_MAX_AGE_MS });

        if (cacheUsable) {
          const nextDays = buildDaysFromFlights({
            airportCode,
            startLocalDate,
            windowDays: WINDOW_DAYS,
            flights: cached.flights,
          });

          if (!alive) return;
          setWindowMeta({ schedule_last_updated_utc: cached.scheduleLastUpdatedUtc || null });
          setDays(nextDays);
          setLoading(false);
          setRefreshedAtMs(cached.savedAtMs || Date.now());
          return;
        }

        const resp: any = await getAirportWindowFlights({
          airportCode,
          startLocalDate,
          days: WINDOW_DAYS,
        });

        const departures = Array.isArray(resp?.departures) ? resp.departures : [];
        const arrivals = Array.isArray(resp?.arrivals) ? resp.arrivals : [];
        const flights: WindowFlight[] = Array.isArray(resp?.flights) ? resp.flights : [...departures, ...arrivals];

        const scheduleLastUpdatedUtc: string | null =
          resp?.meta?.last_updated_utc ??
          resp?.schedule_last_updated_utc ??
          resp?.scheduleLastUpdatedUtc ??
          null;

        const record = setCachedWindow({
          airportCode,
          startLocalDate,
          days: WINDOW_DAYS,
          flights,
          scheduleLastUpdatedUtc,
        });

        const nextDays = buildDaysFromFlights({
          airportCode,
          startLocalDate,
          windowDays: WINDOW_DAYS,
          flights: record.flights,
        });

        if (!alive) return;
        setWindowMeta({ schedule_last_updated_utc: scheduleLastUpdatedUtc });
        setDays(nextDays);
        setLoading(false);
        setRefreshedAtMs(Date.now());
      } catch (e: any) {
        if (!alive) return;
        setErrorText(e?.message || "Failed to load flights");
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [airportCode, startLocalDate]);

  const rangeLabel = React.useMemo(() => {
    const first = days[0]?.date;
    const last = days[days.length - 1]?.date;
    if (!first || !last) return "";
    const f = first.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    const l = last.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    return `${f} – ${l}`;
  }, [days]);

  const refreshedLabel = React.useMemo(() => {
    if (!refreshedAtMs) return "";
    return new Date(refreshedAtMs).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }, [refreshedAtMs]);

  const databaseLabel = React.useMemo(() => {
    if (!windowMeta.schedule_last_updated_utc) return "";
    return new Date(windowMeta.schedule_last_updated_utc).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [windowMeta.schedule_last_updated_utc]);

  const airportLogoSrc = getAirportLogo(airportCode) || APP_IMAGES.APP_LOGO;

  // Icons (RN: UI_ICONS.arrivals/departures, with arrow fallback if missing)
  const arrivalsSrc = UI_ICONS?.arrivals || null;
  const departuresSrc = UI_ICONS?.departures || null;

  // Calendar snippet exists in /public/assets/icons/calendar.webp (confirmed)
  const calendarSnippetSrc = "/assets/icons/calendar.webp";

  // Styles
  const styles: Record<string, React.CSSProperties> = {
    screen: { minHeight: "100vh", background: "#f6f7f9" },

    stickyPageHeader: {
      position: "sticky",
      top: "var(--appheader-sticky-offset, 86px)",
      zIndex: 40,
      background: "#f6f7f9",
      padding: "10px 16px 0",
    },

    headerCard: {
      border: "2px solid #e6e9ee",
      background: "#ffffff",
      borderRadius: 18,
      padding: 14,
      paddingTop: 1,
      marginBottom: 14,
    },
    headerTopRow: { display: "flex", alignItems: "center", justifyContent: "space-between" },

    headerLogo: { width: 100, height: 100, objectFit: "contain" },

    headerCode: { flex: 1, textAlign: "center", fontSize: 30, fontWeight: 800, color: "#111827" },

    backPill: {
      background: "#e9f1ff",
      padding: "10px 16px",
      borderRadius: 999,
      border: "1px solid #d6e3ff",
      fontWeight: 700,
      color: "#111827",
      cursor: "pointer",
    },

    range: { marginTop: 1, color: "#6b7280", fontSize: 16, fontWeight: 600, textAlign: "center" },

    updatedMetaWrap: { marginTop: 6, textAlign: "center" },
    updatedMetaLine: { color: "#9ca3af", fontSize: 13, fontWeight: 700, lineHeight: "16px" },

    // selector: less rounded + less padding (closer to RN screenshot)
    modeToggle: {
      marginTop: 14,
      border: "1px solid #d6e3ff",
      background: "#ffffff",
      borderRadius: 14,
      padding: 6,
      display: "flex",
      gap: 6,
    },
    modeOption: {
      flex: 1,
      borderRadius: 12,
      padding: "8px 0",
      fontSize: 14,
      fontWeight: 800,
      border: "1px solid transparent",
      background: "transparent",
      color: "#9ca3af",
      cursor: "pointer",
    },
    modeOptionActive: { background: "#e9f1ff", border: "1px solid #d6e3ff", color: "#111827" },

    body: { padding: 16, paddingTop: 0, paddingBottom: 28 },

    classicGrid: {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 12,
    },
    classicCard: {
      width: "31.5%",
      borderRadius: 18,
      border: "2px solid #e6e9ee",
      background: "#ffffff",
      padding: "10px 8px",
      minHeight: 150,
      position: "relative",
      overflow: "hidden",
      boxSizing: "border-box",
    },

    // Calendar snippet + overlay
    calendarWrap: {
      width: "100%",
      height: 118,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 2,
      paddingBottom: 24,
      position: "relative",
    },
    calendarImage: { width: "100%", height: 118, objectFit: "contain" },

    calendarTextOverlay: {
	  position: "absolute",
	  inset: 0,
	  bottom: 24,
	  display: "flex",
	  flexDirection: "column",
	  alignItems: "center",
	  justifyContent: "center",
	  textAlign: "center",
	  pointerEvents: "none",
	},

    // Tweaked to better align on web with the snippet scaling
   calDow: { 
  position: "absolute", 
  top: 15, 
  color: "#ffffff", 
  fontSize: 13, 
  fontWeight: 900,
  width: "100%",
  textAlign: "center"
},

    calMonth: { 
  color: "#d96a79", 
  fontWeight: 900, 
  fontSize: 15, 
  marginTop: 20,
  width: "100%",
  textAlign: "center"
},
    calDayNum: { 
  color: "#d96a79", 
  fontWeight: 900, 
  fontSize: 25, 
  marginTop: 0,
  width: "100%",
  textAlign: "center"
},

    cornerSlot: {
      position: "absolute",
      bottom: 2,
      width: 42,
      height: 42,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    cornerSlotLeft: { left: 6 },
    cornerSlotRight: { right: 6 },

    iconTap: {
      width: 38,
      height: 38,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "transparent",
      border: 0,
      cursor: "pointer",
      padding: 0,
    },

    planeIcon: { width: 26, height: 26, objectFit: "contain" as const },

    fallbackArrow: { fontSize: 18, fontWeight: 900, color: "#111827", lineHeight: "18px" },
    floatCount: { position: "absolute", top: -6, fontSize: 16, fontWeight: 600, color: "#9ca3af" },
    floatCountNW: { left: -2 },
    floatCountNE: { right: -2 },

    compactStack: { display: "flex", flexDirection: "column", gap: 12 },

    compactDayCard: {
      borderRadius: 18,
      border: "2px solid #e6e9ee",
      background: "#ffffff",
      padding: "14px 16px",
    },
    compactDayHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 12,
    },
    compactDayDate: { flex: 1, minWidth: 0, fontSize: 18, fontWeight: 900, color: "#111827" },
    compactDayWeek: { color: "#d96a79", fontWeight: 900 },
    compactDayMonthDate: { color: "#d96a79", fontWeight: 900 },
    compactTotalPill: {
      border: "1px solid #e6e9ee",
      background: "#f3f6fb",
      borderRadius: 999,
      padding: "8px 12px",
      fontWeight: 800,
      color: "#111827",
      fontSize: 14,
      whiteSpace: "nowrap",
    },
    compactDayBody: { display: "flex" },

    compactMiniCard: {
      flex: 1,
      minWidth: 0,
      border: "1px solid #e6e9ee",
      background: "#ffffff",
      borderRadius: 14,
      padding: "12px 12px",
      display: "flex",
      alignItems: "center",
      cursor: "pointer",
    },
    compactMiniCardLeft: { marginRight: 12 },
    compactMiniIconWrap: {
      width: 34,
      height: 34,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
    },
    compactMiniText: { flex: 1, minWidth: 0 },
    compactMiniCount: { fontSize: 20, fontWeight: 600, color: "#111827", lineHeight: "22px" },
    compactMiniLabel: { fontSize: 13, fontWeight: 600, color: "#6b7280", marginTop: 2 },
  };

  return (
    <div style={styles.screen}>
      <div style={styles.stickyPageHeader}>
        <section style={styles.headerCard}>
          <div style={styles.headerTopRow}>
            <img src={airportLogoSrc} alt={`${airportCode} logo`} style={styles.headerLogo} />

            <div style={styles.headerCode}>{airportCode}</div>

            <button
              type="button"
              style={styles.backPill}
              onClick={() => {
                if (typeof props.onBack === "function") props.onBack();
              }}
            >
              Back
            </button>
          </div>

          <div style={styles.range}>{rangeLabel}</div>

          <div style={styles.updatedMetaWrap}>
            {loading ? (
              <div style={styles.updatedMetaLine}>Loading schedule…</div>
            ) : errorText ? (
              <div style={styles.updatedMetaLine} title={errorText}>
                {errorText}
              </div>
            ) : (
              <>
                {!!databaseLabel && <div style={styles.updatedMetaLine}>Database {databaseLabel}</div>}
                {!!refreshedLabel && <div style={styles.updatedMetaLine}>Refreshed {refreshedLabel}</div>}
              </>
            )}
          </div>

          <div style={styles.modeToggle}>
            <button
              type="button"
              style={{ ...styles.modeOption, ...(mode === "classic" ? styles.modeOptionActive : null) }}
              onClick={() => setMode("classic")}
            >
              Classic
            </button>
            <button
              type="button"
              style={{ ...styles.modeOption, ...(mode === "compact" ? styles.modeOptionActive : null) }}
              onClick={() => setMode("compact")}
            >
              Compact
            </button>
          </div>
        </section>
      </div>

      <div style={styles.body}>
        {mode === "classic" ? (
          <div style={styles.classicGrid}>
            {days.map((item) => (
              <div key={item.key} style={styles.classicCard}>
                <div style={styles.calendarWrap}>
                  <img src={calendarSnippetSrc} alt="" style={styles.calendarImage} />
                  <div style={styles.calendarTextOverlay}>
                    <div style={styles.calDow}>{item.date.toLocaleDateString("en-GB", { weekday: "long" })}</div>
                    <div style={styles.calMonth}>{item.date.toLocaleDateString("en-GB", { month: "long" })}</div>
                    <div style={styles.calDayNum}>{String(item.day)}</div>
                  </div>
                </div>

                <div style={{ ...styles.cornerSlot, ...styles.cornerSlotLeft }}>
                  <button type="button" style={styles.iconTap} onClick={() => openDepartures(item)} aria-label="Departures">
                    {departuresSrc ? (
                      <img src={departuresSrc} alt="" style={styles.planeIcon} />
                    ) : (
                      <span style={styles.fallbackArrow}>↑</span>
                    )}
                  </button>
                  <div style={{ ...styles.floatCount, ...styles.floatCountNW }}>{item.departures}</div>
                </div>

                <div style={{ ...styles.cornerSlot, ...styles.cornerSlotRight }}>
                  <button type="button" style={styles.iconTap} onClick={() => openArrivals(item)} aria-label="Arrivals">
                    {arrivalsSrc ? (
                      <img src={arrivalsSrc} alt="" style={styles.planeIcon} />
                    ) : (
                      <span style={styles.fallbackArrow}>↓</span>
                    )}
                  </button>
                  <div style={{ ...styles.floatCount, ...styles.floatCountNE }}>{item.arrivals}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.compactStack}>
            {days.map((item) => {
              const total = (Number(item.arrivals) || 0) + (Number(item.departures) || 0);
              const weekdayLabel = item.date.toLocaleDateString("en-GB", { weekday: "short" });
              const dayMonthLabel = item.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

              return (
                <div key={item.key} style={styles.compactDayCard}>
                  <div style={styles.compactDayHeader}>
                    <div style={styles.compactDayDate}>
                      <span style={styles.compactDayWeek}>{weekdayLabel} </span>
                      <span style={styles.compactDayMonthDate}>{dayMonthLabel}</span>
                    </div>
                    <div style={styles.compactTotalPill}>Total {total}</div>
                  </div>

                  <div style={styles.compactDayBody}>
                    <button
                      type="button"
                      style={{ ...styles.compactMiniCard, ...styles.compactMiniCardLeft }}
                      onClick={() => openArrivals(item)}
                      aria-label="Arrivals"
                    >
                      <div style={styles.compactMiniIconWrap}>
                        {arrivalsSrc ? <img src={arrivalsSrc} alt="" style={styles.planeIcon} /> : <span style={styles.fallbackArrow}>↓</span>}
                      </div>
                      <div style={styles.compactMiniText}>
                        <div style={styles.compactMiniCount}>{item.arrivals}</div>
                        <div style={styles.compactMiniLabel}>Arrivals</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      style={styles.compactMiniCard}
                      onClick={() => openDepartures(item)}
                      aria-label="Departures"
                    >
                      <div style={styles.compactMiniIconWrap}>
                        {departuresSrc ? (
                          <img src={departuresSrc} alt="" style={styles.planeIcon} />
                        ) : (
                          <span style={styles.fallbackArrow}>↑</span>
                        )}
                      </div>
                      <div style={styles.compactMiniText}>
                        <div style={styles.compactMiniCount}>{item.departures}</div>
                        <div style={styles.compactMiniLabel}>Departures</div>
                      </div>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ================= helpers =================

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function dateToLocalDateKey(d: Date) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function dateKeyToDate(dateKey: string) {
  if (!dateKey || typeof dateKey !== "string") return new Date();
  return new Date(`${dateKey}T00:00:00`);
}

function buildDaysFromFlights(args: {
  airportCode: string;
  startLocalDate: string;
  windowDays: number;
  flights: WindowFlight[];
}): WeeklyDayItem[] {
  const byDay = groupWindowByDayExactRNFallback(args.flights, args.airportCode);

  return Array.from({ length: args.windowDays }).map((_, i) => {
    const d = new Date(`${args.startLocalDate}T00:00:00`);
    d.setDate(d.getDate() + i);
    const dk = dateToLocalDateKey(d);
    const bucket = byDay[dk] || { arrivals: [], departures: [] };

    return {
      key: dk,
      dateKey: dk,
      date: dateKeyToDate(dk),
      dow: d.toLocaleDateString("en-GB", { weekday: "short" }),
      day: String(d.getDate()),
      mon: d.toLocaleDateString("en-GB", { month: "short" }),
      arrivals: bucket.arrivals.length,
      departures: bucket.departures.length,
    };
  });
}

function groupWindowByDayExactRNFallback(flights: WindowFlight[], airportCode: string) {
  const byDay: Record<string, { arrivals: WindowFlight[]; departures: WindowFlight[] }> = {};
  if (!Array.isArray(flights)) return byDay;

  for (const f of flights) {
    if (!f) continue;

    const dep = String(f.dep_airport || "");
    const arr = String(f.arr_airport || "");

    const isDeparture = dep === airportCode && arr === "AMS";
    const isArrival = dep === "AMS" && arr === airportCode;
    if (!isDeparture && !isArrival) continue;

    const dt = isDeparture ? f.std_local : f.sta_local;
    if (!dt || typeof dt !== "string" || dt.length < 10) continue;

    const dayKey = dt.slice(0, 10);
    if (!byDay[dayKey]) byDay[dayKey] = { arrivals: [], departures: [] };

    if (isDeparture) byDay[dayKey].departures.push(f);
    if (isArrival) byDay[dayKey].arrivals.push(f);
  }

  return byDay;
}

function cacheKey(args: { airportCode: string; startLocalDate: string; days: number }) {
  return `xcmxfa:window:${args.airportCode}:${args.startLocalDate}:${args.days}`;
}

function getCachedWindow(args: { airportCode: string; startLocalDate: string; days: number }): WindowCacheRecord | null {
  try {
    const raw = localStorage.getItem(cacheKey(args));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WindowCacheRecord;
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.flights)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setCachedWindow(args: {
  airportCode: string;
  startLocalDate: string;
  days: number;
  flights: WindowFlight[];
  scheduleLastUpdatedUtc: string | null;
}): WindowCacheRecord {
  const record: WindowCacheRecord = {
    savedAtMs: Date.now(),
    airportCode: args.airportCode,
    startLocalDate: args.startLocalDate,
    days: args.days,
    flights: Array.isArray(args.flights) ? args.flights : [],
    scheduleLastUpdatedUtc: args.scheduleLastUpdatedUtc ?? null,
  };

  try {
    localStorage.setItem(cacheKey(args), JSON.stringify(record));
  } catch {
    // best-effort only
  }

  return record;
}

function isWindowStale(record: WindowCacheRecord, opts: { maxAgeMs: number }) {
  const saved = Number(record?.savedAtMs || 0);
  if (!saved) return true;
  return Date.now() - saved > opts.maxAgeMs;
}
