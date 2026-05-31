// src/pages/Week.tsx
//
// =====================================================================================
// ? ASSET LOADING FIX (NO VITE MAGIC): remove "/assets/icons/calendar.webp"
// =====================================================================================
//
// IDIOT GUIDE:
//
// ? OLD:
//   const calendarSnippetSrc = "/assets/icons/calendar.webp";
//
// Why that’s bad:
// - It’s an *absolute URL path*.
// - It assumes your deployed site always has a real file at exactly that URL.
// - Vite dev server often makes this “seem fine”, then PROD breaks after build.
//
// ? NEW:
// - Use UI_ICONS.calendar from src/assets/index.ts
// - That URL is produced by an import (bundler-controlled), so it works after build,
//   and works on Synology static hosting.
//
// RULES YOU SET (and we obey here):
// - Week.tsx contains ZERO hardcoded "/assets/..." runtime paths.
// - All asset resolution stays inside src/assets/index.ts.
// =====================================================================================

import React from "react";
import { useAuth } from "../app/authStore";
import { getAirportWindowFlights } from "../api/flightsApi";
import { APP_IMAGES, UI_ICONS, getAirportLogo } from "../assets";

// ? Common back button (image-based)
import BackButton from "../components/BackButton";
import AirportInfoModal from "../components/AirportInfoModal";

// ? Week adopts global primitives + Week-only fixes
import "../styles/week.css";

const WINDOW_DAYS = 9;
const SCHEDULE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

const WEEK_MODE_STORAGE_KEY = "xcmxfa:week:mode"; // to remember user choice of compact or classic
const WEEK_BASE_FILTER_STORAGE_KEY = "xcmxfa:week:baseFilters"; // to remember AMS / RTM / EIN pill choices




// =====================================================================================
// BASE FILTERS
// =====================================================================================
//
// Week screen base filtering is intentionally frontend-only.
//
// Universal behaviour:
// - Always show AMS / RTM / EIN mini-pills.
// - Default all ON.
// - Click ON -> OFF.
// - Click OFF -> ON.
// - All OFF is allowed.
// - When all OFF, counts naturally become zero and the UI shows "No bases selected".
//
// Filtering rule:
// - Departures count: selected airport -> active base airports.
// - Arrivals count: active base airports -> selected airport.
//
// Example, selected airport BCN:
// - AMS ON includes BCN <-> AMS.
// - RTM ON includes BCN <-> RTM.
// - EIN ON includes BCN <-> EIN.
// - If a selected base has no route impact, the readout is simply zero.
// =====================================================================================

const BASE_FILTER_CODES = ["AMS", "RTM", "EIN"] as const;

export type BaseFilterCode = (typeof BASE_FILTER_CODES)[number];

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

  // Week -> Day carries the active AMS / RTM / EIN base filters
  // so the Day screen initially matches the Week count that was tapped.
  onOpenDayArrivals?: (item: WeeklyDayItem, baseFilters: BaseFilterCode[]) => void;
  onOpenDayDepartures?: (item: WeeklyDayItem, baseFilters: BaseFilterCode[]) => void;
}) {
  useAuth();

  const airportCode = String(props.airportCode || "").toUpperCase();
  if (!airportCode) throw new Error("Week: airportCode is required");

  const [mode, setMode] = React.useState<WeeklyMode>(() => {
    try {
      const raw = localStorage.getItem(WEEK_MODE_STORAGE_KEY);
      return raw === "compact" ? "compact" : "classic";
    } catch {
      return "classic";
    }
  });

  const [loading, setLoading] = React.useState(true);
  const [errorText, setErrorText] = React.useState("");
  const [windowMeta, setWindowMeta] = React.useState<{ schedule_last_updated_utc: string | null }>({
    schedule_last_updated_utc: null,
  });
  const [refreshedAtMs, setRefreshedAtMs] = React.useState<number | null>(null);

  // Raw window flights are retained separately so base-pill changes can recalculate
  // the existing Week counts immediately without another API call.
  const [windowFlights, setWindowFlights] = React.useState<WindowFlight[]>([]);

  // Base mini-pills default to all ON, but remember the user's last choice.
// Empty array is valid because "all OFF" is allowed and shows "No bases selected".
const [activeBaseCodes, setActiveBaseCodes] = React.useState<BaseFilterCode[]>(() => {
  try {
    const raw = localStorage.getItem(WEEK_BASE_FILTER_STORAGE_KEY);
    if (!raw) return [...BASE_FILTER_CODES];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...BASE_FILTER_CODES];

    const validSaved = BASE_FILTER_CODES.filter((baseCode) => parsed.includes(baseCode));

    // All OFF is a valid saved state.
    if (parsed.length === 0) return [];

    // Corrupt/invalid non-empty saved value falls back safely to all ON.
    if (validSaved.length === 0) return [...BASE_FILTER_CODES];

    return validSaved;
  } catch {
    return [...BASE_FILTER_CODES];
  }
});

  const [airportInfoOpen, setAirportInfoOpen] = React.useState(false);
  const [airportInfoCode, setAirportInfoCode] = React.useState<string | null>(null);

  const startLocalDate = React.useMemo(() => dateToLocalDateKey(new Date()), []);

  const activeBaseSet = React.useMemo(() => new Set(activeBaseCodes), [activeBaseCodes]);
  const noBasesSelected = activeBaseCodes.length === 0;

  const days = React.useMemo(() => {
    return buildDaysFromFlights({
      airportCode,
      startLocalDate,
      windowDays: WINDOW_DAYS,
      flights: windowFlights,
      activeBaseCodes,
    });
  }, [airportCode, startLocalDate, windowFlights, activeBaseCodes]);

  const toggleBaseFilter = React.useCallback((baseCode: BaseFilterCode) => {
    setActiveBaseCodes((current) => {
      if (current.includes(baseCode)) {
        return current.filter((item) => item !== baseCode);
      }

      // Keep output order stable as AMS / RTM / EIN even after repeated toggling.
      return BASE_FILTER_CODES.filter((item) => item === baseCode || current.includes(item));
    });
  }, []);

  const openArrivals = React.useCallback(
  (item: WeeklyDayItem) => {
    if (typeof props.onOpenDayArrivals === "function") {
      props.onOpenDayArrivals(item, activeBaseCodes);
    }
  },
  [props, activeBaseCodes]
);

  const openDepartures = React.useCallback(
  (item: WeeklyDayItem) => {
    if (typeof props.onOpenDayDepartures === "function") {
      props.onOpenDayDepartures(item, activeBaseCodes);
    }
  },
  [props, activeBaseCodes]
);

  const openAirportInfo = React.useCallback((codeLike: string | null | undefined) => {
    const code = String(codeLike || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 3);
    if (!code) return;
    setAirportInfoCode(code);
    setAirportInfoOpen(true);
  }, []);

  const closeAirportInfo = React.useCallback(() => {
    setAirportInfoOpen(false);
    setAirportInfoCode(null);
  }, []);

  React.useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErrorText("");

      try {
        const cached = getCachedWindow({ airportCode, startLocalDate, days: WINDOW_DAYS });
        const cacheUsable = cached && !isWindowStale(cached, { maxAgeMs: SCHEDULE_MAX_AGE_MS });

        if (cacheUsable) {
          if (!alive) return;
          setWindowMeta({ schedule_last_updated_utc: cached.scheduleLastUpdatedUtc || null });
          setWindowFlights(cached.flights);
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
          resp?.meta?.last_updated_utc ?? resp?.schedule_last_updated_utc ?? resp?.scheduleLastUpdatedUtc ?? null;

        const record = setCachedWindow({
          airportCode,
          startLocalDate,
          days: WINDOW_DAYS,
          flights,
          scheduleLastUpdatedUtc,
        });

        if (!alive) return;
        setWindowMeta({ schedule_last_updated_utc: scheduleLastUpdatedUtc });
        setWindowFlights(record.flights);
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
    return `${f} - ${l}`;
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

  React.useEffect(() => {
    try {
      localStorage.setItem(WEEK_MODE_STORAGE_KEY, mode);
    } catch {
      // best-effort only
    }
  }, [mode]);
  
  React.useEffect(() => {
  try {
    localStorage.setItem(WEEK_BASE_FILTER_STORAGE_KEY, JSON.stringify(activeBaseCodes));
  } catch {
    // best-effort only
  }
}, [activeBaseCodes]);

  const airportLogoSrc = getAirportLogo(airportCode) || APP_IMAGES.APP_LOGO;

  // Icons (RN: UI_ICONS.arrivals/departures, with arrow fallback if missing)
  const arrivalsSrc = UI_ICONS?.arrivals || null;
  const departuresSrc = UI_ICONS?.departures || null;

  // ? FIX: calendar snippet resolved via src/assets/index.ts
  const calendarSnippetSrc = (UI_ICONS as any)?.calendar || null;

  return (
    <div className="app-screen">
      <div className="week-sticky">
        <div className="app-container">
          <section className="week-headerCard">
            <div className="week-headerTopRow">
              <div className="week-headerLeft">
                <button
                  type="button"
                  className="week-headerLogoBtn"
                  onClick={() => openAirportInfo(airportCode)}
                  aria-label={`Open airport info for ${airportCode}`}
                  title="Airport info"
                >
                  <img src={airportLogoSrc} alt={`${airportCode} logo`} className="week-headerLogo" />
                </button>
              </div>

              <div className="week-headerCode">{airportCode}</div>

              <div className="week-headerRight">
                <BackButton
                  onClick={() => {
                    if (typeof props.onBack === "function") props.onBack();
                  }}
                  ariaLabel="Back"
                  size={38}
                />
              </div>
            </div>

            <div className="week-range">{rangeLabel}</div>

            {/*==================================== temporarily turned OFF ========================================================
            <div className="week-updatedMetaWrap">
              {loading ? (
                <div className="week-updatedMetaLine">Loading schedule…</div>
              ) : errorText ? (
                <div className="week-updatedMetaLine" title={errorText}>
                  {errorText}
                </div>
              ) : (
                <>
                  {!!databaseLabel && <div className="week-updatedMetaLine">Database {databaseLabel}</div>}
                  {!!refreshedLabel && <div className="week-updatedMetaLine">Refreshed {refreshedLabel}</div>}
                </>
              )}
            </div>
            ==================================== temporarily turned OFF ========================================================*/}

            <div className="week-modeToggle">
              <button
                type="button"
                className={`week-modeOption ${mode === "classic" ? "week-modeOptionActive" : ""}`}
                onClick={() => setMode("classic")}
              >
                Classic
              </button>
              <button
                type="button"
                className={`week-modeOption ${mode === "compact" ? "week-modeOptionActive" : ""}`}
                onClick={() => setMode("compact")}
              >
                Compact
              </button>
            </div>

            <div className="week-baseFilterRow" aria-label="Flight base filters">
              {BASE_FILTER_CODES.map((baseCode) => {
                const isActive = activeBaseSet.has(baseCode);

                return (
                  <button
                    key={baseCode}
                    type="button"
                    className={`week-baseMiniPill ${
                      isActive ? "week-baseMiniPillActive" : "week-baseMiniPillInactive"
                    }`}
                    onClick={() => toggleBaseFilter(baseCode)}
                    aria-pressed={isActive}
                    aria-label={`${baseCode} base filter ${isActive ? "on" : "off"}`}
                  >
                    {baseCode}
                  </button>
                );
              })}
            </div>

            {noBasesSelected && <div className="week-baseFilterEmpty">No bases selected</div>}
          </section>
        </div>
      </div>

      <div className="app-container week-body">
        {mode === "classic" ? (
          <div className="week-classicGrid">
            {days.map((item) => (
              <div key={item.key} className="week-classicCard">
                <div className="week-calendarWrap">
                  <img src={calendarSnippetSrc as any} alt="" className="week-calendarImage" />
                  <div className="week-calendarTextOverlay">
                    <div className="week-calDow">{item.date.toLocaleDateString("en-GB", { weekday: "long" })}</div>
                    <div className="week-calMonth">{item.date.toLocaleDateString("en-GB", { month: "long" })}</div>
                    <div className="week-calDayNum">{String(item.day)}</div>
                  </div>
                </div>

                <div className="week-cornerSlot week-cornerSlotLeft">
                  <button type="button" className="week-iconTap" onClick={() => openDepartures(item)} aria-label="Departures">
                    {departuresSrc ? <img src={departuresSrc} alt="" className="week-planeIcon" /> : <span className="week-fallbackArrow">?</span>}
                  </button>
                  <div className="week-floatCount week-floatCountNW">{item.departures}</div>
                </div>

                <div className="week-cornerSlot week-cornerSlotRight">
                  <button type="button" className="week-iconTap" onClick={() => openArrivals(item)} aria-label="Arrivals">
                    {arrivalsSrc ? <img src={arrivalsSrc} alt="" className="week-planeIcon" /> : <span className="week-fallbackArrow">?</span>}
                  </button>
                  <div className="week-floatCount week-floatCountNE">{item.arrivals}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="week-compactStack">
            {days.map((item) => {
              const total = (Number(item.arrivals) || 0) + (Number(item.departures) || 0);
              const weekdayLabel = item.date.toLocaleDateString("en-GB", { weekday: "short" });
              const dayMonthLabel = item.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

              return (
                <div key={item.key} className="week-compactDayCard">
                  <div className="week-compactDayHeader">
                    <div className="week-compactDayDate">
                      <span className="week-compactDayWeek">{weekdayLabel} </span>
                      <span className="week-compactDayMonthDate">{dayMonthLabel}</span>
                    </div>
                    <div className="week-compactTotalPill">Total {total}</div>
                  </div>

                  <div className="week-compactDayBody">
                    <button
                      type="button"
                      className={`week-compactMiniCard week-compactMiniCardLeft`}
                      onClick={() => openArrivals(item)}
                      aria-label="Arrivals"
                    >
                      <div className="week-compactMiniIconWrap">
                        {arrivalsSrc ? <img src={arrivalsSrc} alt="" className="week-planeIcon" /> : <span className="week-fallbackArrow">?</span>}
                      </div>
                      <div className="week-compactMiniText">
                        <div className="week-compactMiniCount">{item.arrivals}</div>
                        <div className="week-compactMiniLabel">Arrivals</div>
                      </div>
                    </button>

                    <button type="button" className="week-compactMiniCard" onClick={() => openDepartures(item)} aria-label="Departures">
                      <div className="week-compactMiniIconWrap">
                        {departuresSrc ? <img src={departuresSrc} alt="" className="week-planeIcon" /> : <span className="week-fallbackArrow">?</span>}
                      </div>
                      <div className="week-compactMiniText">
                        <div className="week-compactMiniCount">{item.departures}</div>
                        <div className="week-compactMiniLabel">Departures</div>
                      </div>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AirportInfoModal
        isOpen={airportInfoOpen}
        airportCode={airportInfoCode}
        onClose={closeAirportInfo}
      />
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
  activeBaseCodes: BaseFilterCode[];
}) {
  const byDay = groupWindowByDayExactRNFallback(args.flights, args.airportCode, args.activeBaseCodes);

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

function groupWindowByDayExactRNFallback(
  flights: WindowFlight[],
  airportCode: string,
  activeBaseCodes: BaseFilterCode[]
) {
  const byDay: Record<string, { arrivals: WindowFlight[]; departures: WindowFlight[] }> = {};
  if (!Array.isArray(flights)) return byDay;

  const activeBases = new Set(
    (Array.isArray(activeBaseCodes) ? activeBaseCodes : [])
      .map((item) => String(item || "").trim().toUpperCase())
      .filter(Boolean)
  );

  // All OFF is a valid state. Return an empty grouping so every day renders zero.
  if (activeBases.size === 0) return byDay;

  const selectedAirport = String(airportCode || "").trim().toUpperCase();

  for (const f of flights) {
    if (!f) continue;

    const cancelledRaw = String(f.cancelled || "").trim().toLowerCase();
    const opStatusRaw = String(f.op_status || f.status || "").trim().toUpperCase();

    const isCancelled =
      cancelledRaw === "y" ||
      cancelledRaw === "yes" ||
      cancelledRaw === "true" ||
      cancelledRaw === "1" ||
      opStatusRaw === "CANCELLED";

    if (isCancelled) continue;

    const dep = String(f.dep_airport || "").trim().toUpperCase();
    const arr = String(f.arr_airport || "").trim().toUpperCase();

    const isDepartureFromSelectedAirport = dep === selectedAirport;
    const isArrivalIntoSelectedAirport = arr === selectedAirport;

    // Base filter rule:
    // - departure count only includes selected airport -> active base.
    // - arrival count only includes active base -> selected airport.
    const includeAsDeparture = isDepartureFromSelectedAirport && activeBases.has(arr);
    const includeAsArrival = isArrivalIntoSelectedAirport && activeBases.has(dep);

    if (!includeAsDeparture && !includeAsArrival) continue;

    const dt = includeAsDeparture ? f.std_local : f.sta_local;
    if (!dt || typeof dt !== "string" || dt.length < 10) continue;

    const dayKey = dt.slice(0, 10);
    if (!byDay[dayKey]) byDay[dayKey] = { arrivals: [], departures: [] };

    if (includeAsDeparture) byDay[dayKey].departures.push(f);
    if (includeAsArrival) byDay[dayKey].arrivals.push(f);
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