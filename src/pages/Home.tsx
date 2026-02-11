// src/pages/Home.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation  } from "react-router-dom";


import { STORAGE_PENDING_USERNAME } from "../app/storageKeys";
import { useAuth } from "../app/authStore";
import { useCrew } from "../app/crewStore";
import { loadFavourites, saveFavourites as saveFavouritesToStorage, getMaxFavs, getFavKey } from "../app/favourites";

import FlightCard3x3 from "../components/FlightCard3x3";

import { APP_IMAGES } from "../assets";
import { getMyFlights } from "../api/flightsApi";

/**
 * Idiot-guide (SOURCE OF TRUTH = RN HomeScreen.js):
 *
 * Layout order (RN):
 * 1) AppHeader (outside scroll / sticky)
 * 2) Hero image card
 *    - Member-only: My next flight block inside hero card
 * 3) Airports section (selected airports)
 *    - Member: 3 slots (carousel-ish)
 *    - Guest: 1 slot
 *    - Help modal exists
 *    - Remove confirm modal exists
 * 4) Quick actions (2-column grid) — EXACT CONTENTS differ for guest vs member
 *    - Guest: Sign up + Messages; then Information + Tools; then GuestPromoCard
 *    - Member: My Flights + Crew Lockers; then My Profile + Hotels; then Information + Tools
 * 5) Dev tools (bottom)
 *
 * Rules:
 * - No fake data objects.
 * - Guest never fetches “next flight”.
 * - Member next flight uses SAME backend source as RN via getMyFlights().
 * - Empty/Loading/Error states are explicit (no silent fallback flights).
 *
 * Favourites:
 * - Home owns favourites state (RN parity).
 * - Persisted locally (web = localStorage; RN = AsyncStorage).
 * - Guest max = 1, Member max = 3.
 */

type NextFlightState =
  | { status: "idle" | "loading"; flight: null }
  | { status: "ready"; flight: any }
  | { status: "empty"; flight: null }
  | { status: "error"; flight: null; error: Error };

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function normalizeCode(v: any) {
  return String(v || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);
}

export default function Home() {
  const nav = useNavigate();
  const { auth } = useAuth();
  const { crew } = useCrew();
  
  const location = useLocation();


  const isMember = auth.mode === "member";

  // ===== identity display only (no inference) =====
  // Idiot-guide:
  // - RN shows identity based on auth.username + crew fields (display only).
  // - We never invent identity.
  const staffNo = String(auth?.user?.username || "")
    .trim()
    .toUpperCase();

  const who = (crew?.psn || staffNo || "")
    .toString()
    .trim()
    .toUpperCase();

  const employer = (crew?.employer || "").toString().trim().toUpperCase();
  // =============================================================================
  // Airports favourites (RN parity: Home owns it)
  // =============================================================================
  // SOURCE OF TRUTH: ../app/favourites
  //
  // Idiot-guide:
  // - One storage key system ONLY (no Home-only localStorage keys).
  // - Member/known: max 3, Guest: max 1 (handled by getMaxFavs()).
  // - Reload when Home becomes active again (route changes / focus).
  // - Cross-tab sync via storage event on the active favourites key.

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
    // Idiot-guide:
    // - Always normalize + cap to maxFavs.
    // - Persist and update state in one place (via shared favourites module).
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
    // RN labels (explicit)
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

  const removeFavouriteAt = (idx: number) => {
    const next = favs.slice(0);
    if (idx < 0 || idx >= next.length) return;

    next.splice(idx, 1);

    saveFavouritesFromHome(next, "remove");
  };

  
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

      setNextFlightState({ status: "loading", flight: null });

      try {
        const rows = await getMyFlights({ staffNo });
        const first = rows?.[0] ?? null;

        if (ac.signal.aborted) return;

        if (!first) {
          setNextFlightState({ status: "empty", flight: null });
          return;
        }

        setNextFlightState({ status: "ready", flight: first });
      } catch (e: any) {
        if (ac.signal.aborted) return;
        const err = e instanceof Error ? e : new Error(String(e));
        console.error("[Home][NextFlight] getMyFlights failed", err);
        setNextFlightState({ status: "error", flight: null, error: err });
      }
    }

    load();
    return () => ac.abort();
  }, [isMember, staffNo]);

  // =============================================================================
  // Airports chip (RN language + web navigation)
  // =============================================================================
  function AirportChip({
    code,
    isAdd,
    label,
    showRemove,
    onRemove,
    onPress,
  }: {
    code?: string | null;
    isAdd?: boolean;
    label?: string;
    showRemove?: boolean;
    onRemove?: () => void;
    onPress?: () => void;
  }) {
    const resolvedCode = normalizeCode(code);
    const resolvedLabel = label ? String(label) : resolvedCode || "add airport";

    // Idiot-guide:
    // - RN uses AIRPORT_LOGOS mapping.
    // - Web uses public assets by convention: /assets/airports/<CODE>.webp
    const logoSrc = !isAdd && resolvedCode ? `/assets/airports/${resolvedCode}.webp` : null;

    return (
      <div className="airportChipWrap">
        {showRemove ? (
          <button
            type="button"
            className="airportChipRemove"
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.();
            }}
            aria-label="Remove airport"
            title="Remove"
          >
            ×
          </button>
        ) : null}

        <button
          type="button"
          className={cx("airportChipBtn", isAdd && "airportChipBtn--add")}
          onClick={() => onPress?.()}
        >
          <div className="airportChipTop">
            {isAdd ? (
              <div className="airportChipPlus">+</div>
            ) : logoSrc ? (
              <img className="airportChipLogo" src={logoSrc} alt={resolvedCode} />
            ) : (
              <div className="airportChipLogoFallback">{resolvedCode}</div>
            )}
          </div>

          <div className="airportChipBottom">
            <div className="airportChipLabel">{resolvedLabel}</div>
          </div>
        </button>
      </div>
    );
  }

  // ===== Sign-up modal (RN parity) =====
  const [signUpModalVisible, setSignUpModalVisible] = useState(false);

  return (
    <div className="homeScreen">
      {/* ===== AppHeader (sticky already in web) ===== */}


      <div className="homeInner">
        {/* ===== Hero + next flight (RN) ===== */}
        <section className="card card--flush">
          <div className="card-hero">
            <img src={APP_IMAGES.SCHIPHOL_IMG} alt="Schiphol Airport" />
          </div>

          {/* Member-only: My next flight */}
          {isMember ? (
            <div className="card-body">
              {nextFlightState.status === "loading" ? (
                <div className="mutedLine">Loading next flight…</div>
              ) : nextFlightState.status === "ready" ? (
                <FlightCard3x3
                  showHeader
                  headerLeftLabel="My next flight:"
                  headerDate={(nextFlightState.flight as any)?.headerDate || undefined}
                  flight={nextFlightState.flight}
                />
              ) : nextFlightState.status === "error" ? (
                <div className="errorLine">
                  My next flight unavailable: {nextFlightState.error.message}
                </div>
              ) : (
                <div className="mutedLine">No upcoming flights.</div>
              )}
            </div>
          ) : null}
        </section>

        {/* ===== Airports (RN) ===== */}
        <section className="card">
          <div className="sectionTitleRow">
            <div className="sectionTitle">{airportsTitle}</div>

            <button
              type="button"
              className="infoDot"
              onClick={() => setShowAirportsHelp(true)}
              aria-label="Airports help"
              title="Airports help"
            >
              i
            </button>
          </div>

          <div className={cx("airportsBlock", maxFavs > 1 && "airportsBlock--scroll")}>
            {maxFavs > 1 ? (
              <div className="airportsScroll">
                {memberSlots.map((code, idx) => {
                  const isAdd = !code;

                  return (
                    <div className="airportsScrollItem" key={`${code || "add"}-${idx}`}>
                      <AirportChip
                        code={code || null}
                        isAdd={isAdd}
                        label={isAdd ? ADD_SLOT_LABELS[idx] : String(code)}
                        showRemove={!isAdd}
                        onRemove={() => {
                          if (favs.length <= 1) {
                            removeFavouriteAt(idx);
                            return;
                          }
                          setPendingRemoveIndex(idx);
                          setRemoveConfirmVisible(true);
                        }}
                        onPress={() => {
                          if (!isAdd && code) {
                            nav("/week", { state: { airport: normalizeCode(code) } });
                            return;
                          }

                          nav("/selectairports", {
                            state: {
                              mode: isAdd ? "add" : "replace",
                              targetSlotIndex: idx,
                              openPicker: true,
                              focusSearch: true,
                              highlightSlot: true,
                            },
                          });
                        }}
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
                    onRemove={() => {
                      setPendingRemoveIndex(0);
                      setRemoveConfirmVisible(true);
                    }}
                    onPress={() => nav("/week", { state: { airport: favs[0] } })}
                  />
                ) : (
                  <AirportChip
                    isAdd
                    label="Add airport"
                    onPress={() =>
                      nav("/selectairports", {
                        state: {
                          mode: "add",
                          targetSlotIndex: 0,
                          openPicker: true,
                          focusSearch: true,
                          highlightSlot: true,
                        },
                      })
                    }
                  />
                )}
              </div>
            )}
          </div>

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
        </section>

        {/* ===== Quick actions (RN) ===== */}
        <section className="quickWrap">
          <div className="quickTitle">Quick actions</div>

          {!isMember ? (
            <>
              <div className="quickGridRow">
                <button
                  type="button"
                  className="quickTile"
                  onClick={() => setSignUpModalVisible(true)}
                >
                  <div className="quickTileTitle">Sign up</div>
                  <div className="quickTileSub">Unlock crew features</div>
                </button>

                <div className="quickTile quickTile--disabled" aria-disabled="true">
                  <div className="quickTileTitle">Messages</div>
                  <div className="quickTileSub">Coming soon</div>
                </div>
              </div>

              <div className="quickGridRow">
                <div className="quickTile quickTile--disabled" aria-disabled="true">
                  <div className="quickTileTitle">Information</div>
                  <div className="quickTileSub">Coming soon</div>
                </div>

                <div className="quickTile quickTile--disabled" aria-disabled="true">
                  <div className="quickTileTitle">Tools</div>
                  <div className="quickTileSub">Coming soon</div>
                </div>
              </div>

              <div className="promoSpacer">
                <div className="promoPlaceholder">GuestPromoCard</div>
              </div>
            </>
          ) : (
            <>
              <div className="quickGridRow">
                <button type="button" className="quickTile" onClick={() => nav("/myflights")}>
                  <div className="quickTileTitle">My Flights</div>
                  <div className="quickTileSub">View your flights</div>
                </button>

                <div className="quickTile quickTile--disabled" aria-disabled="true">
                  <div className="quickTileTitle">Crew Lockers</div>
                  <div className="quickTileSub">Coming soon</div>
                </div>
              </div>

              <div className="quickGridRow">
                <button type="button" className="quickTile" onClick={() => nav("/profile")}>
                  <div className="quickTileTitle">My Profile</div>
                  <div className="quickTileSub">Personal details</div>
                </button>

                <div className="quickTile quickTile--disabled" aria-disabled="true">
                  <div className="quickTileTitle">Hotels</div>
                  <div className="quickTileSub">Coming soon</div>
                </div>
              </div>

              <div className="quickGridRow">
                <div className="quickTile quickTile--disabled" aria-disabled="true">
                  <div className="quickTileTitle">Information</div>
                  <div className="quickTileSub">Coming soon</div>
                </div>

                <div className="quickTile quickTile--disabled" aria-disabled="true">
                  <div className="quickTileTitle">Tools</div>
                  <div className="quickTileSub">Coming soon</div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* ===== Dev tools (keep) ===== */}
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
      </div>

      {/* ===== Airports help modal (RN) ===== */}
      {showAirportsHelp ? (
        <div className="modalOverlay" onClick={() => setShowAirportsHelp(false)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalTitle">My airports</div>
            <div className="modalBody">• Tap an airport to open its weekly schedule.</div>
            <div className="modalBody">• Long-press an airport to replace it.</div>
            <div className="modalBody">• Tap × to remove an airport.</div>

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
            <div className="modalBody">Members can:</div>
            <div className="modalBody">• Save up to 3 airports</div>
            <div className="modalBody">• List/unlist on eligible flights</div>
            <div className="modalBody">• View crew lists and booking status</div>

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
