// src/assets/airportLogos.ts

const airportFiles = import.meta.glob("../../assets/airports/*.webp", {
  eager: true,
  import: "default",
}) as Record<string, string>;

export const AIRPORT_LOGOS: Record<string, string> = Object.fromEntries(
  Object.entries(airportFiles).map(([path, url]) => {
    const match = path.match(/\/([A-Z0-9]{3})\.webp$/i);
    if (!match) return [path, url];
    return [match[1].toUpperCase(), url];
  })
);

export function getAirportLogo(code: string) {
  const k = String(code || "").toUpperCase();
  const logo = AIRPORT_LOGOS[k] || null;
  if (!logo) console.error("[AIRPORT_LOGOS] Missing logo:", k);
  return logo;
}
