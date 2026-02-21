// src/assets/index.ts
//
// =====================================================================================
// ?? CENTRAL ASSET RESOLVER (THE ONLY PLACE WE RESOLVE IMAGE FILES)
// =====================================================================================
//
// IDIOT GUIDE:
//
// This file is the “asset router” for the entire webapp.
//
// Components MUST NOT:
// - use "/assets/..." URLs
// - build URLs by string interpolation
//
// Components MUST:
// - import from "../assets" and use:
//     getAirportLogo(code)
//     AIRLINE_LOGOS
//     LISTING_STATUS_ICONS
//     UI_ICONS
//
// WHY THIS WORKS:
// - Importing an asset forces the bundler to include it in the build.
// - The bundler returns the correct final URL (usually with a hash).
// - That URL works after build on Synology static hosting.
// =====================================================================================

// App images
import APP_LOGO from "../../assets/xcmxfa-logo.png";
import SCHIPHOL_IMG from "../../assets/schiphol.webp";
import HEADER_LOGO from "../../assets/logos/xcmxfa-header-logo.webp";



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
import MENU from "../../assets/icons/menu.webp";
import DONATE from "../../assets/icons/donate.webp";

import avatar from "../../assets/avatar.jpg";
import calendar from "../../assets/icons/calendar.webp";

import BACK from "../../assets/back_button.webp";

// ? NEW: avatar + calendar are now imported (bundled) so pages/components never use "/assets/..."



export const APP_IMAGES = { APP_LOGO, SCHIPHOL_IMG, HEADER_LOGO } as const;

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
  MENU,
  DONATE,

  // ? Added (now safe to use everywhere)
  avatar,
  calendar,
  BACK,
  
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


// =====================================================================================
// DIY SCANS (XCM/XFA listing help cards)
// =====================================================================================
// Idiot guide:
// - These are the 5 “Check in an XCM/XFA in 5 easy steps” reference images.
// - They MUST be imported here so bundler includes them in PROD build.
// - Pages/components must NOT string-build /assets/... paths.
// =====================================================================================

import XCMXFA_SCAN_1 from "../../assets/scans/xcmxfa1.webp";
import XCMXFA_SCAN_2 from "../../assets/scans/xcmxfa2.webp";
import XCMXFA_SCAN_3 from "../../assets/scans/xcmxfa3.webp";
import XCMXFA_SCAN_4 from "../../assets/scans/xcmxfa4.webp";
import XCMXFA_SCAN_5 from "../../assets/scans/xcmxfa5.webp";

export const DIY_LISTING_SCANS = {
  xcmxfa1: XCMXFA_SCAN_1,
  xcmxfa2: XCMXFA_SCAN_2,
  xcmxfa3: XCMXFA_SCAN_3,
  xcmxfa4: XCMXFA_SCAN_4,
  xcmxfa5: XCMXFA_SCAN_5,
} as const;