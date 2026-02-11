// src/components/FlightCard3x3.tsx


import AIRCRAFT_TYPES from "../assets/aircraftTypes";
import STATUS_COLOUR_CODES from "../assets/statusColourCodes";
import STATUS_LABEL_TRANSLATIONS from "../assets/statusLabelTranslations";
import { AIRLINE_LOGOS, LISTING_STATUS_ICONS } from "../assets";

type Report = { code: string; message: string; context?: any };

function report(onReport: ((r: Report) => void) | undefined, r: Report): string {
  try {
    onReport?.(r);
  } catch {}
  // eslint-disable-next-line no-console
  console.error(`FlightCard3x3[${r.code}]: ${r.message}`, r.context ?? "");
  return `⚠ ${r.code}`;
}

function isReportToken(v: any) {
  return typeof v === "string" && v.startsWith("⚠ ");
}

function toNonEmptyString(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : "";
}

/**
 * RN parity:
 * - RN displays time-only even if API gives datetime.
 * - We extract HH:MM from common formats.
 * - If no HH:MM found, return "" (then we can decide whether to scream).
 */
function extractTimeHHMM(v: any) {
  const s = toNonEmptyString(v);
  if (!s) return "";

  // Match first HH:MM occurrence (covers "2026-02-09 07:45:00", "2026-02-09T07:45:00+01:00", "07:45")
  const m = s.match(/\b([01]\d|2[0-3]):[0-5]\d\b/);
  return m ? m[0] : "";
}

function buildDisplayFlightNo(airline_iata: any, flight_number: any) {
  const a = toNonEmptyString(airline_iata).toUpperCase();
  const n = toNonEmptyString(flight_number);
  return `${a}${n}`;
}

function resolveAirlineLogo({
  logoSource,
  airline_iata,
  displayFlightNo,
  onReport,
}: {
  logoSource?: string | null;
  airline_iata?: any;
  displayFlightNo?: string;
  onReport?: (r: Report) => void;
}) {
  if (logoSource) return logoSource;

  const a = String(airline_iata || "").toUpperCase();

  if (a === "KLM" || a === "KL")
    return (AIRLINE_LOGOS as any).KLM || report(onReport, { code: "E_LOGO_KLM", message: "AIRLINE_LOGOS.KLM missing" });

  if (a === "TRANSAVIA" || a === "HV")
    return (AIRLINE_LOGOS as any).TRANSAVIA ||
      report(onReport, { code: "E_LOGO_HV", message: "AIRLINE_LOGOS.TRANSAVIA missing" });

  if (a === "DELTA" || a === "DL")
    return (AIRLINE_LOGOS as any).DELTA || report(onReport, { code: "E_LOGO_DL", message: "AIRLINE_LOGOS.DELTA missing" });

  const prefix = String(displayFlightNo || "").slice(0, 2).toUpperCase();
  if (prefix === "KL") return (AIRLINE_LOGOS as any).KLM || report(onReport, { code: "E_LOGO_KL_PREFIX", message: "AIRLINE_LOGOS.KLM missing (prefix KL)" });
  if (prefix === "HV") return (AIRLINE_LOGOS as any).TRANSAVIA || report(onReport, { code: "E_LOGO_HV_PREFIX", message: "AIRLINE_LOGOS.TRANSAVIA missing (prefix HV)" });
  if (prefix === "DL") return (AIRLINE_LOGOS as any).DELTA || report(onReport, { code: "E_LOGO_DL_PREFIX", message: "AIRLINE_LOGOS.DELTA missing (prefix DL)" });

  return report(onReport, {
    code: "E_LOGO_UNRESOLVED",
    message: "Cannot resolve airline logo (need airline_iata or known flight prefix)",
    context: { airline_iata, displayFlightNo },
  });
}

function statusKeyFromApi(raw: any, onReport?: (r: Report) => void) {
  const key = toNonEmptyString(raw);
  if (!key) return report(onReport, { code: "E_STATUS_MISSING", message: "Missing flight.op_status" });
  return key;
}

function statusColourFromKey(statusKey: string, onReport?: (r: Report) => void) {
  const v = (STATUS_COLOUR_CODES as any)[statusKey];
  if (!v) return report(onReport, { code: "E_STATUS_COLOUR_UNMAPPED", message: `STATUS_COLOUR_CODES missing "${statusKey}"`, context: { statusKey } });
  return v;
}

function statusLabelFromKey(statusKey: string, onReport?: (r: Report) => void) {
  const v = (STATUS_LABEL_TRANSLATIONS as any)[statusKey];
  if (!v) return report(onReport, { code: "E_STATUS_LABEL_UNMAPPED", message: `STATUS_LABEL_TRANSLATIONS missing "${statusKey}"`, context: { statusKey } });
  return v;
}

function listingIconSourceFromStatus(listing_status: any, onReport?: (r: Report) => void) {
  const s = toNonEmptyString(listing_status).toLowerCase();
  if (!s) return "";
  const v = (LISTING_STATUS_ICONS as any)[s];
  if (!v) return report(onReport, { code: "E_LISTING_ICON_UNMAPPED", message: `LISTING_STATUS_ICONS missing "${s}"`, context: { listing_status } });
  return v;
}

function aircraftDisplayFromTypecode(ac_typecode: any) {
  const key = toNonEmptyString(ac_typecode);
  if (!key) return "N/A";
  const mapped = (AIRCRAFT_TYPES as any)[key];
  return mapped ? String(mapped) : "N/A";
}

export default function FlightCard3x3({
  flight,
  headerLeftLabel,
  headerDate,
  showHeader = true,
  onReport,
}: {
  flight: any;
  headerLeftLabel?: string;
  headerDate?: string;
  showHeader?: boolean;
  onReport?: (r: Report) => void;
}) {
  const f = flight || {};

  // Required (RN parity): status + flight identity + route + times
  const opStatusKey = statusKeyFromApi(f.op_status, onReport);
  const opColour = statusColourFromKey(opStatusKey, onReport);
  const opLabel = statusLabelFromKey(opStatusKey, onReport);

  const displayFlightNo = (() => {
    const a = toNonEmptyString(f.airline_iata);
    const n = toNonEmptyString(f.flight_number);
    if (!a || !n) {
      return report(onReport, {
        code: "E_FLIGHTNO_MISSING",
        message: "Missing flight.airline_iata or flight.flight_number",
        context: { airline_iata: f.airline_iata, flight_number: f.flight_number },
      });
    }
    return buildDisplayFlightNo(a, n);
  })();

  const logo = resolveAirlineLogo({
    logoSource: f.logoSource,
    airline_iata: f.airline_iata,
    displayFlightNo: isReportToken(displayFlightNo) ? "" : String(displayFlightNo),
    onReport,
  });

  const depCode = toNonEmptyString(f.dep_airport);
  const arrCode = toNonEmptyString(f.arr_airport);

  // RN parity: display TIME ONLY
  const depTimeHHMM = extractTimeHHMM(f.std_local);
  const arrTimeHHMM = extractTimeHHMM(f.sta_local);

  // If we cannot extract any time at all, that’s a real data issue.
  const depTimeDisplay = depTimeHHMM || report(onReport, { code: "E_DEP_TIME_MISSING", message: "Missing/invalid flight.std_local (no HH:MM found)", context: { std_local: f.std_local } });
  const arrTimeDisplay = arrTimeHHMM || report(onReport, { code: "E_ARR_TIME_MISSING", message: "Missing/invalid flight.sta_local (no HH:MM found)", context: { sta_local: f.sta_local } });

  // Optional (RN parity): Gate / Type / Reg are NOT guaranteed
  const gateDisplay = toNonEmptyString(f.dep_gate) || "N/A";
  const typeDisplay = aircraftDisplayFromTypecode(f.ac_typecode);
  const regDisplay = toNonEmptyString(f.ac_reg) || "N/A";

  const isCancelled = opStatusKey === "CANCELLED";
  const listingIconSource = listingIconSourceFromStatus(f.listing_status, onReport);

  const listPosDisplay = (() => {
    const posRaw = f.list_position !== undefined && f.list_position !== null ? String(f.list_position).trim() : "";
    const totalRaw = f.list_total !== undefined && f.list_total !== null ? String(f.list_total).trim() : "";

    if (!posRaw) return "";

    if (/^P\d+(\/\d+)?$/i.test(posRaw)) return posRaw.toUpperCase();
    if (/^\d+\/\d+$/.test(posRaw)) return `P${posRaw}`;
    if (/^\d+$/.test(posRaw) && /^\d+$/.test(totalRaw)) return `P${posRaw}/${totalRaw}`;
    if (/^\d+$/.test(posRaw)) return `P${posRaw}`;

    return report(onReport, { code: "E_LISTPOS_FORMAT", message: `Invalid list_position "${posRaw}"`, context: { posRaw, totalRaw } });
  })();

  const statusBorderColor = isReportToken(opColour) ? "rgba(220,38,38,0.6)" : (opColour as string);
  const statusTextColor = isReportToken(opColour) ? "rgba(220,38,38,0.85)" : (opColour as string);

  return (
    <div className="flightCard">
      {showHeader && (headerLeftLabel || headerDate) ? (
        <div className="flightCard-headerRow">
          <div className="flightCard-headerColLeft">
            {headerLeftLabel ? <div className="flightCard-headerTitle">{headerLeftLabel}</div> : null}
          </div>
          <div className="flightCard-headerColCenter">
            {headerDate ? <div className="flightCard-headerDate">{headerDate}</div> : null}
          </div>
          <div className="flightCard-headerColRight" />
        </div>
      ) : null}

      <div className="flightCard-grid">
        <div className="flightCard-row">
          <div className="flightCard-cell">
            <div className="flightCard-logoFlightRow">
              {logo && !isReportToken(logo) ? (
                <img className="flightCard-airlineLogo" src={logo} alt="Airline" />
              ) : (
                <div className="flightCard-errorBox">{String(logo || "⚠ E_LOGO")}</div>
              )}
              <div className="flightCard-flightNo">{isReportToken(displayFlightNo) ? "" : String(displayFlightNo)}</div>
            </div>
          </div>

          <div className="flightCard-cell flightCard-centerCell">
            <div className="flightCard-route">
              {String(depCode || "")} → {String(arrCode || "")}
            </div>
          </div>

          <div className="flightCard-cell flightCard-rightCell">
            <div className="flightCard-statusPill" style={{ borderColor: statusBorderColor }}>
              <div className="flightCard-status" style={{ color: statusTextColor }}>
                {String(opLabel)}
              </div>
            </div>
          </div>
        </div>

        <div className="flightCard-row flightCard-rowSpaced">
          <div className="flightCard-cell">
            <div className="flightCard-timeRow">
              <div className="flightCard-arrow" style={{ backgroundColor: statusTextColor }} aria-hidden="true">
                ↗
              </div>
              <div className={`flightCard-time ${isCancelled ? "flightCard-timeCancelled" : ""}`}>
                {String(depTimeDisplay)} LT
              </div>
            </div>
          </div>

          <div className="flightCard-cell flightCard-centerCell">
            <div className="flightCard-timeRow">
              <div className="flightCard-arrow" style={{ backgroundColor: statusTextColor }} aria-hidden="true">
                ↘
              </div>
              <div className={`flightCard-time ${isCancelled ? "flightCard-timeCancelled" : ""}`}>
                {String(arrTimeDisplay)} LT
              </div>
            </div>
          </div>

          <div className="flightCard-cell flightCard-rightCell">
            <div className="flightCard-meta">Gate: {String(gateDisplay)}</div>
          </div>
        </div>

        <div className="flightCard-row flightCard-rowFooter">
          <div className="flightCard-cell">
            <div className="flightCard-footer">Type: {String(typeDisplay)}</div>
          </div>

          <div className="flightCard-cell">
            <div className="flightCard-footer">Reg: {String(regDisplay)}</div>
          </div>

          <div className="flightCard-cell flightCard-rightCell">
            <div className="flightCard-listingRightRow">
              <div className="flightCard-footer">{String(listPosDisplay)}</div>

              {listingIconSource && !isReportToken(listingIconSource) ? (
                <img className="flightCard-listingStatusIcon" src={listingIconSource} alt="Listing status" />
              ) : listingIconSource ? (
                <div className="flightCard-errorBox">{String(listingIconSource)}</div>
              ) : (
                <div className="flightCard-listingStatusIcon" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
