// src/assets/countryFlags.ts

import AUSTRIA from "../../assets/flags/austria_flag.png";
import BELGIUM from "../../assets/flags/belgium_flag.png";
import CROATIA from "../../assets/flags/croatia_flag.png";
import DENMARK from "../../assets/flags/denmark_flag.png";
import FINLAND from "../../assets/flags/finland_flag.png";
import FRANCE from "../../assets/flags/france_flag.png";
import GERMANY from "../../assets/flags/germany_flag.png";
import GREECE from "../../assets/flags/greece_flag.png";
import HUNGARY from "../../assets/flags/hungary_flag.png";
import ITALY from "../../assets/flags/italy_flag.png";
import LUXEMBOURG from "../../assets/flags/luxmbrg_flag.png";
import NORWAY from "../../assets/flags/norway_flag.png";
import POLAND from "../../assets/flags/poland_flag.png";
import PORTUGAL from "../../assets/flags/portugal_flag.png";
import ROI from "../../assets/flags/roi_flag.png";
import SLOVENIA from "../../assets/flags/slovenia_flag.png";
import SPAIN from "../../assets/flags/spain_flag.png";
import SWEDEN from "../../assets/flags/sweden_flag.png";
import SWITZERLAND from "../../assets/flags/switzlnd_flag.png";
import TURKEY from "../../assets/flags/turkey_flag.png";
import UK from "../../assets/flags/uk_flag.png";

// Rest of world
import ARGENTINA from "../../assets/flags/argentina_flag.png";
import ARUBA from "../../assets/flags/aruba_flag.png";
import BONAIRE from "../../assets/flags/bonaire_flag.png";
import BRAZIL from "../../assets/flags/brazil_flag.png";
import CANADA from "../../assets/flags/canada_flag.png";
import COLOMBIA from "../../assets/flags/colombia_flag.png";
import COSTA_RICA from "../../assets/flags/costa_rica_flag.png";
import CURACAO from "../../assets/flags/curacao_flag.png";
import KENYA from "../../assets/flags/kenya_flag.png";
import MEXICO from "../../assets/flags/mexico_flag.png";
import NIGERIA from "../../assets/flags/nigeria_flag.png";
import PANAMA from "../../assets/flags/panama_flag.png";
import SAINT_MARTIN from "../../assets/flags/saint_martin_flag.png";
import SAUDI_ARABIA from "../../assets/flags/saudi_arabia_flag.png";
import SOUTH_AFRICA from "../../assets/flags/south_africa_flag.png";
import SURINAME from "../../assets/flags/suriname_flag.png";
import THAILAND from "../../assets/flags/thailand_flag.png";
import UAE from "../../assets/flags/uae_flag.png";
import USA from "../../assets/flags/usa_flag.png";

export const COUNTRY_FLAGS: Record<string, string> = {
  // Europe
  Austria: AUSTRIA,
  Belgium: BELGIUM,
  Croatia: CROATIA,
  Denmark: DENMARK,
  Finland: FINLAND,
  France: FRANCE,
  Germany: GERMANY,
  Greece: GREECE,
  Hungary: HUNGARY,
  Italy: ITALY,
  Luxembourg: LUXEMBOURG,
  Norway: NORWAY,
  Poland: POLAND,
  Portugal: PORTUGAL,
  ROI: ROI,
  Slovenia: SLOVENIA,
  Spain: SPAIN,
  Sweden: SWEDEN,
  Switzerland: SWITZERLAND,
  Turkey: TURKEY,
  UK: UK,

  // Rest
  Argentina: ARGENTINA,
  Aruba: ARUBA,
  Bonaire: BONAIRE,
  Brazil: BRAZIL,
  Canada: CANADA,
  Colombia: COLOMBIA,
  "Costa Rica": COSTA_RICA,
  Curacao: CURACAO,
  Kenya: KENYA,
  Mexico: MEXICO,
  Nigeria: NIGERIA,
  Panama: PANAMA,
  "Saint Martin": SAINT_MARTIN,
  "Saudi Arabia": SAUDI_ARABIA,
  "South Africa": SOUTH_AFRICA,
  Suriname: SURINAME,
  Thailand: THAILAND,
  UAE: UAE,
  USA: USA,
};

export function getCountryFlag(country: string) {
  const f = COUNTRY_FLAGS[country];
  if (!f) console.error("[COUNTRY_FLAGS] Missing flag:", country);
  return f || null;
}
