import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CREW_GET_URL, postJson } from "./api";
import { useAuth } from "./authStore";

/**
 * Idiot-guide:
 * RN AppRoot has:
 * - crewCache (the last loaded member row)
 * - loadCrew() (POST { psn } -> /api/members/get.php)
 *
 * Web equivalent:
 * - We expose `crew` (same idea as crewCache, but named what screens expect)
 * - We expose `loadCrew()` for explicit loads (onboarding / refresh / debug)
 * - We auto-load when auth becomes "member" and a psn exists
 *
 * Why keep a "crew cache" at all?
 * - Because many screens need member profile fields (employer, firstname, airports, etc.)
 * - You do NOT want every screen to refetch /members/get.php independently.
 *
 * STRICT MODE RULE:
 * - No silent fallbacks.
 * - If auth says "member" but psn is missing, we log it loudly.
 */

type CrewContextValue = {
  crew: any | null;
  setCrew: React.Dispatch<React.SetStateAction<any | null>>;
  loadCrew(psnOverride?: string): Promise<any | null>;
};

const CrewCtx = createContext<CrewContextValue | null>(null);

export function CrewProvider({ children }: { children: React.ReactNode }) {
  const { auth, psn, authHeader } = useAuth();

  const [crew, setCrew] = useState<any | null>(null);

  // Track which psn this crew belongs to (so we don't spam fetches)
  const lastLoadedPsnRef = useRef<string>("");

  const isMember = auth?.mode === "member";

  const loadCrew = async (psnOverride?: string) => {
    // Idiot-guide:
    // psnOverride exists because during onboarding you may know the username
    // before auth.psn is derived (same as RN).
    const p = String(psnOverride || psn || "").trim().toUpperCase();
    if (!p) {
      console.error("[CrewStore] loadCrew called with no psn (empty).", { psnOverride, psn });
      setCrew(null);
      lastLoadedPsnRef.current = "";
      return null;
    }

    const data = await postJson<any>(CREW_GET_URL, { psn: p }, authHeader);
    const member = data?.member ?? null;

    lastLoadedPsnRef.current = p;
    setCrew(member);

    return member;
  };

  // Auto-load crew when we are a member and psn exists.
  useEffect(() => {
    // Guest: crew must be null (RN clears cache on guest)
    if (!isMember) {
      setCrew(null);
      lastLoadedPsnRef.current = "";
      return;
    }

    // Member with missing psn is a contract breach
    if (!psn) {
      console.error("[CrewStore] auth.mode=member but psn is missing. Contract breach.", { authUser: auth?.user });
      setCrew(null);
      lastLoadedPsnRef.current = "";
      return;
    }

    // Avoid refetching if we already loaded this psn
    const normalized = String(psn).trim().toUpperCase();
    if (normalized && lastLoadedPsnRef.current === normalized && crew) return;

    // Fire and forget (screens will render once crew arrives)
    loadCrew(normalized).catch((e) => {
      console.error("[CrewStore] loadCrew failed", e);
      // keep crew as-is; do not invent data
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMember, psn]);

  const value = useMemo(
    () => ({
      crew,
      setCrew,
      loadCrew,
    }),
    [crew]
  );

  return <CrewCtx.Provider value={value}>{children}</CrewCtx.Provider>;
}

export function useCrew() {
  const ctx = useContext(CrewCtx);
  if (!ctx) throw new Error("useCrew must be used within CrewProvider");
  return ctx;
}
