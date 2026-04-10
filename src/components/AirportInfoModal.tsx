// src/components/AirportInfoModal.tsx
//
// PURPOSE
// - Stand-alone reusable airport info modal
// - Exact clone of the CURRENT working Home airport info modal
//
// CONTRACT
// - Parent owns:
//     isOpen
//     airportCode
//     onClose
// - Component owns:
//     fetch
//     loading state
//     parsed airport meta
//     ticking clock
//     countdown calculation
//
// IMPORTANT
// - This file intentionally mirrors the CURRENT Home modal structure and logic.
// - No layout redesign.
// - No class-name changes.
// - No behavioural changes.

import React from "react";
import { API_BASE_URL } from "../config/api";
import { getAirportLogo } from "../assets";
import "../styles/airportInfoModal.css";

type AirportInfoMeta = {
  code: string;
  name?: string | null;
  timezone?: string | null;
  listing_cutoff_local?: string | null;
  listing_cutoff_utc?: string | null;
};

type Props = {
  isOpen: boolean;
  airportCode: string | null;
  onClose: () => void;
};

function normalizeCode(v: any) {
  return String(v || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);
}

function fmtClockInTz(nowMs: number, tz: string) {
  const d = new Date(nowMs);

  const local = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  });

  const utc = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });

  return `${local} local (${utc} UTC)`;
}

/**
 * String-only display normalizer for HH:MM / HH:MM:SS.
 * - No Date parsing
 * - No timezone conversion
 */
function fmtHm(raw: any) {
  const s = String(raw || "").trim();
  const m = s.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  return m ? `${m[1]}:${m[2]}` : s;
}

function fmtLocalUtcPair(localRaw: any, utcRaw: any) {
  const local = fmtHm(localRaw);
  const utc = fmtHm(utcRaw);

  if (!local && !utc) return "— —";
  if (local && utc) return `${local} local (${utc} UTC)`;
  if (local) return `${local} local`;
  return `${utc} UTC`;
}

export default function AirportInfoModal(props: Props) {
  const { isOpen, airportCode, onClose } = props;

  const [airportInfoBusy, setAirportInfoBusy] = React.useState(false);
  const [airportInfoMeta, setAirportInfoMeta] = React.useState<AirportInfoMeta | null>(null);
  const [airportInfoNowMs, setAirportInfoNowMs] = React.useState<number>(() => Date.now());

  React.useEffect(() => {
    if (!isOpen) return;

    setAirportInfoNowMs(Date.now());

    const id = window.setInterval(() => {
      setAirportInfoNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(id);
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;

    const code = normalizeCode(airportCode);
    if (!code) return;

    let alive = true;

    async function openAirportInfo(codeLike: string | null | undefined) {
      const code = normalizeCode(codeLike);
      if (!code) return;

      setAirportInfoBusy(true);
      setAirportInfoMeta({
        code,
        name: null,
        timezone: null,
        listing_cutoff_local: null,
        listing_cutoff_utc: null,
      });

      try {
        const res = await fetch(`${API_BASE_URL}/api/airports/info.php`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ airport_code: code }),
        });

        const text = await res.text();

        let json: any = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = null;
        }

        if (!alive) return;

        if (!res.ok || !json || json.ok !== true) {
          setAirportInfoMeta({
            code,
            name: null,
            timezone: null,
            listing_cutoff_local: null,
            listing_cutoff_utc: null,
          });
          return;
        }

        const meta = json.airport || json.data || json.meta || {};

        setAirportInfoMeta({
          code,
          name: String(meta.name || meta.airport_name || "").trim() || null,
          timezone: String(meta.timezone || meta.listing_timezone || "").trim() || null,
          listing_cutoff_local:
            String(meta.listing_cutoff_local || meta.cutoff_local || "").trim() || null,
          listing_cutoff_utc:
            String(meta.listing_cutoff_utc || meta.cutoff_utc || "").trim() || null,
        });
      } catch {
        if (!alive) return;
        setAirportInfoMeta({
          code,
          name: null,
          timezone: null,
          listing_cutoff_local: null,
          listing_cutoff_utc: null,
        });
      } finally {
        if (alive) setAirportInfoBusy(false);
      }
    }

    openAirportInfo(code);

    return () => {
      alive = false;
    };
  }, [isOpen, airportCode]);

  if (!isOpen) return null;

  return (
    <div
      className="modalOverlay"
      onClick={() => {
        onClose();
      }}
    >
      <div
        className="modalCard airportInfoModalCard"
        onClick={(e) => e.stopPropagation()}
      >
        {(() => {
          const code = String(airportInfoMeta?.code || "").trim().toUpperCase();
          const name = String(airportInfoMeta?.name || "").trim();
          const tz = String(airportInfoMeta?.timezone || "").trim();
          const logoSrc = code ? getAirportLogo(code) : "";

          const cutoffLocal = fmtHm(airportInfoMeta?.listing_cutoff_local);

          let airportNowText = "— —";
          let cutoffDisplayText = "— —";
          let countdownMode: "countdown" | "closed" | "unknown" = "unknown";
          let countdownText = "";

          if (tz) {
            airportNowText = fmtClockInTz(airportInfoNowMs, tz);
          }

          if (!airportInfoBusy) {
            cutoffDisplayText = fmtLocalUtcPair(
              airportInfoMeta?.listing_cutoff_local,
              airportInfoMeta?.listing_cutoff_utc
            );
          } else {
            cutoffDisplayText = "Loading…";
          }

          // ===== countdown calc (UNCHANGED LOGIC) =====
          if (!airportInfoBusy && tz && /^\d{2}:\d{2}$/.test(cutoffLocal)) {
            try {
              const now = new Date(airportInfoNowMs);

              const dateParts = new Intl.DateTimeFormat("en-CA", {
                timeZone: tz,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).formatToParts(now);

              const yyyy = Number(dateParts.find((p) => p.type === "year")?.value || 0);
              const mm = Number(dateParts.find((p) => p.type === "month")?.value || 0);
              const dd = Number(dateParts.find((p) => p.type === "day")?.value || 0);

              const [cutoffHH, cutoffMM] = cutoffLocal.split(":").map(Number);

              const getOffsetMsAtInstant = (ms: number, timeZone: string) => {
                const parts = new Intl.DateTimeFormat("en-US", {
                  timeZone,
                  hour12: false,
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                }).formatToParts(new Date(ms));

                const y = Number(parts.find((p) => p.type === "year")?.value || 0);
                const m = Number(parts.find((p) => p.type === "month")?.value || 0);
                const d = Number(parts.find((p) => p.type === "day")?.value || 0);
                const h = Number(parts.find((p) => p.type === "hour")?.value || 0);
                const mi = Number(parts.find((p) => p.type === "minute")?.value || 0);
                const s = Number(parts.find((p) => p.type === "second")?.value || 0);

                const asUtc = Date.UTC(y, m - 1, d, h, mi, s, 0);
                return asUtc - ms;
              };

              const zonedToUtc = (y: number, m: number, d: number, h: number, mi: number, tz: string) => {
                const naive = Date.UTC(y, m - 1, d, h, mi, 0);
                const offset = getOffsetMsAtInstant(naive, tz);
                return naive - offset;
              };

              const cutoffMs = zonedToUtc(yyyy, mm, dd, cutoffHH, cutoffMM, tz);

              if (airportInfoNowMs < cutoffMs) {
                countdownMode = "countdown";
                const diff = Math.floor((cutoffMs - airportInfoNowMs) / 1000);
                const hh = String(Math.floor(diff / 3600)).padStart(2, "0");
                const mi = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
                const ss = String(diff % 60).padStart(2, "0");
                countdownText = `${hh}:${mi}:${ss}`;
              } else {
                countdownMode = "closed";
              }
            } catch {
              countdownMode = "unknown";
            }
          }

          return (
            <>
              {/* ===== HEADER ===== */}
              <div className="airportInfoModalHeader">
                <div>
                  <div className="airportInfoModalCode">{code || "— —"}</div>
                  <div className="airportInfoModalAirportName">{name || "— —"}</div>
                  <div className="airportInfoModalMeta">
                    {tz || "— —"}
                  </div>
                </div>

                <div className="airportInfoModalHeaderRight">
                  <button
                    className="airportInfoModalCloseBtn"
                    onClick={() => {
                      onClose();
                    }}
                  >
                    ×
                  </button>

                  <div className="airportInfoModalHeaderLogoWrap">
                    {logoSrc ? (
                      <img src={logoSrc} className="airportInfoModalLogo" alt="" />
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="airportInfoModalDivider" />

              {/* ===== BODY ===== */}
              <div className="airportInfoModalBody">
                <div className="airportInfoModalInfoGrid">
                  <div className="airportInfoModalGridLabel">Airport time</div>
                  <div className="airportInfoModalGridValue">
                    {airportInfoBusy ? (
                      "Loading…"
                    ) : (
                      <>
                        <div>
                          {(() => {
                            const m = airportNowText.match(/^(.+?) local/);
                            return m ? `${m[1]} local` : "— —";
                          })()}
                        </div>
                        <div>
                          {(() => {
                            const m = airportNowText.match(/\(([^)]+)\)/);
                            return m ? m[1] : "— —";
                          })()}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="airportInfoModalStatus">
                    {airportInfoBusy ? (
                      <div className="airportInfoModalCountdownBox airportInfoModalCountdownBox--closed">
                        <div className="airportInfoModalCountdownMain">Loading…</div>
                      </div>
                    ) : countdownMode === "countdown" ? (
                      <div className="airportInfoModalCountdownBox">
                        <div className="airportInfoModalCountdownMain">{countdownText}</div>
                        <div className="airportInfoModalCountdownSub">Time to cutoff</div>
                      </div>
                    ) : countdownMode === "closed" ? (
                      <div className="airportInfoModalCountdownBox airportInfoModalCountdownBox--closed">
                        <div className="airportInfoModalCountdownMain">Closed</div>
                        <div className="airportInfoModalCountdownSub">Listing closed</div>
                      </div>
                    ) : (
                      <div className="airportInfoModalCountdownBox airportInfoModalCountdownBox--closed">
                        <div className="airportInfoModalCountdownMain">— —</div>
                      </div>
                    )}
                  </div>

                  <div className="airportInfoModalGridLabel">Cutoff</div>
                  <div className="airportInfoModalGridValue">
                    {airportInfoBusy ? (
                      "Loading…"
                    ) : (
                      <>
                        <div>{fmtHm(airportInfoMeta?.listing_cutoff_local)} local</div>
                        <div>
                          {airportInfoMeta?.listing_cutoff_utc
                            ? `${fmtHm(airportInfoMeta?.listing_cutoff_utc)} UTC`
                            : "— —"}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}