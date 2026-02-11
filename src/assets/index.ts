// src/assets/index.ts

// App images
import APP_LOGO from "../../assets/xcmxfa-logo.png";
import SCHIPHOL_IMG from "../../assets/schiphol.webp";

// Airline logos
import KLM from "../../assets/airlines/klm.webp";
import TRANSAVIA from "../../assets/airlines/transavia.webp";
import DELTA from "../../assets/airlines/delta.webp";

// Listing status icons
import pending from "../../assets/icons/pending.webp";
import sent from "../../assets/icons/sent.webp";
import booked from "../../assets/icons/booked.webp";

// UI icons
import arrivals from "../../assets/icons/arrivals.png";
import departures from "../../assets/icons/departures.png";
import eyes_open from "../../assets/icons/eyes_open.webp";
import eyes_closed from "../../assets/icons/eyes_closed.webp";
import locked from "../../assets/icons/locked.webp";
import STOP_SIGN from "../../assets/icons/stop.webp";

export const APP_IMAGES = { APP_LOGO, SCHIPHOL_IMG } as const;

// IMPORTANT: your current export uses lowercase keys but imports are uppercase vars.
// This fixes it.
export const AIRLINE_LOGOS = {
  KLM,
  TRANSAVIA,
  DELTA,
} as const;

export const LISTING_STATUS_ICONS = { pending, sent, booked } as const;

export const UI_ICONS = {
  arrivals,
  departures,
  eyes_open,
  eyes_closed,
  locked,
  STOP_SIGN,
} as const;

// -------- Airports (WEB) --------
// This will load ALL airport images under ../../assets/airports/*.webp
const airportFiles = import.meta.glob("../../assets/airports/*.webp", {
  eager: true,
  import: "default",
}) as Record<string, string>;

export const AIRPORT_LOGOS: Record<string, string> = Object.fromEntries(
  Object.entries(airportFiles).map(([path, url]) => {
    const match = path.match(/\/([A-Z0-9]{3})\.webp$/i);
    const code = match ? match[1].toUpperCase() : null;
    return code ? [code, url] : [path, url];
  })
);

export function getAirportLogo(code: string) {
  const k = String(code || "").toUpperCase();
  return AIRPORT_LOGOS[k] || null;
}
