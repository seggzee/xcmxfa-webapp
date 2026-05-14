// src/pages/Home.tsx
//
// =====================================================================================
// ?? BOOTSTRAP: Unify Asset Loading (Airports / Airlines / Icons)  Home.tsx (Airports)
// =====================================================================================
//
// IDIOT GUIDE (read this once, then forget it):
//
// ? What broke?
// - In DEV, Vite serves your /public/assets/... folder magically at /assets/...,
//   so this worked:
//
//      <img src="/assets/airports/AMS.webp" />
//
// - In PROD build, your app is bundled and deployed under whatever path Synology serves.
//   If the build output doesnt contain /assets/airports/AMS.webp at that exact absolute URL,
//   you get 404s.
//
// ? Whats the fix?
// - NEVER build image URLs by string like "/assets/..."
// - ALWAYS resolve image URLs via imports, because the bundler then:
//
//   1) includes the file in the build
//   2) fingerprints it (hash) for caching
//   3) returns the correct final URL string for PROD
//
// ? Your rule:
/// - Centralise ALL asset resolution in src/assets/index.ts
// - Components use ONLY:
//      getAirportLogo(code)
//      AIRLINE_LOGOS
//      LISTING_STATUS_ICONS
//      UI_ICONS
//
// ? What changes in this file?
// - ONLY the AirportChip logo resolution changes
// - We import getAirportLogo
// - Replace the hardcoded string path with getAirportLogo(resolvedCode)
//
// ?? What we do NOT do here:
// - No new logic
// - No extra fallbacks
// - No changes to unrelated UI / behaviour / state
// =====================================================================================
//
// =====================================================================================
// ?? BOOTSTRAP: Countdown Time Truth + Phase Engine  Home My next flight (ADD-ONLY)
// =====================================================================================
//
// IDIOT GUIDE:
// - Countdown is canonical UTC math:
//     std_utc (absolute UTC instant) - Date.now() (epoch ms).
// - We do NOT guess.
//     - If std_utc missing/invalid -> msToStd null -> do not show countdown.
// - Countdown visibility:
//     - Starts at Phase 2 (<= 6h) and continues through Phase 3 (until STD).
//     - Phase 4 is post-STD; we do NOT show countdown here yet (later Schiphol rule overrides).
//
// NOTE (2026-02-20):
// - Countdown format now includes seconds: "HH:MM:SS"
// - Tick interval is 1 second.
//
// What we do here (ADD-ONLY):
// - Add a ticking nowMs state (interval)
// - Derive msToStd/phase/countdown via flightsApi helpers
// - Pass countdown into FlightCard3x3 via headerRightContent slot
// =====================================================================================
//
// =====================================================================================
// ?? BOOTSTRAP: FlightCard3x3 Row Visibility (Phase 0 hides Row 3 on Home My next flight)
// =====================================================================================
//
// IDIOT GUIDE:
// - Phase 0 is > 24 hours to STD.
// - On Home, for "My next flight" only, we want a shorter card in Phase 0.
// - We achieve this with a new optional prop on FlightCard3x3:
//     visibleRows?: 2 | 3
//   Default is 3 so nothing changes unless a screen explicitly opts in.
// - If std_utc is missing/invalid -> msToStd null -> phase defaults to 0 -> show 2 rows.
// - This thread changes ONLY Home "My next flight" usage. No other screens touched.
// =====================================================================================
//
// =====================================================================================
// ?? PHASE 0 OFFLINE HOME BEHAVIOUR (ADD-ONLY)
// =====================================================================================
//
// IDIOT GUIDE:
// - Phase 0 does NOT provide offline Home data.
// - The app shell may load offline, but live Home content must remain honest.
// - Therefore:
//   - show a compact Home offline notice
//   - replace "My next flight" with offline-unavailable copy
//   - hide weather card offline
//   - hide unread messages banner offline
//   - keep Airports card visible, but make it read-only offline
// - Quick actions remain visible; destination pages will handle their own offline state.
// =====================================================================================

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { STORAGE_PENDING_USERNAME } from "../app/storageKeys";

import { useAuth } from "../app/authStore";
import { useCrew } from "../app/crewStore";
import {
  loadFavourites,
  saveFavourites as saveFavouritesToStorage,
  getMaxFavs,
  getFavKey,
} from "../app/favourites";

import FlightCard3x3 from "../components/FlightCard3x3";
import GuestPromoCard from "../components/GuestPromoCard";
import AirportInfoModal from "../components/AirportInfoModal";

import { getCrewLockerNotifications } from "../api/crewLockersApi";

import { API_BASE_URL } from "../config/api";

// ? CHANGE 1/2:
// We add getAirportLogo here so Home never hardcodes "/assets/airports/..."
// Everything goes through src/assets/index.ts
import { APP_IMAGES, getAirportLogo, LISTING_STATUS_ICONS, UI_ICONS } from "../assets";

// ? ADD-ONLY: canonical time truth + phase helpers
import { getMyFlights, getMsToStd, getFlightPhase, formatCountdownHHMM } from "../api/flightsApi";
import useOnlineStatus from "../hooks/useOnlineStatus";

type NextFlightState =
  | { status: "idle" | "loading"; flight: null }
  | { status: "ready"; flight: any }
  | { status: "empty"; flight: null }
  | { status: "error"; flight: null; error: Error };

/* =====================================================================================
   WEATHER CARD (ADD-ONLY)
   - Separate short full-width card below hero card
   - Debug toggle available for UI review
   - No placeholder / no spinner / no other Home changes
===================================================================================== */

type HomeWeatherCardData = {
  title: string;
  icon_url: string;
  wind_text: string;
  condition_text: string;
  temp_c: number;
};



/*	This is the control for the weather card */
const HOME_WEATHER_DEBUG = false;
//const HOME_WEATHER_DEBUG = true; // make false for production environment

const HOME_WEATHER_DEBUG_SAMPLE: HomeWeatherCardData = {
  title: "Amsterdam (AMS)",
  icon_url: "https://cdn.weatherapi.com/weather/64x64/day/296.png",
  wind_text: "Moderate NW winds",
  condition_text: "Light rain",
  temp_c: 12,
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function normalizeCode(v: any) {
  return String(v || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);
}

function localWeatherIconSrcFromProviderUrl(raw: any) {
  const s = String(raw || "").trim();
  if (!s) return "";

  const normalized = s.startsWith("//") ? `https:${s}` : s;
  const marker = "/weather/";
  const markerPos = normalized.indexOf(marker);

  if (markerPos === -1) {
    return s;
  }

  const relativePath = normalized.slice(markerPos + marker.length); // e.g. 64x64/day/116.png
  return `/assets/weatherIcons/${relativePath}`;
}

/**
 * listingIconSrcFromStatus()
 * Idiot guide:
 * - my_flights API rows can carry:
 *   - listing_status (web parity field)
 *   - booking_status (backend canonical: pending|sent|confirmed)
 * - Home treats "confirmed" as "booked" icon (RN semantics).
 */
function listingIconSrcFromStatus(raw: any) {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "confirmed" || s === "booked") return LISTING_STATUS_ICONS.booked;
  if (s === "sent") return LISTING_STATUS_ICONS.sent;
  if (s === "pending") return LISTING_STATUS_ICONS.pending;
  return null;
}



export default function Home() {
  const nav = useNavigate();
  const { auth } = useAuth();
  const { crew } = useCrew();
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const isOffline = !isOnline;

  const isMember = auth.mode === "member";
  
  useEffect(() => {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}, []);

  // ===== identity display only (no inference) =====
  const staffNo = String(auth?.user?.username || "").trim().toUpperCase();

  const who = (crew?.psn || staffNo || "").toString().trim().toUpperCase();

  const employer = (crew?.employer || "").toString().trim().toUpperCase();

  // =============================================================================
  // Airports favourites (RN parity: Home owns it)
  // =============================================================================
  const maxFavs = getMaxFavs(auth);

  const [favourites, setFavourites] = useState<string[]>(() => loadFavourites(auth));

  // Hydrate when auth changes mode
  useEffect(() => {
    setFavourites(loadFavourites(auth));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.mode]);

  // RN parity: reload favourites every time Home becomes active again.
  useEffect(() => {
    setFavourites(loadFavourites(auth));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // Mobile parity: returning to the tab/browser should also refresh favourites.
  useEffect(() => {
    const onFocus = () => setFavourites(loadFavourites(auth));
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.mode]);

  // Cross-tab parity: if another tab edits favourites, reflect it here.
  useEffect(() => {
    const key = getFavKey(auth);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setFavourites(loadFavourites(auth));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.mode]);

  function saveFavouritesFromHome(next: string[], trigger: string) {
    const clean = (Array.isArray(next) ? next : [])
      .map(normalizeCode)
      .filter(Boolean)
      .slice(0, maxFavs);

    setFavourites(clean);
    saveFavouritesToStorage(auth, clean, { trigger });
  }

  const favs = useMemo(() => {
    return (Array.isArray(favourites) ? favourites : []).filter(Boolean).slice(0, maxFavs);
  }, [favourites, maxFavs]);

  const memberSlots = useMemo(() => {
    const slots: (string | null)[] = favs.slice(0, maxFavs);
    while (slots.length < maxFavs) slots.push(null);
    return slots;
  }, [favs, maxFavs]);

  const ADD_SLOT_LABELS = useMemo(() => {
    const base = ["Add favourite airport", "Add another airport", "Add a third airport"];
    return base.slice(0, Math.max(1, maxFavs));
  }, [maxFavs]);

  const airportsTitle = useMemo(() => {
    const selectedCount = favs.filter(Boolean).length;
    const plural = maxFavs > 1;

    if (selectedCount === 0) return plural ? "Select airports" : "Select airport";
    return plural ? "Selected airports" : "Selected airport";
  }, [favs, maxFavs]);

  // ===== Airports modals (RN parity) =====
  const [showAirportsHelp, setShowAirportsHelp] = useState(false);
  const [removeConfirmVisible, setRemoveConfirmVisible] = useState(false);
  const [pendingRemoveIndex, setPendingRemoveIndex] = useState<number | null>(null);

  const [airportInfoOpen, setAirportInfoOpen] = useState(false);
  const [airportInfoCode, setAirportInfoCode] = useState<string | null>(null);

  const removeFavouriteAt = (idx: number) => {
    const next = favs.slice(0);
    if (idx < 0 || idx >= next.length) return;

    next.splice(idx, 1);
    saveFavouritesFromHome(next, "remove");
  };



    function openAirportInfo(codeLike: string | null | undefined) {
    const code = normalizeCode(codeLike);
    if (!code) return;

    setAirportInfoCode(code);
    setAirportInfoOpen(true);
  }

  function closeAirportInfo() {
    setAirportInfoOpen(false);
    setAirportInfoCode(null);
  }

  // =============================================================================
  // Messages banner (member-only)  unread count (locker notifications for now)
  // =============================================================================
  const [unreadMsgCount, setUnreadMsgCount] = useState<number>(0);

  useEffect(() => {
    let alive = true;

    (async () => {
      // Guest: no banner
      if (!isMember) {
        if (alive) setUnreadMsgCount(0);
        return;
      }

      // Identity: follow your existing Home pattern (staffNo from auth.user.username)
      if (!staffNo) {
        if (alive) setUnreadMsgCount(0);
        return;
      }

      // Phase 0 offline rule:
      // - Home messages banner is hidden offline
      // - do not leave stale counts hanging around
      if (!isOnline) {
        if (alive) setUnreadMsgCount(0);
        return;
      }

      try {
        const resp: any = await getCrewLockerNotifications(staffNo);
        const rows = Array.isArray(resp?.messages) ? resp.messages : [];

        const unread = rows.filter((r: any) => !r?.read_at).length;

        if (!alive) return;
        setUnreadMsgCount(Number.isFinite(unread) ? unread : 0);
      } catch {
        // Silent fail: Home must never look broken because messages endpoint hiccuped
        if (!alive) return;
        setUnreadMsgCount(0);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isMember, staffNo, isOnline]);
  

  // =============================================================================
  // Next flight (member-only, real data)
  // =============================================================================
  const [nextFlightState, setNextFlightState] = useState<NextFlightState>({
    status: "idle",
    flight: null,
  });

 	  useEffect(() => {
    const ac = new AbortController();

    async function load() {
      // RN parity: guest does NOT fetch next flight.
      if (!isMember) {
        setNextFlightState({ status: "empty", flight: null });
        return;
      }

      // RN parity: staffNo comes from auth.username
      if (!staffNo) {
        console.error("[Home][NextFlight] Member missing auth.user.username (staffNo)");
        setNextFlightState({ status: "empty", flight: null });
        return;
      }

      // Phase 0 offline rule:
      // - Home renders a dedicated offline-unavailable message for next flight
      // - do not leave the page stuck in a prior network error while offline
      // - reconnecting should retrigger this effect automatically via dependency list
      if (!isOnline) {
        setNextFlightState({ status: "idle", flight: null });
        return;
      }

      setNextFlightState({ status: "loading", flight: null });

      try {
        const rows = await getMyFlights({ staffNo });

        if (ac.signal.aborted) return;

// =====================================================================================
// HOME RULE:
// - "My next flight" must show the NEXT UPCOMING flight only.
// - my_flights feed may include recent past flights for My Flights screen purposes.
// - Therefore Home must explicitly select the earliest future flight by std_utc.
// =====================================================================================

// 1) Build one representative row per flight_instance_id
const flightMap = new Map<string, any>();

for (const r of Array.isArray(rows) ? rows : []) {
  const fid = String(r?.flight_instance_id || "").trim();
  if (!fid) continue;
  if (!flightMap.has(fid)) flightMap.set(fid, r);
}

const uniqueFlights = Array.from(flightMap.values());

// 2) Keep only valid future flights
const nowMs = Date.now();

const upcomingFlights = uniqueFlights
  .filter((f: any) => {
    const ms = Date.parse(String(f?.std_utc || ""));
    return Number.isFinite(ms) && ms > nowMs;
  })
  .sort((a: any, b: any) => {
    const aMs = Date.parse(String(a?.std_utc || ""));
    const bMs = Date.parse(String(b?.std_utc || ""));
    return aMs - bMs;
  });

const firstFlightInstanceId = String(upcomingFlights?.[0]?.flight_instance_id || "").trim();

if (!firstFlightInstanceId) {
  setNextFlightState({ status: "empty", flight: null });
  return;
}

const firstFlightRows = Array.isArray(rows)
  ? rows.filter((r: any) => String(r?.flight_instance_id || "").trim() === firstFlightInstanceId)
  : [];

// ========================================== END HOME RULE:============================

        const myRow =
          firstFlightRows.find((r: any) => String(r?.psn || "").trim().toUpperCase() === staffNo) ||
          firstFlightRows[0] ||
          null;

        if (!myRow) {
          setNextFlightState({ status: "empty", flight: null });
          return;
        }

        setNextFlightState({ status: "ready", flight: myRow });
      } catch (e: any) {
        if (ac.signal.aborted) return;
        const err = e instanceof Error ? e : new Error(String(e));
        console.error("[Home][NextFlight] getMyFlights failed", err);
        setNextFlightState({ status: "error", flight: null, error: err });
      }
    }

    load();
    return () => ac.abort();
  }, [isMember, staffNo, isOnline]);

  // ? ADD-ONLY (Step 2): ticking "now" for countdown/phase
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(t);
  }, []);

  // ? ADD-ONLY (Step 2): derive countdown + phase for "My next flight"
  const nextFlightDerived = useMemo(() => {
    if (nextFlightState.status !== "ready") {
      return { msToStd: null as number | null, phase: 0 as number, countdown: null as string | null };
    }

    const f: any = nextFlightState.flight || {};

    const msToStd = getMsToStd(f, nowMs);

    // LOCKED RULE:
    // - If msToStd is null (std_utc missing/invalid), phase defaults to 0.
    // - This drives row visibility to 2 rows (no guessing).
    const phase = getFlightPhase(msToStd) as 0 | 1 | 2 | 3 | 4;

    // Countdown starts at Phase 2 and continues until STD (Phase 3).
    // Phase 4 is post-STD; do not show countdown here yet.

/*================================================================================================================*/
    const showCountdown = phase === 2 || phase === 3; //ORIGINAL (RESTORE AFTER REVIEW)
	//const showCountdown = true; //TEMP OVERRIDE FOR UI REVIEW
/*================================================================================================================*/

    const countdown = showCountdown && msToStd !== null ? formatCountdownHHMM(msToStd) : null;

    return { msToStd, phase, countdown };
  }, [nextFlightState.status, nextFlightState.flight, nowMs]);

  const nextFlightCountdownHHMMSS = nextFlightDerived.countdown;

  /* =====================================================================================
     WEATHER CARD DATA (ADD-ONLY)
  ===================================================================================== */

  const [weatherCardData, setWeatherCardData] = useState<HomeWeatherCardData | null>(
    HOME_WEATHER_DEBUG ? HOME_WEATHER_DEBUG_SAMPLE : null
  );

  const weatherIconSrc = weatherCardData
    ? localWeatherIconSrcFromProviderUrl(weatherCardData.icon_url)
    : "";

  useEffect(() => {
    let alive = true;

    async function loadWeather() {
      if (HOME_WEATHER_DEBUG) {
        if (alive) setWeatherCardData(HOME_WEATHER_DEBUG_SAMPLE);
        return;
      }

      if (!isMember) {
        if (alive) setWeatherCardData(null);
        return;
      }

      if (nextFlightState.status !== "ready") {
        if (alive) setWeatherCardData(null);
        return;
      }

      const f: any = nextFlightState.flight || {};

      const arr_airport = String(f?.arr_airport || "").trim().toUpperCase();
      const std_utc = String(f?.std_utc || "").trim();
      const sta_utc = String(f?.sta_utc || "").trim();

      if (!arr_airport || !std_utc || !sta_utc) {
        if (alive) setWeatherCardData(null);
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/api/weather/next_flight_weather.php`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            arr_airport,
            std_utc,
            sta_utc,
          }),
        });

        const text = await res.text();

        let json: any = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = null;
        }

        if (!alive) return;

        if (!res.ok || !json || json.ok !== true || json.show !== true) {
          setWeatherCardData(null);
          return;
        }

        setWeatherCardData({
          title: String(json.title || ""),
          icon_url: String(json.icon_url || ""),
          wind_text: String(json.wind_text || ""),
          condition_text: String(json.condition_text || ""),
          temp_c: Number(json.temp_c),
        });
      } catch {
        if (!alive) return;
        setWeatherCardData(null);
      }
    }

    loadWeather();

    return () => {
      alive = false;
    };
  }, [isMember, nextFlightState.status, nextFlightState.flight]);

  //////////////////////////////////////////////////////////////////////////////////////////////////

  // =============================================================================
  // Airports carousel sizing  callback-ref so we measure as soon as it mounts
  // (prevents "wide chips until refresh" after login) + observe width changes
  // =============================================================================
  const carouselElRef = useRef<HTMLDivElement | null>(null);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  const [carouselOuterW, setCarouselOuterW] = useState<number | null>(null);

  // Single source of truth for measurement
  const measureCarousel = useCallback(() => {
    const el = carouselElRef.current;
    if (!el) return;

    // getBoundingClientRect is more reliable during layout changes than offsetWidth
    const w = Math.round(el.getBoundingClientRect().width || 0);
    if (!w) return;

    setCarouselOuterW((prev) => (prev === w ? prev : w));
  }, []);

  // Callback ref: runs immediately when element mounts/unmounts
  const carouselRef = useCallback(
    (node: HTMLDivElement | null) => {
      // Cleanup any previous observer
      if (resizeObsRef.current) {
        resizeObsRef.current.disconnect();
        resizeObsRef.current = null;
      }

      carouselElRef.current = node;

      if (!node) return;

      // Measure immediately, then again next frame (covers "first paint" + post-layout)
      measureCarousel();
      requestAnimationFrame(measureCarousel);

      // Observe width changes (login/layout/viewport changes)
      const ro = new ResizeObserver(() => measureCarousel());
      ro.observe(node);
      resizeObsRef.current = ro;
    },
    [measureCarousel]
  );

  useEffect(() => {
    // Also listen to viewport events (belt + braces)
    window.addEventListener("resize", measureCarousel);
    window.addEventListener("orientationchange", measureCarousel);

    return () => {
      window.removeEventListener("resize", measureCarousel);
      window.removeEventListener("orientationchange", measureCarousel);

      if (resizeObsRef.current) {
        resizeObsRef.current.disconnect();
        resizeObsRef.current = null;
      }
    };
  }, [measureCarousel]);

  const carouselGap = 10;
  const carouselItemW = typeof carouselOuterW === "number" ? Math.round(carouselOuterW * 0.48) : null;

  const twoUpBlockW = typeof carouselItemW === "number" ? carouselItemW * 2 + carouselGap : null;

  const carouselSidePad =
    typeof carouselOuterW === "number" && typeof twoUpBlockW === "number"
      ? Math.max(0, Math.round((carouselOuterW - twoUpBlockW) / 2))
      : 0;

  function formatHeaderDateFromStdLocal(stdLocal?: string | null): string | undefined {
    if (!stdLocal) return undefined;

    const d = new Date(stdLocal);
    if (Number.isNaN(d.getTime())) return undefined;

    const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
    const day = d.toLocaleDateString("en-GB", { day: "2-digit" });
    const month = d.toLocaleDateString("en-GB", { month: "short" });

    return `${weekday} ${day} ${month}`;
  }

  // =============================================================================
  // AirportChip  RN Home design + behaviour
  // =============================================================================
  function AirportChip({
    code,
    isAdd = false,
    label,
    showPlus,
    onPress,
    onInfoPress,
    showRemove = false,
    onRemove,
    disabled = false,
  }: {
    code?: string | null;
    isAdd?: boolean;
    label?: string;
    showPlus?: boolean;
    onPress?: () => void;
    onInfoPress?: () => void;
    showRemove?: boolean;
    onRemove?: () => void;
    disabled?: boolean;
  }) {
    const resolvedCode = normalizeCode(code);

    const resolvedLabel = typeof label === "string" ? label : isAdd ? "add airport" : String(resolvedCode);

    const shouldShowPlus = typeof showPlus === "boolean" ? showPlus : Boolean(isAdd);

    // ? CHANGE 2/2 (THE ACTUAL FIX):
    //
    // OLD (BAD):
    //   "/assets/airports/AMS.webp"
    //
    // Why bad?
    // - Depends on dev server/public folder behaviour.
    // - Can break when app is built and deployed under a different base path.
    //
    // NEW (GOOD):
    // - getAirportLogo() returns the *real* final URL from src/assets/index.ts
    // - bundler includes the file in build output (hashed) and returns correct link
    // - works on Synology static hosting because its just a normal built URL
    //
    // Contract:
    // - Home never cares where airport images live.
    // - If you ever rename/move/convert images, you only update src/assets/index.ts
    const logoSrc = !isAdd && resolvedCode ? getAirportLogo(resolvedCode) : null;

    const [pressed, setPressed] = useState(false);
    const [removePressed, setRemovePressed] = useState(false);

    return (
      <div className="airportChipWrap" style={disabled ? { opacity: 0.96 } : undefined}>
        {showRemove ? (
          <button
            type="button"
            className="airportChipRemove"
            onClick={(e) => {
              e.stopPropagation();
              if (disabled) return;
              onRemove?.();
            }}
            onMouseDown={() => !disabled && setRemovePressed(true)}
            onMouseUp={() => setRemovePressed(false)}
            onMouseLeave={() => setRemovePressed(false)}
            onTouchStart={() => !disabled && setRemovePressed(true)}
            onTouchEnd={() => setRemovePressed(false)}
            aria-label="Remove airport"
            title="Remove"
            style={removePressed ? { opacity: 0.88 } : disabled ? { opacity: 0.5, cursor: "default" } : undefined}
            disabled={disabled}
          >
            <img src={UI_ICONS.close} alt ="remove button" />
          </button>
        ) : null}

        {!isAdd ? (
          <button
            type="button"
            className="airportChipInfo"
            onClick={(e) => {
              e.stopPropagation();
              if (disabled) return;
              onInfoPress?.();
            }}
            aria-label="Airport info"
            title="Airport info"
            style={disabled ? { opacity: 0.5, cursor: "default" } : undefined}
            disabled={disabled}
          >
            <img src={UI_ICONS.info} alt ="info button" />
          </button>
        ) : null}

        <button
          type="button"
          className="airportChipBtn"
          onClick={() => {
            if (disabled) return;
            onPress?.();
          }}
          onMouseDown={() => !disabled && setPressed(true)}
          onMouseUp={() => setPressed(false)}
          onMouseLeave={() => setPressed(false)}
          onTouchStart={() => !disabled && setPressed(true)}
          onTouchEnd={() => setPressed(false)}
          onTouchCancel={() => setPressed(false)}
          style={
            pressed
              ? { opacity: 0.92 }
              : disabled
              ? { cursor: "default" }
              : undefined
          }
          disabled={disabled}
          aria-disabled={disabled}
        >
          <div className="airportChipTopRN">
            {isAdd && shouldShowPlus ? (
              <div className="airportChipPlus">+</div>
            ) : !isAdd && logoSrc ? (
              <img src={logoSrc} className="airportChipLogo" alt="" />
            ) : null}
          </div>

          <div className="airportChipBottomRN">
            <div className={isAdd ? "airportChipLabelAddRN" : "airportChipLabelRN"}>{resolvedLabel}</div>
          </div>
        </button>
      </div>
    );
  }

  //////////////////////////////////////////////////////////////
  // ===== Sign-up modal (RN parity) =====
  const [signUpModalVisible, setSignUpModalVisible] = useState(false);

  return (
    <div className="homeScreen">
      <div className="homeInner">
        {!isOnline ? (
          <section
            className="card"
            style={{
              borderColor: "rgba(154,52,18,0.18)",
              background: "#fff7ed",
            }}
          >
            <div style={{ fontWeight: 900, color: "#132333" }}>You&apos;re offline</div>
            <div
              style={{
                marginTop: 6,
                fontWeight: 700,
                fontSize: 13,
                color: "rgba(19,35,51,0.72)",
                lineHeight: 1.35,
              }}
            >
              Some live features on Home are unavailable right now. Reconnect to load flight,
              weather and message updates.
            </div>
          </section>
        ) : null}

        {/* ===== Hero + next flight (RN) ===== */}
        <section className="card card--flush">
          <div className="card-hero">
            <img src={APP_IMAGES.SCHIPHOL_IMG} alt="Schiphol Airport" />
          </div>

          {/* Member-only: My next flight */}
          {isMember ? (
            <div className="card-body">
              {!isOnline ? (
                <>
                  <div className="mutedLineSpecial">My next flight unavailable offline</div>
                  <div
                    style={{
                      marginTop: 8,
                      textAlign: "center",
                      fontWeight: 700,
                      fontSize: 13,
                      color: "rgba(19,35,51,0.62)",
                      lineHeight: 1.35,
                    }}
                  >
                    Reconnect to load your latest flight information.
                  </div>
                </>
              ) : nextFlightState.status === "loading" ? (
                <div className="mutedLineSpecial">Loading next flight</div>
              ) : nextFlightState.status === "ready" ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => nav("/myflights")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") nav("/myflights");
                  }}
                  style={{ cursor: "pointer", transition: "opacity 0.15s" }}
                  onMouseDown={(e) => (e.currentTarget.style.opacity = "0.92")}
                  onMouseUp={(e) => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                  onTouchStart={(e) => (e.currentTarget.style.opacity = "0.92")}
                  onTouchEnd={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  <FlightCard3x3
                    showHeader
                    headerLeftLabel="My next flight:"
                    headerDate={formatHeaderDateFromStdLocal((nextFlightState.flight as any)?.std_local)}
                    headerRightContent={
                      nextFlightCountdownHHMMSS ? (
                        <span className="homeNextFlightCountdown" aria-label={`Countdown ${nextFlightCountdownHHMMSS}`}>
                          {nextFlightCountdownHHMMSS}
                        </span>
                      ) : null
                    }
                    flight={nextFlightState.flight}
                    /**
                     * IMPORTANT (2026-02-20):
                     * - FlightCard3x3 cell 2:3 is now the screen slot (P1/3, X-staff, etc).
                     * - Gate now lives in cell 3:3 (inside the card itself).
                     */
                    footerRightContent={(() => {
                      const f: any = nextFlightState.flight || {};
                      const pos = f?.list_position ?? f?.listPos ?? null;
                      const total = f?.list_total ?? f?.listTotal ?? null;

                      if (!pos || !total) return null;

                      const iconSrc = listingIconSrcFromStatus(f?.listing_status ?? f?.booking_status ?? null);

                      return (
                        <span className="homeNextFlightListMeta">
                          <span className="homeNextFlightListPos">P{String(pos)}/{String(total)}</span>

                          {iconSrc ? (
                            <img
                              src={iconSrc}
                              alt={String(f?.listing_status ?? f?.booking_status ?? "")}
                              className="homeNextFlightListIcon"
                            />
                          ) : null}
                        </span>
                      );
                    })()}
                    /**
                     * Phase 0 (>24h) hides Row 3 (Type/Reg/Gate) on Home "My next flight" ONLY.
                     * - Default behaviour for FlightCard3x3 remains 3 rows everywhere else.
                     * - If std_utc missing/invalid => msToStd null => phase defaults to 0 => show 2 rows (no guessing).
                     */

                    /* phase 0 includes msToStd null; we deliberately hide row 3 when std_utc is missing */
                    visibleRows={nextFlightDerived.phase === 0 ? 2 : 3}
                  />
                </div>
              ) : nextFlightState.status === "error" ? (
                <div className="errorLine">My next flight unavailable: {nextFlightState.error.message}</div>
              ) : (
                <>
                  <div className="mutedLineSpecial">No upcoming flights.</div>

                  <div className="promoSpacer">
                    <GuestPromoCard apiBaseUrl={API_BASE_URL} />
                  </div>
                </>
              )}
            </div>
          ) : null}
        </section>

        {/* ===== Weather card (ADD-ONLY) ===== */}
        {isOnline && weatherCardData ? (
          <section
            className="card"
            style={{
              display: "flex",
              alignItems: "center",
              background: "rgba(19,35,51,0.04)",
              gap: 14,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                minWidth: 56,
                borderRadius: 14,
                background: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <img
                src={weatherIconSrc}
                alt=""
                style={{
                  width: 44,
                  height: 44,
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 14,
                  color: "#132333",
                  lineHeight: 1.2,
                }}
              >
                {weatherCardData.title}
              </div>

              <div
                style={{
                  marginTop: 6,
                  fontWeight: 700,
                  fontSize: 13,
                  color: "rgba(19,35,51,0.72)",
                  lineHeight: 1.3,
                }}
              >
                {weatherCardData.wind_text} {" \u2022 "} {weatherCardData.condition_text} {" \u2022 "} {weatherCardData.temp_c}{"\u00B0"}C
              </div>
            </div>
          </section>
        ) : null}

        {/* ===== Airports (RN) ===== */}
        <section className="card">
          <div className="sectionTitleRow">
            <div className="sectionTitle">{airportsTitle}</div>

            <button
              type="button"
              className="infoButton"
              onClick={() => setShowAirportsHelp(true)}
              aria-label="Airports help"
              title="Airports help"
            >
              <img src={UI_ICONS.info} alt ="info button" />
            </button>
          </div>

          {!isOnline ? (
            <div
              style={{
                marginTop: 6,
                marginBottom: 8,
                fontWeight: 700,
                fontSize: 13,
                color: "rgba(19,35,51,0.62)",
                lineHeight: 1.35,
              }}
            >
              Airport schedules unavailable offline
            </div>
          ) : null}

          <div className={cx("airportsBlock", maxFavs > 1 && "airportsBlock--scroll")}>
            {maxFavs > 1 ? (
              <div
                ref={carouselRef}
                className="airportsScroll"
                style={{
                  paddingLeft: carouselSidePad,
                  paddingRight: carouselSidePad,
                  scrollPaddingLeft: carouselSidePad,
                  scrollPaddingRight: carouselSidePad,
                }}
              >
                {memberSlots.map((code, idx) => {
                  const isLast = idx === memberSlots.length - 1;
                  const isAdd = !code;

                  return (
                    <div
                      className="airportsScrollItem"
                      key={`${code || "add"}-${idx}`}
                      style={{
                        width: typeof carouselItemW === "number" ? carouselItemW : undefined,
                        marginRight: isLast ? 0 : carouselGap,
                        scrollSnapAlign: "start",
                      }}
                    >
                      <AirportChip
                        code={code || null}
                        isAdd={isAdd}
                        showPlus={false}
                        label={isAdd ? ADD_SLOT_LABELS[idx] : String(code)}
                        showRemove={!isAdd}
                        disabled={isOffline}
                        onInfoPress={!isOffline && !isAdd ? () => openAirportInfo(code || null) : undefined}
                        onRemove={
                          !isOffline
                            ? () => {
                                if (favs.length <= 1) {
                                  removeFavouriteAt(idx);
                                  return;
                                }
                                setPendingRemoveIndex(idx);
                                setRemoveConfirmVisible(true);
                              }
                            : undefined
                        }
                        onPress={
                          !isOffline
                            ? () => {
                                if (!isAdd && code) {
                                  nav("/week", { state: { airport: normalizeCode(code) } });
                                  return;
                                }

                                nav("/selectairports", {
                                  state: {
                                    mode: "add",
                                    targetSlotIndex: idx,
                                    openPicker: true,
                                    focusSearch: true,
                                    highlightSlot: true,
                                  },
                                });
                              }
                            : undefined
                        }
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="airportsSingle">
                {favs.length > 0 ? (
                  <AirportChip
                    code={favs[0]}
                    showRemove
                    disabled={isOffline}
                    onInfoPress={!isOffline ? () => openAirportInfo(favs[0]) : undefined}
                    onRemove={
                      !isOffline
                        ? () => {
                            setPendingRemoveIndex(0);
                            setRemoveConfirmVisible(true);
                          }
                        : undefined
                    }
                    onPress={!isOffline ? () => nav("/week", { state: { airport: favs[0] } }) : undefined}
                  />
                ) : (
                  <AirportChip
                    isAdd
                    label="Add airport"
                    showPlus={true}
                    disabled={isOffline}
                    onPress={
                      !isOffline
                        ? () =>
                            nav("/selectairports", {
                              state: {
                                mode: "add",
                                targetSlotIndex: 0,
                                openPicker: true,
                                focusSearch: true,
                                highlightSlot: true,
                              },
                            })
                        : undefined
                    }
                  />
                )}
              </div>
            )}
          </div>

          {/* ===== Debug ===== ======================
          <div className="metaLine">
            {isMember ? (
              <>
                Logged in as <strong className="metaStrong">{who || "member"}</strong>
                {employer ? <> ({employer})</> : null}
              </>
            ) : (
              <>Guest mode</>
            )}
          </div>
          ===== =============================== ===== */}
        </section>

        {/* ===== Messages banner (member-only) ===== */}
        {isOnline && isMember && unreadMsgCount > 0 ? (
          <section
            className="card"
            role="button"
            tabIndex={0}
            onClick={() => nav("/messages")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") nav("/messages");
            }}
            style={{
              cursor: "pointer",
              borderColor: "rgba(185,28,28,0.18)",
              background: "rgba(185,28,28,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900, color: "#132333" }}>
                  You have {unreadMsgCount} unread message{unreadMsgCount === 1 ? "" : "s"}
                </div>
                <div style={{ marginTop: 4, fontWeight: 800, fontSize: 12, color: "rgba(19,35,51,0.55)" }}>
                  Tap to open Messages
                </div>
              </div>

              <div
                style={{
                  minWidth: 34,
                  height: 34,
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  border: "2px solid rgba(185,28,28,0.20)",
                  color: "#b91c1c",
                  background: "#ffffff",
                }}
                aria-label="Unread messages count"
                title="Unread messages"
              >
                {unreadMsgCount}
              </div>
            </div>
          </section>
        ) : null}

        {/* ===== Quick actions (RN) ===== */}
        <section className="quickWrap">
          {/*   <div className="quickTitle">Quick actions</div>   */}

          {!isMember ? (
            <>
			
              <div className="quickGridRow">
                <button type="button" className="quickTile" onClick={() => nav("/hotels")}>
                  <div className="quickTileTitle">Hotels</div>
                  <div className="quickTileSub">Schiphol area hotels</div>
                </button>

                <button type="button" className="quickTile" onClick={() => nav("/standby-rooms")}>
                  <div className="quickTileTitle">Rooms</div>
                  <div className="quickTileSub">Short stay rooms</div>
                </button>
              </div>			
			
              <div className="quickGridRow">
                <button type="button" className="quickTile" onClick={() => nav("/legal")}>
                  <div className="quickTileTitle">Legal</div>
                  <div className="quickTileSub">Privacy & terms</div>
                </button>

                <button type="button" className="quickTile" onClick={() => setSignUpModalVisible(true)}>
                  <div className="quickTileTitle">Sign up</div>
                  <div className="quickTileSub">New user registration</div>
                </button>
              </div>

              <div className="quickGridRow">
                <button type="button" className="quickTile" onClick={() => nav("/faq")}>
                  <div className="quickTileTitle">FAQ</div>
                  <div className="quickTileSub">Help & info</div>
                </button>

                <button type="button" className="quickTile" onClick={() => nav("/donate")}>
                  <div className="quickTileTitle">Donate</div>
                  <div className="quickTileSub">Keep the app running</div>
                </button>
              </div>

              <div className="promoSpacer">
                <GuestPromoCard apiBaseUrl={API_BASE_URL} />
              </div>
            </>
          ) : (
            <>
              <div className="quickGridRow">
                <button type="button" className="quickTile" onClick={() => nav("/myflights")}>
                  <div className="quickTileTitle">My Flights</div>
                  <div className="quickTileSub">View your flights</div>
                </button>

                <button type="button" className="quickTile" onClick={() => nav("/crew-lockers")}>
                  <div className="quickTileTitle">Crew Lockers</div>
                  <div className="quickTileSub">Open & manage</div>
                </button>
              </div>

              <div className="quickGridRow">
                <button type="button" className="quickTile" onClick={() => nav("/hotels")}>
                  <div className="quickTileTitle">Hotels</div>
                  <div className="quickTileSub">Crew rate hotels</div>
                </button>

                <button type="button" className="quickTile" onClick={() => nav("/standby-rooms")}>
                  <div className="quickTileTitle">Rooms</div>
                  <div className="quickTileSub">Short stay rooms</div>
                </button>
              </div>
			  
              <div className="quickGridRow">
                <button type="button" className="quickTile" onClick={() => nav("/profile")}>
                  <div className="quickTileTitle">My Profile</div>
                  <div className="quickTileSub">Personal details</div>
                </button>

                <button type="button" className="quickTile" onClick={() => nav("/messages")}>
                  <div className="quickTileTitle">Messages</div>
                  <div className="quickTileSub">View notifications</div>
                </button>
              </div>			  

              <div className="quickGridRow">
                <button type="button" className="quickTile" onClick={() => nav("/faq")}>
                  <div className="quickTileTitle">FAQ</div>
                  <div className="quickTileSub">Help & info</div>
                </button>

                <button type="button" className="quickTile" onClick={() => nav("/donate")}>
                  <div className="quickTileTitle">Donate</div>
                  <div className="quickTileSub">Keep the app running</div>
                </button>
              </div>
            </>
          )}
        </section>

        {/* ===== Dev tools (keep) =====
        <div className="devWrap">
          <div className="devTitle">Dev tools</div>

          <div className="devRow">
            <button type="button" onClick={() => nav("/debug")} className="devBtn">
              Open debug
            </button>

            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(STORAGE_PENDING_USERNAME);
                window.location.reload();
              }}
              className="devBtn"
            >
              Clear pending onboarding
            </button>
          </div>
        </div>
        ==================================*/}
      </div>
	  
	  
	  
	  
    {/* ==========Airports info modal (RN)=============*/}
	{airportInfoOpen ? (
	  <AirportInfoModal
		isOpen={airportInfoOpen}
		airportCode={airportInfoCode}
		onClose={closeAirportInfo}
	  />
	) : null}
		  
	  
    {/* ==================================*/}	  
	  
	   

      {/* ===== Airports help modal (RN) ===== */}
      {showAirportsHelp ? (
        <div className="modalOverlay" onClick={() => setShowAirportsHelp(false)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalTitle">My airports</div>

            <div className="modalBody">Tap an airport to open its weekly schedule.</div>
            <div className="modalBody">Tap i to view airport info and listing cutoff.</div>
            <div className="modalBody">Tap{"\u00D7"} to remove an airport.</div>
            <div className="modalBody">Tap Add airport to choose another.</div>

            <button type="button" className="modalBtn modalBtnPrimary" onClick={() => setShowAirportsHelp(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      {/* ===== Remove confirm modal (RN) ===== */}
      {removeConfirmVisible ? (
        <div
          className="modalOverlay"
          onClick={() => {
            setRemoveConfirmVisible(false);
            setPendingRemoveIndex(null);
          }}
        >
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalTitle">Remove airport?</div>
            <div className="modalBody">This will remove the airport from your favourites.</div>

            <div className="modalBtnRow">
              <button
                type="button"
                className="modalBtn modalBtnGhost"
                onClick={() => {
                  setRemoveConfirmVisible(false);
                  setPendingRemoveIndex(null);
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="modalBtn modalBtnPrimary"
                onClick={() => {
                  if (typeof pendingRemoveIndex === "number") removeFavouriteAt(pendingRemoveIndex);
                  setRemoveConfirmVisible(false);
                  setPendingRemoveIndex(null);
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ===== Sign up modal (RN) ===== */}
      {signUpModalVisible ? (
        <div className="modalOverlay" onClick={() => setSignUpModalVisible(false)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalTitle">Create an account</div>
            <div className="modalBody">registered users can:</div>
            <div className="modalBody">{"\u2022"} Save up to 3 airports</div>
            <div className="modalBody">{"\u2022"} List / unlist on KLM flights</div>
            <div className="modalBody">{"\u2022"} View commuter lists and booking status</div>

            <div className="modalBtnRow">
              <button type="button" className="modalBtn modalBtnGhost" onClick={() => setSignUpModalVisible(false)}>
                Not now
              </button>

              <button
                type="button"
                className="modalBtn modalBtnPrimary"
                onClick={() => {
                  setSignUpModalVisible(false);
                  nav("/register");
                }}
              >
                Sign up
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}