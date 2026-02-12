// src/pages/Home.tsx

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import { STORAGE_PENDING_USERNAME } from "../app/storageKeys";
import { useAuth } from "../app/authStore";
import { useCrew } from "../app/crewStore";
import {
  loadFavourites,
  saveFavourites as saveFavouritesToStorage,
  getMaxFavs,
  getFavKey,
} from "../app/favourites";

import FlightCard3x3 from "../components/FlightCard3x3";
import GuestPromoCard from "../components/GuestPromoCard";

import { API_BASE_URL } from "../config/api";
import { APP_IMAGES } from "../assets";
import { getMyFlights } from "../api/flightsApi";

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
  
//////////////////////////////////////////////////////////////////////////////////////////////////  

  // =============================================================================
  // Airports carousel sizing — callback-ref so we measure as soon as it mounts
  // (prevents "wide chips until refresh" after login) + observe width changes
  // =============================================================================
  const carouselElRef = useRef<HTMLDivElement | null>(null);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  const [carouselOuterW, setCarouselOuterW] = useState<number | null>(null);

  // Single source of truth for measurement
  const measureCarousel = useCallback(() => {
    const el = carouselElRef.current;
    if (!el) return;

    // getBoundingClientRect is more reliable during layout changes than offsetWidth
    const w = Math.round(el.getBoundingClientRect().width || 0);
    if (!w) return;

    setCarouselOuterW((prev) => (prev === w ? prev : w));
  }, []);

  // Callback ref: runs immediately when element mounts/unmounts
  const carouselRef = useCallback(
    (node: HTMLDivElement | null) => {
      // Cleanup any previous observer
      if (resizeObsRef.current) {
        resizeObsRef.current.disconnect();
        resizeObsRef.current = null;
      }

      carouselElRef.current = node;

      if (!node) return;

      // Measure immediately, then again next frame (covers "first paint" + post-layout)
      measureCarousel();
      requestAnimationFrame(measureCarousel);

      // Observe width changes (login/layout/viewport changes)
      const ro = new ResizeObserver(() => measureCarousel());
      ro.observe(node);
      resizeObsRef.current = ro;
    },
    [measureCarousel]
  );

  useEffect(() => {
    // Also listen to viewport events (belt + braces)
    window.addEventListener("resize", measureCarousel);
    window.addEventListener("orientationchange", measureCarousel);

    return () => {
      window.removeEventListener("resize", measureCarousel);
      window.removeEventListener("orientationchange", measureCarousel);

      if (resizeObsRef.current) {
        resizeObsRef.current.disconnect();
        resizeObsRef.current = null;
      }
    };
  }, [measureCarousel]);

  const carouselGap = 10;
  const carouselItemW =
    typeof carouselOuterW === "number" ? Math.round(carouselOuterW * 0.48) : null;

  const twoUpBlockW =
    typeof carouselItemW === "number" ? carouselItemW * 2 + carouselGap : null;

  const carouselSidePad =
    typeof carouselOuterW === "number" && typeof twoUpBlockW === "number"
      ? Math.max(0, Math.round((carouselOuterW - twoUpBlockW) / 2))
      : 0;

  // =============================================================================
  // AirportChip — RN Home design + behaviour
  // =============================================================================
  function AirportChip({
    code,
    isAdd = false,
    label,
    showPlus,
    onPress,
    onLongPress,
    showRemove = false,
    onRemove,
  }: {
    code?: string | null;
    isAdd?: boolean;
    label?: string;
    showPlus?: boolean;
    onPress?: () => void;
    onLongPress?: () => void;
    showRemove?: boolean;
    onRemove?: () => void;
  }) {
    const resolvedCode = normalizeCode(code);

    const resolvedLabel =
      typeof label === "string" ? label : isAdd ? "add airport" : String(resolvedCode);

    const shouldShowPlus = typeof showPlus === "boolean" ? showPlus : Boolean(isAdd);

    const logoSrc = !isAdd && resolvedCode ? `/assets/airports/${resolvedCode}.webp` : null;

    const [pressed, setPressed] = useState(false);
    const [removePressed, setRemovePressed] = useState(false);

    const lpTimerRef = useRef<number | null>(null);
    const longPressedRef = useRef(false);

    const clearLongPress = () => {
      if (lpTimerRef.current) {
        window.clearTimeout(lpTimerRef.current);
        lpTimerRef.current = null;
      }
    };

    const startLongPress = () => {
      longPressedRef.current = false;
      if (!onLongPress) return;

      clearLongPress();
      lpTimerRef.current = window.setTimeout(() => {
        longPressedRef.current = true;
        onLongPress();
      }, 320);
    };

    const endPress = () => {
      clearLongPress();
      setPressed(false);
    };

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
            onMouseDown={() => setRemovePressed(true)}
            onMouseUp={() => setRemovePressed(false)}
            onMouseLeave={() => setRemovePressed(false)}
            onTouchStart={() => setRemovePressed(true)}
            onTouchEnd={() => setRemovePressed(false)}
            aria-label="Remove airport"
            title="Remove"
            style={removePressed ? { opacity: 0.85 } : undefined}
          >
            ×
          </button>
        ) : null}

        <button
          type="button"
          className="airportChipBtn"
          onClick={() => {
            if (longPressedRef.current) return;
            onPress?.();
          }}
          onMouseDown={() => {
            setPressed(true);
            startLongPress();
          }}
          onMouseUp={endPress}
          onMouseLeave={endPress}
          onTouchStart={() => {
            setPressed(true);
            startLongPress();
          }}
          onTouchEnd={endPress}
          onTouchCancel={endPress}
          style={pressed ? { opacity: 0.92 } : undefined}
        >
          <div className="airportChipTopRN">
            {isAdd && shouldShowPlus ? (
              <div className="airportChipPlus">+</div>
            ) : !isAdd && logoSrc ? (
              <img src={logoSrc} className="airportChipLogo" alt="" />
            ) : null}
          </div>

          <div className="airportChipBottomRN">
            <div className={isAdd ? "airportChipLabelAddRN" : "airportChipLabelRN"}>
              {resolvedLabel}
            </div>
          </div>
        </button>
      </div>
    );
  }

//////////////////////////////////////////////////////////////
  // ===== Sign-up modal (RN parity) =====
  const [signUpModalVisible, setSignUpModalVisible] = useState(false);

  return (
    <div className="homeScreen">
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
              <div
                ref={carouselRef}
                className="airportsScroll"
                style={{
                  paddingLeft: carouselSidePad,
                  paddingRight: carouselSidePad,
                  scrollPaddingLeft: carouselSidePad,
                  scrollPaddingRight: carouselSidePad,
                }}
              >
                {memberSlots.map((code, idx) => {
                  const isLast = idx === memberSlots.length - 1;
                  const isAdd = !code;

                  return (
                    <div
                      className="airportsScrollItem"
                      key={`${code || "add"}-${idx}`}
                      style={{
                        width: typeof carouselItemW === "number" ? carouselItemW : undefined,
                        marginRight: isLast ? 0 : carouselGap,
                        scrollSnapAlign: "start",
                      }}
                    >
                      <AirportChip
                        code={code || null}
                        isAdd={isAdd}
                        showPlus={false}
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
                              mode: "add",
                              targetSlotIndex: idx,
                              openPicker: true,
                              focusSearch: true,
                              highlightSlot: true,
                            },
                          });
                        }}
                        onLongPress={() => {
                          nav("/selectairports", {
                            state: {
                              mode: "replace",
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
                    showPlus={true}
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

		  
        {/* ===== Debug ===== ======================		  
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
        ===== =============================== ===== */}		  
		  
        </section>

        {/* ===== Quick actions (RN) ===== */}
        <section className="quickWrap">
          <div className="quickTitle">Quick actions</div>

          {!isMember ? (
            <>
              <div className="quickGridRow">
                <button type="button" className="quickTile" onClick={() => setSignUpModalVisible(true)}>
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
                <GuestPromoCard apiBaseUrl={API_BASE_URL} />
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

        {/* ===== Dev tools (keep) =====
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
        ==================================*/}
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
