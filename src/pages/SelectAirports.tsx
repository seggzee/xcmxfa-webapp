// src/pages/SelectAirports.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { EUROPE_COUNTRIES, REST_COUNTRIES, COUNTRY_AIRPORTS } from "../data/airports";

import { AIRPORT_LOGOS } from "../assets/airportLogos";
import { COUNTRY_FLAGS } from "../assets/countryFlags";
import { UI_ICONS } from "../assets";

import { ensureScheduleFresh } from "../api/flightsApi";

import { loadFavourites, saveFavourites, getMaxFavs } from "../app/favourites";
import { useAuth } from "../app/authStore";

import StickyPageHeaderCard from "../components/StickyPageHeaderCard";

import "../styles/selectAirports.css";

const normalizeCode = (v: any) =>
  String(v || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);

type IntentState = {
  mode?: "add" | "replace" | null;
  targetSlotIndex?: number | null;
  openPicker?: boolean;
  focusSearch?: boolean;
  highlightSlot?: boolean;

  // Legacy compatibility (kept like RN)
  replaceIndex?: number | null;
};

export default function SelectAirports() {
  const nav = useNavigate();
  const loc = useLocation();
  const { auth } = useAuth();

  const intent: IntentState = (loc.state || {}) as any;

  const isMember = auth?.mode === "member";
  const isKnown = !isMember && Boolean((auth as any)?.user);
  const isMemberOrKnown = isMember || isKnown;

  void isMemberOrKnown; // (kept for parity / future rules)

  const maxFavs = getMaxFavs(auth);

  const [favourites, setFavourites] = useState<string[]>(() => loadFavourites(auth));

  // hydrate when auth changes mode
  useEffect(() => {
    setFavourites(loadFavourites(auth));
  }, [auth?.mode]);

  const favs = Array.isArray(favourites) ? favourites : [];
  const selectedCount = favs.filter(Boolean).length;
  const limitReached = selectedCount >= maxFavs;

  const [region, setRegion] = useState<"Europe" | "Rest">("Europe");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);

  const initialSlot =
    typeof intent.targetSlotIndex === "number"
      ? intent.targetSlotIndex
      : typeof intent.replaceIndex === "number"
      ? intent.replaceIndex
      : null;

  const initialMode = intent.mode || (typeof intent.replaceIndex === "number" ? "replace" : "add");
  const isReplaceMode = initialMode === "replace";

  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(initialSlot);
  const [isPickerOpen, setIsPickerOpen] = useState<boolean>(
    Boolean(intent.openPicker) || typeof intent.replaceIndex === "number"
  );

  // Focus search when picker opens and focusSearch is requested
  useEffect(() => {
    if (!isPickerOpen) return;
    if (!intent.focusSearch && !isReplaceMode) return;

    const t = window.setTimeout(() => searchRef.current?.focus?.(), 50);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPickerOpen, intent.focusSearch, isReplaceMode]);

  const [removeConfirmVisible, setRemoveConfirmVisible] = useState(false);
  const [pendingRemoveIndex, setPendingRemoveIndex] = useState<number | null>(null);

  const countriesBase = region === "Europe" ? EUROPE_COUNTRIES : REST_COUNTRIES;

  // Build a lookup so code search can auto-jump to the right place.
  const codeLookup = useMemo(() => {
    const europeSet = new Set(EUROPE_COUNTRIES);
    const restSet = new Set(REST_COUNTRIES);

    const map = new Map<string, { country: string; region: "Europe" | "Rest" | null }>();
    for (const [country, airports] of Object.entries(COUNTRY_AIRPORTS || {})) {
      const isEurope2 = europeSet.has(country);
      const isRest2 = restSet.has(country);
      const resolvedRegion = (isEurope2 ? "Europe" : isRest2 ? "Rest" : null) as any;

      for (const a of (airports as any[]) || []) {
        if (!a?.code) continue;
        const code = String(a.code).toUpperCase();
        if (!map.has(code)) map.set(code, { country, region: resolvedRegion || "Rest" });
      }
    }
    return map;
  }, []);

  const searchCode = normalizeCode(search);
  const isSearchActive = searchCode.length > 0;

  // When searching, auto-jump to the matching country + region.
  useEffect(() => {
    if (!isSearchActive) return;

    let matched: any = null;
    if (searchCode.length === 3 && codeLookup.has(searchCode)) {
      matched = { code: searchCode, ...codeLookup.get(searchCode) };
    } else {
      for (const [code, meta] of codeLookup.entries()) {
        if (code.startsWith(searchCode)) {
          matched = { code, ...meta };
          break;
        }
      }
    }

    if (!matched) return;

    if (matched.region && matched.region !== region) setRegion(matched.region);
    if (matched.country && matched.country !== selectedCountry) setSelectedCountry(matched.country);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchCode, isSearchActive, codeLookup]);

  const airportsForCountry = selectedCountry ? (COUNTRY_AIRPORTS as any)[selectedCountry] || [] : [];

  const selectable = useMemo(() => {
    // Keep AMS logic as data rule, even though we removed it from the UI copy.
    const base = (airportsForCountry || []).filter((a: any) => a?.code && a.code !== "AMS");
    const sorted = base.slice(0).sort((a: any, b: any) => String(a.code).localeCompare(String(b.code)));

    if (!isSearchActive) return sorted;
    return sorted.filter((a: any) => String(a.code).toUpperCase().startsWith(searchCode));
  }, [airportsForCountry, isSearchActive, searchCode]);

  const selectedFlagSrc = selectedCountry ? (COUNTRY_FLAGS as any)?.[selectedCountry] : null;

  // Grid logic preserved
  const AIRPORT_COLS = 3;
  const airportRows: any[] = [];
  for (let i = 0; i < selectable.length; i += AIRPORT_COLS) {
    airportRows.push(selectable.slice(i, i + AIRPORT_COLS));
  }

  const setFavsSafe = (updater: any, trigger?: string) => {
    setFavourites((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const nextArr = Array.isArray(next) ? next : [];
      const clean = nextArr.filter(Boolean);
      saveFavourites(auth, clean, { trigger: trigger || "update" });
      return clean;
    });
  };

  const prefetchScheduleFor = (airportCode: string, trigger = "airport_select") => {
    if (!airportCode) return;
    Promise.resolve(
      ensureScheduleFresh({
        airportCode: String(airportCode).toUpperCase(),
        days: 9,
        trigger,
      } as any)
    ).catch(() => {
      // Intentionally silent: selection UX must not block on refresh.
    });
  };

  const removeAt = (idx: number) => {
    setFavsSafe(
      (prev: any) => {
        const current = Array.isArray(prev) ? [...prev] : [];
        if (idx < 0 || idx >= current.length) return current;
        current.splice(idx, 1);
        return current.slice(0, maxFavs);
      },
      "remove"
    );
  };

  const onPressRemoveChip = (idx: number) => {
    if (selectedCount <= 1) {
      removeAt(idx);
      return;
    }
    setPendingRemoveIndex(idx);
    setRemoveConfirmVisible(true);
  };

  const slots = useMemo(() => {
    const out: (string | null)[] = [...favs];
    while (out.length < maxFavs) out.push(null);
    return out;
  }, [favs, maxFavs]);

  const disableAvailableChoices = !isReplaceMode && limitReached;

  const SelectedChip = ({ code, slotIndex }: { code: string | null; slotIndex: number }) => {
    const logoSrc = code ? (AIRPORT_LOGOS as any)?.[code] : null;
    const isEmpty = !code;

    const isActive =
      typeof activeSlotIndex === "number" &&
      activeSlotIndex === slotIndex &&
      (isPickerOpen || intent.highlightSlot || initialMode === "replace");

    const onPressSlot = () => {
      setActiveSlotIndex(slotIndex);
      setIsPickerOpen(true);
    };

    return (
      <div className="selectAirports-chipWrap">
        {!isEmpty ? (
          <div role="button" aria-label="Remove" className="selectAirports-chipRemoveBtn" onClick={() => onPressRemoveChip(slotIndex)}>
            <span className="selectAirports-chipRemoveText">×</span>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onPressSlot}
          className={`selectAirports-chipBtn ${isActive ? "is-active" : ""}`}
        >
          <div className="selectAirports-chipTop">
            {isEmpty ? (
              <span className="selectAirports-chipAddPlus">+</span>
            ) : logoSrc ? (
              <img src={logoSrc} className="selectAirports-chipLogo" alt={code || ""} />
            ) : null}
          </div>

          <div className="selectAirports-chipBottom">
            <span className={isEmpty ? "selectAirports-chipAddLabel" : "selectAirports-chipCode"}>
              {isEmpty ? "add airport" : String(code)}
            </span>
          </div>
        </button>
      </div>
    );
  };

  return (
    <div className="selectAirports-page">
      <StickyPageHeaderCard
	   leftContent={
            <img
              src={UI_ICONS.flight_blue}
              alt="My profile"
              style={{
                width: 52,
                height: 52,
                objectFit: "contain",
                borderRadius: 14,
              }}
            />
          }
        title="Select airport(s)"
        subtitle="Members may select up to 3 airports. Guests may only select 1."
        onBack={() => nav(-1)}
        backAriaLabel="Back"
      />

      <div className="selectAirports-scroll">
        <div className="selectAirports-card">
          {/* Selected section (always visible) */}
          <div className="selectAirports-selectedWrap">
            <div className="selectAirports-selectedTitleRow">
              <div className="selectAirports-selectedTitle">
                Selected: {selectedCount}/{maxFavs}
              </div>
              <div className="selectAirports-selectedHint">Tap × to remove</div>
            </div>

            <div className="selectAirports-selectedChipsRow">
              {slots.map((code, idx) => (
                <SelectedChip key={`${code || "empty"}-${idx}`} code={code} slotIndex={idx} />
              ))}
            </div>

            {disableAvailableChoices ? (
              <div className="selectAirports-limitHint">
                You’ve reached your limit. Remove a selected airport to choose another.
              </div>
            ) : null}
          </div>

          {/* Picker (collapsed by default) */}
          {isPickerOpen ? (
            <>
              <div className="selectAirports-sectionTitle">
                {isReplaceMode
                  ? `Replacing airport in slot ${Number(activeSlotIndex ?? 0) + 1}`
                  : `Selecting airport for slot ${Number(activeSlotIndex ?? 0) + 1}`}
              </div>

              <input
                ref={(el) => {
                  searchRef.current = el;
                }}
                value={search}
                onChange={(e) => setSearch(normalizeCode(e.target.value))}
                placeholder="Search by airport code (e.g. JFK)"
                className="selectAirports-searchInput"
                autoCapitalize="characters"
                autoCorrect="off"
              />

              {/* Region segmented control */}
              <div className={`selectAirports-segmentRow ${disableAvailableChoices ? "is-disabled" : ""}`}>
                <button
                  type="button"
                  className={`selectAirports-segmentBtn ${region === "Europe" ? "is-active" : ""}`}
                  onClick={() => {
                    if (disableAvailableChoices) return;
                    setRegion("Europe");
                    setSelectedCountry(null);
                  }}
                  disabled={disableAvailableChoices}
                >
                  Europe
                </button>

                <button
                  type="button"
                  className={`selectAirports-segmentBtn ${region === "Rest" ? "is-active" : ""}`}
                  onClick={() => {
                    if (disableAvailableChoices) return;
                    setRegion("Rest");
                    setSelectedCountry(null);
                  }}
                  disabled={disableAvailableChoices}
                >
                  Rest of the world
                </button>
              </div>

              {/* COUNTRY STEP */}
              {!selectedCountry ? (
                <>
                  {isSearchActive ? (
                    <div className="selectAirports-sectionTitle">Type a code to jump to its country</div>
                  ) : (
                    <>
                      <div className="selectAirports-sectionTitle">Available countries</div>

                      <div className={`selectAirports-flagGridWrap ${disableAvailableChoices ? "is-disabled" : ""}`}>
                        <div className="selectAirports-flagGridContent">
                          {countriesBase.map((c: string) => {
                            const flagSrc = (COUNTRY_FLAGS as any)?.[c];

                            return (
                              <button
                                key={c}
                                type="button"
                                className="selectAirports-flagTile"
                                onClick={() => {
                                  if (disableAvailableChoices) return;
                                  setSelectedCountry(c);
                                }}
                                disabled={disableAvailableChoices}
                              >
                                <div className="selectAirports-flagCard">
                                  <div className="selectAirports-flagSquare">
                                    <div className="selectAirports-flagInner">
                                      {flagSrc ? (
                                        <img src={flagSrc} className="selectAirports-flagImg" alt={c} />
                                      ) : (
                                        <div className="selectAirports-flagMissing">No flag</div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="selectAirports-flagLabel">{c}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  {/* AIRPORT STEP HEADER */}
                  <div className="selectAirports-countryHeaderRow">
                    <div className="selectAirports-countryLeft">
                      <div className="selectAirports-countryFlagBox">
                        {selectedFlagSrc ? <img src={selectedFlagSrc} className="selectAirports-countryFlagImg" alt={selectedCountry} /> : null}
                      </div>

                      <div className="selectAirports-countryName" title={selectedCountry || ""}>
                        {selectedCountry}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="selectAirports-countryBackBtn"
                      onClick={() => {
                        if (disableAvailableChoices) return;
                        setSelectedCountry(null);
                        setSearch("");
                      }}
                      disabled={disableAvailableChoices}
                    >
                      Back / Other countries
                    </button>
                  </div>

                  {/* AIRPORT STEP GRID */}
                  <div className="selectAirports-airportGrid">
                    {airportRows.map((row, rowIdx) => (
                      <div key={`row-${rowIdx}`} className="selectAirports-airportRow">
                        {Array.from({ length: AIRPORT_COLS }).map((_, colIdx) => {
                          const a = row[colIdx];

                          if (!a) {
                            return <div key={`empty-${rowIdx}-${colIdx}`} className="selectAirports-airportCell is-empty" />;
                          }

                          const isSel = favs.includes(a.code);
                          const disabled = isReplaceMode ? false : disableAvailableChoices && !isSel;
                          const logoSrc = (AIRPORT_LOGOS as any)?.[a.code];

                          return (
                            <div key={`${a.code}-${rowIdx}-${colIdx}`} className="selectAirports-airportCell">
                              <button
                                type="button"
                                disabled={disabled}
                                className={`selectAirports-airportBtn ${disabled ? "is-disabled" : ""}`}
                                onClick={() => {
                                  if (disabled) return;

                                  const slot = typeof activeSlotIndex === "number" ? activeSlotIndex : 0;
                                  const desired = String(a.code || "").toUpperCase();

                                  if (!favs.includes(desired) && !limitReached) {
                                    prefetchScheduleFor(desired, "airport_select_assign");
                                  }

                                  setFavsSafe(
                                    (prev: any) => {
                                      const current = (Array.isArray(prev) ? [...prev] : []).filter(Boolean);

                                      const temp = current.slice(0);
                                      while (temp.length < maxFavs) temp.push(undefined);

                                      for (let i = 0; i < temp.length; i++) {
                                        if (i !== slot && String(temp[i] || "").toUpperCase() === desired) {
                                          temp[i] = undefined;
                                        }
                                      }

                                      temp[slot] = desired;

                                      return temp.filter(Boolean).slice(0, maxFavs);
                                    },
                                    "assign"
                                  );

                                  setIsPickerOpen(false);
                                  setSearch("");
                                }}
                              >
                                <div className="selectAirports-airportTop">
                                  {logoSrc ? <img src={logoSrc} className="selectAirports-chipLogo" alt={String(a.code)} /> : null}
                                </div>

                                <div className="selectAirports-airportBottom">
                                  <span className="selectAirports-chipCode">{String(a.code)}</span>
                                </div>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Completion bar */}
      <div className="selectAirports-bottomBar">
        <div className="selectAirports-bottomInner">
          <button
            type="button"
            className="selectAirports-bottomBtn"
            onClick={() => {
              const primary = (Array.isArray(favs) ? favs : []).filter(Boolean)[0];
              if (primary) prefetchScheduleFor(primary, "airport_select_done");
              saveFavourites(auth, (Array.isArray(favs) ? favs : []).filter(Boolean), { trigger: "done" });
              nav(-1); // go back to Home
            }}
          >
            Airport selection completed
          </button>
        </div>
      </div>

      {/* Remove confirm modal */}
      {removeConfirmVisible ? (
        <div
          className="selectAirports-modalOverlay"
          onClick={() => {
            setRemoveConfirmVisible(false);
          }}
        >
          <div className="selectAirports-modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="selectAirports-modalTitle">Remove airport?</div>
            <div className="selectAirports-modalBody">This will remove the airport from your selection.</div>

            <div className="selectAirports-modalBtnRow">
              <button
                type="button"
                className="selectAirports-modalBtn ghost"
                onClick={() => {
                  setRemoveConfirmVisible(false);
                  setPendingRemoveIndex(null);
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="selectAirports-modalBtn primary"
                onClick={() => {
                  if (typeof pendingRemoveIndex === "number") removeAt(pendingRemoveIndex);
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
    </div>
  );
}