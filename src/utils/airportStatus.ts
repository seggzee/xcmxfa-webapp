// src/utils/airportStatus.ts
//
// =====================================================================================
// AIRPORT STATUS NORMALISATION + 3x3 AIRPORT-CONTROLLED OVERRIDE
// =====================================================================================
//
// PURPOSE
// - Keep airport operational status display in one source-scoped helper.
// - Keep AENA/SIGER status-code handling in one provider-scoped mapping.
// - Support the locked two-day departure rule for the 3x3 flight card.
//
// LOCKED RULES
// - AENA behaviour is source-scoped to source_name = AENA_OFFICIAL.
// - AENA codes must NOT be blindly applied to every airport feed.
// - AENA raw-code diagnostic mode is closed.
// - AENA display now uses mapped user-facing labels.
// - BOR is context-sensitive:
//     * DEP displays Departed.
//     * ARR displays Arrived.
//     * missing/unknown direction displays Unknown.
// - Flights departing AMS today/tomorrow UTC:
//     * KL and HV 3x3 status/gate are controlled by Schiphol.
// - HV flights departing other airports today/tomorrow UTC:
//     * A real airport_overlay_dep controls 3x3 status/gate.
//       This covers AENA-fed airports and RTM/EIN source overlays.
//     * If no airport_overlay_dep is attached, status/gate are Unknown/N/A.
//       HV airline/canonical fallback is not allowed in this window.
// - Day 3 onwards remains unchanged.
// - Arrival overlays must not control departure 3x3 status/gate.
// =====================================================================================

export type AirportStatusDirection = "DEP" | "ARR" | "departure" | "arrival" | string;

type AirportStatusArgs = {
  sourceName?: unknown;
  statusCode?: unknown;
  statusText?: unknown;
  direction?: AirportStatusDirection;
};

type Airport3x3Override = {
  statusLabel: string;
  gateDisplay: string;
  source: "SCHIPHOL" | "AIRPORT_OVERLAY_DEP" | "HV_NO_FEED";
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function safeUpper(v: unknown) {
  return String(v || "").trim().toUpperCase();
}

export function toCleanString(v: unknown) {
  return String(v ?? "").trim();
}

export function dateToUtcDateKey(d: Date) {
  const y = d.getUTCFullYear();
  const m = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  return `${y}-${m}-${day}`;
}

export function utcDateKeyFromValue(v: unknown) {
  const s = toCleanString(v);
  if (!s) return "";

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";

  return dateToUtcDateKey(d);
}

export function isUtcTodayOrTomorrow(v: unknown) {
  const key = utcDateKeyFromValue(v);
  if (!key) return false;

  const now = new Date();
  const todayUtc = dateToUtcDateKey(now);

  const tomorrow = new Date(now.getTime());
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowUtc = dateToUtcDateKey(tomorrow);

  return key === todayUtc || key === tomorrowUtc;
}

export function isRealOverlay(overlay: any) {
  return Boolean(overlay && typeof overlay === "object" && overlay?.is_fallback !== true);
}

export function normalisePublicStatus(raw: unknown) {
  const s = toCleanString(raw);
  if (!s) return "";

  const u = s.toUpperCase().replace(/_/g, " ");

  const map: Record<string, string> = {
    SCHEDULED: "Scheduled",
    UNKNOWN: "Unknown",
    CANCELLED: "Cancelled",
    CANCELED: "Cancelled",
    DELAYED: "Delayed",
    DEPARTED: "Departed",
    ARRIVED: "Arrived",
    LANDED: "Landed",
    "IN FLIGHT": "In flight",
    "ON TIME": "On time",
    BOARDING: "Boarding",
    "GATE OPEN": "Gate open",
    "GATE CLOSING": "Gate closing",
    "GATE CLOSED": "Gate closed",
    "FINAL CALL": "Final call",
    "FINAL APPROACH": "Final approach",
    "ESTIMATED DEPARTURE": "Estimated departure",
    DIVERTED: "Diverted",
  };

  return map[u] || s;
}




export function normaliseAenaStatus(args: {
  statusCode?: unknown;
  statusText?: unknown;
  direction?: AirportStatusDirection;
}) {
  const code = safeUpper(args.statusCode);
  const direction = safeUpper(args.direction);

  // AENA / SIGER STATUS MAPPING - SOURCE-SCOPED
  // LOCKED:
  // - Applies only via normaliseAirportStatus() when source_name = AENA_OFFICIAL.
  // - AENA codes must not be applied globally to other airport feeds.
  // - BOR is context-sensitive:
  //     DEP => Departed
  //     ARR => Arrived
  //     unknown direction => Unknown
  // - Missing / unmapped => Unknown.
  void args.statusText;

  if (!code) return "Unknown";

  const map: Record<string, string> = {
    SAL: "Departed",
    CER: "Departed",

    AIR: "In flight",
    FLY: "In flight",

    FNL: "Final approach",
    LND: "Landed",
    IBK: "Arrived",

    OPE: "Gate open",
    ULL: "Final call",
    EMB: "Boarding",
    APE: "Boarding",

    EST: "Estimated departure",

    PRG: "Scheduled",
    SCH: "Scheduled",
    INI: "Scheduled",

    HOR: "On time",

    RET: "Delayed",
    DEM: "Delayed",
    REM: "Delayed",

    CNL: "Cancelled",
    CAN: "Cancelled",

    DES: "Diverted",
  };

  if (code === "BOR") {
    if (direction === "DEP" || direction === "DEPARTURE") return "Departed";
    if (direction === "ARR" || direction === "ARRIVAL") return "Arrived";
    return "Unknown";
  }

  return map[code] || "Unknown";
}



export function normaliseAirportStatus(args: AirportStatusArgs) {
  const source = safeUpper(args.sourceName);

  if (source === "AENA_OFFICIAL") {
    return normaliseAenaStatus({
      statusCode: args.statusCode,
      statusText: args.statusText,
      direction: args.direction,
    });
  }

  // Non-AENA providers keep provider text semantics.
  // Do not apply AENA codes globally.
  const text = normalisePublicStatus(args.statusText);
  if (text) return text;

  // If a non-AENA provider sends only a raw code and no mapped text, keep UI safe.
  if (toCleanString(args.statusCode)) return "Unknown";

  return "";
}

export function normaliseSchipholPublicState(raw: unknown) {
  const u = safeUpper(raw);
  if (!u) return "";

  const map: Record<string, string> = {
    SCH: "Scheduled",
    EXP: "Expected",
    GTO: "Gate open",
    BRD: "Boarding",
    GCL: "Gate closing",
    GTD: "Gate closed",
    DEP: "Departed",
    CNX: "Cancelled",
    AIR: "In flight",
    ARR: "Arrived",
    LND: "Landed",
    DEL: "Delayed",
  };

  return map[u] || normalisePublicStatus(raw);
}

export function buildAirport3x3Override(flight: any): Airport3x3Override | null {
  const f = flight || {};

  // Locked two-day departure window. Day 3 onwards stays as previously agreed.
  if (!isUtcTodayOrTomorrow(f?.std_utc)) return null;

  const airline = safeUpper(f?.airline_iata);
  const depAirport = safeUpper(f?.dep_airport);

  // AMS DEPARTURE 3x3 RULE - LOCKED:
  // - KL and HV departures from AMS use Schiphol for visible 3x3 status/gate.
  // - This keeps AMS departures uniform and avoids mixed airline/airport wording.
  // - Other airlines are intentionally left unchanged unless explicitly agreed later.
  if (depAirport === "AMS" && (airline === "KL" || airline === "HV")) {
    const s = f?.schiphol ?? null;

    return {
      source: "SCHIPHOL",
      statusLabel: normaliseSchipholPublicState(s?.public_flight_state) || "Unknown",
      gateDisplay: toCleanString(s?.gate) || "N/A",
    };
  }

  // HV OUTSTATION DEPARTURE 3x3 RULE - LOCKED:
  // - HV flights departing other airports in the two-day operational window are
  //   either airport-controlled or Unknown.
  // - If airport_overlay_dep exists, it controls status/gate.
  // - If airport_overlay_dep is missing, do NOT fall back to HV airline/canonical
  //   status/gate because HV batch/API status can be stale or wrong for live ops.
  // - AENA_OFFICIAL now displays mapped labels via normaliseAirportStatus().
  // - KLM outstation 3x3 behaviour remains unchanged.
  if (airline !== "HV") return null;

  const depOverlay = f?.airport_overlay_dep ?? null;
  if (!isRealOverlay(depOverlay)) {
    return {
      source: "HV_NO_FEED",
      statusLabel: "Unknown",
      gateDisplay: "N/A",
    };
  }

  return {
    source: "AIRPORT_OVERLAY_DEP",
    statusLabel:
      normaliseAirportStatus({
        sourceName: depOverlay?.source_name,
        statusCode: depOverlay?.status_code,
        statusText: depOverlay?.status_text,
        direction: "DEP",
      }) || "Unknown",
    gateDisplay: toCleanString(depOverlay?.gate) || "N/A",
  };
}

// Backwards-compatible alias for any existing imports during this reissue.
// New code should import buildAirport3x3Override().
export const buildHvAirport3x3Override = buildAirport3x3Override;
