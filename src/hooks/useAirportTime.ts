import { useEffect, useMemo, useState } from "react";

/*
*	src/hooks/useAirportTime.ts
*
*/

type AirportTimeArgs = {
  timezone?: string | null;
  cutoffHHMM?: string | null;
  reopenLocalHHMM?: string | null; // default 00:30
  isOpen?: boolean;
};

type AirportTimeState = {
  airportNowText: string;
  cutoffText: string;
  mode: "countdown" | "closed" | "unknown";
  countdownText: string;
};

function fmtHHMMInTz(ms: number, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ms));
}

function getTzDateParts(ms: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));

  const yyyy = Number(parts.find((p) => p.type === "year")?.value || 0);
  const mm = Number(parts.find((p) => p.type === "month")?.value || 0);
  const dd = Number(parts.find((p) => p.type === "day")?.value || 0);

  return { yyyy, mm, dd };
}

function getOffsetMsAtInstant(ms: number, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = dtf.formatToParts(new Date(ms));
  const yyyy = Number(parts.find((p) => p.type === "year")?.value || 0);
  const mm = Number(parts.find((p) => p.type === "month")?.value || 0);
  const dd = Number(parts.find((p) => p.type === "day")?.value || 0);
  const hh = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const mi = Number(parts.find((p) => p.type === "minute")?.value || 0);
  const ss = Number(parts.find((p) => p.type === "second")?.value || 0);

  const asUtc = Date.UTC(yyyy, mm - 1, dd, hh, mi, ss, 0);
  return asUtc - ms;
}

function zonedDateTimeToUtcMs(
  yyyy: number,
  mm: number,
  dd: number,
  hh: number,
  mi: number,
  ss: number,
  timeZone: string
) {
  const naiveUtc = Date.UTC(yyyy, mm - 1, dd, hh, mi, ss, 0);
  const offset = getOffsetMsAtInstant(naiveUtc, timeZone);
  return naiveUtc - offset;
}

function plusOneDay(yyyy: number, mm: number, dd: number) {
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  d.setUTCDate(d.getUTCDate() + 1);
  return {
    yyyy: d.getUTCFullYear(),
    mm: d.getUTCMonth() + 1,
    dd: d.getUTCDate(),
  };
}

function parseHHMM(raw: string | null | undefined) {
  const s = String(raw || "").trim();
  const m = s.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;

  const hh = Number(m[1]);
  const mm = Number(m[2]);

  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { hh, mm };
}

function formatAirportNow(nowMs: number, timeZone: string) {
  const local = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(nowMs));

  const utc = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(nowMs));

  return `${local} local (${utc} UTC)`;
}

function formatCutoffDisplay(cutoffHHMM: string, timeZone: string) {
  const parsed = parseHHMM(cutoffHHMM);
  if (!parsed) return "— —";

  const nowMs = Date.now();
  const { yyyy, mm, dd } = getTzDateParts(nowMs, timeZone);

  const cutoffUtcMs = zonedDateTimeToUtcMs(yyyy, mm, dd, parsed.hh, parsed.mm, 0, timeZone);

  const local = cutoffHHMM;
  const utc = fmtHHMMInTz(cutoffUtcMs, "UTC");
  return `${local} local (${utc} UTC)`;
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(total / 3600)).padStart(2, "0");
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function useAirportTime({
  timezone,
  cutoffHHMM,
  reopenLocalHHMM = "00:30",
  isOpen = true,
}: AirportTimeArgs): AirportTimeState {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!isOpen) return;

    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(id);
  }, [isOpen]);

  return useMemo(() => {
    const tz = String(timezone || "").trim();
    const cutoff = String(cutoffHHMM || "").trim();
    const reopen = String(reopenLocalHHMM || "").trim();

    if (!tz || !cutoff) {
      return {
        airportNowText: "— —",
        cutoffText: "— —",
        mode: "unknown" as const,
        countdownText: "",
      };
    }

    const cutoffParsed = parseHHMM(cutoff);
    const reopenParsed = parseHHMM(reopen);

    if (!cutoffParsed || !reopenParsed) {
      return {
        airportNowText: "— —",
        cutoffText: "— —",
        mode: "unknown" as const,
        countdownText: "",
      };
    }

    const airportNowText = formatAirportNow(nowMs, tz);
    const cutoffText = formatCutoffDisplay(cutoff, tz);

    const today = getTzDateParts(nowMs, tz);

    const todayCutoffMs = zonedDateTimeToUtcMs(
      today.yyyy,
      today.mm,
      today.dd,
      cutoffParsed.hh,
      cutoffParsed.mm,
      0,
      tz
    );

    const tomorrow = plusOneDay(today.yyyy, today.mm, today.dd);

    const tomorrowReopenMs = zonedDateTimeToUtcMs(
      tomorrow.yyyy,
      tomorrow.mm,
      tomorrow.dd,
      reopenParsed.hh,
      reopenParsed.mm,
      0,
      tz
    );

    if (nowMs <= todayCutoffMs) {
      return {
        airportNowText,
        cutoffText,
        mode: "countdown" as const,
        countdownText: formatCountdown(todayCutoffMs - nowMs),
      };
    }

    if (nowMs < tomorrowReopenMs) {
      return {
        airportNowText,
        cutoffText,
        mode: "closed" as const,
        countdownText: "",
      };
    }

    const tomorrowCutoffMs = zonedDateTimeToUtcMs(
      tomorrow.yyyy,
      tomorrow.mm,
      tomorrow.dd,
      cutoffParsed.hh,
      cutoffParsed.mm,
      0,
      tz
    );

    return {
      airportNowText,
      cutoffText,
      mode: "countdown" as const,
      countdownText: formatCountdown(tomorrowCutoffMs - nowMs),
    };
  }, [nowMs, timezone, cutoffHHMM, reopenLocalHHMM]);
}