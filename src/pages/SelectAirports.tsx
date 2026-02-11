import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  EUROPE_COUNTRIES,
  REST_COUNTRIES,
  COUNTRY_AIRPORTS,
} from "../data/airports";

import { AIRPORT_LOGOS } from "../assets/airportLogos";
import { COUNTRY_FLAGS } from "../assets/countryFlags";

import { ensureScheduleFresh } from "../api/flightsApi";

import { loadFavourites, saveFavourites, getMaxFavs } from "../app/favourites";
import { useAuth } from "../app/authStore";

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
  const isKnown = !isMember && Boolean(auth?.user);
  const isMemberOrKnown = isMember || isKnown;

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

  const initialMode =
    intent.mode || (typeof intent.replaceIndex === "number" ? "replace" : "add");

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
      const isEurope = europeSet.has(country);
      const isRest = restSet.has(country);
      const resolvedRegion = (isEurope ? "Europe" : isRest ? "Rest" : null) as any;

      for (const a of (airports as any[]) || []) {
        if (!a?.code) continue;
        const code = String(a.code).toUpperCase();
        if (!map.has(code)) {
          map.set(code, { country, region: resolvedRegion || "Rest" });
        }
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
    setFavsSafe((prev: any) => {
      const current = Array.isArray(prev) ? [...prev] : [];
      if (idx < 0 || idx >= current.length) return current;
      current.splice(idx, 1);
      return current.slice(0, maxFavs);
    }, "remove");
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
const out: (string | null)[] = [...favourites];
while (out.length < maxFavs) out.push(null);
    return out;
  }, [favs, maxFavs]);

  const disableAvailableChoices = !isReplaceMode && limitReached;

  const styles: Record<string, React.CSSProperties> = {
    root: { minHeight: "100vh", background: "#f6f7f9" },
    scrollPad: { maxWidth: 520, margin: "0 auto", padding: 16, paddingBottom: 120 },
    card: { background: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, border: "1px solid #d9e2ee" },
    h1: { fontSize: 20, fontWeight: 900, marginBottom: 8, color: "#132333" },
    pMuted: { marginTop: 6, color: "rgba(19,35,51,0.55)", fontWeight: 700, whiteSpace: "pre-line" },
    searchInput: {
      marginTop: 10,
      border: "1px solid #d9e2ee",
      borderRadius: 14,
      padding: "10px 12px",
      fontWeight: 800,
      color: "#132333",
      background: "#fff",
      width: "100%",
      outline: "none",
      textTransform: "uppercase",
    },
    selectedWrap: {
      marginTop: 12,
      marginBottom: 12,
      border: "1px solid #d9e2ee",
      borderRadius: 14,
      padding: 12,
      background: "#f8fbff",
    },
    selectedTitleRow: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
    selectedTitle: { fontWeight: 900, color: "#132333" },
    selectedHint: { fontWeight: 800, color: "rgba(19,35,51,0.55)", fontSize: 12 },
    selectedChipsRow: { marginTop: 10, display: "flex", gap: 10 },
    chipWrap: { flex: 1, position: "relative" },
    chipBtn: {
      width: "100%",
      borderRadius: 18,
      border: "1px solid #d9e2ee",
      background: "#fff",
      overflow: "hidden",
      cursor: "pointer",
      padding: 0,
      textAlign: "left",
    },
    chipBtnActive: { border: "2px solid #16a34a" },
    chipTop: { height: 62, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 6, paddingLeft: 6, paddingRight: 6 },
    chipBottom: { padding: "10px 0", display: "flex", alignItems: "center", justifyContent: "center" },
    chipCode: { fontWeight: 900, fontSize: 18, color: "#132333" },
    chipAddPlus: { fontSize: 26, fontWeight: 900, color: "rgba(19,35,51,0.55)" },
    chipAddLabel: { fontWeight: 900, fontSize: 18, color: "#132333" },
    chipRemoveBtn: {
      position: "absolute",
      top: 6,
      right: 6,
      width: 22,
      height: 22,
      borderRadius: 11,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(255,255,255,0.95)",
      border: "1px solid #d9e2ee",
      zIndex: 5,
      cursor: "pointer",
    },
    chipRemoveText: { fontWeight: 900, color: "rgba(19,35,51,0.75)", fontSize: 14, lineHeight: "14px" },

    segmentRow: { display: "flex", marginTop: 10, marginBottom: 12, border: "1px solid #d9e2ee", borderRadius: 14, overflow: "hidden" },
    segmentBtn: { flex: 1, padding: "10px 0", textAlign: "center", background: "#f3f6fb", cursor: "pointer", fontWeight: 900, color: "rgba(19,35,51,0.55)" },
    segmentBtnActive: { background: "#fff", color: "#132333" },

    sectionTitle: { marginTop: 6, marginBottom: 10, fontWeight: 900, color: "#132333", fontSize: 16, lineHeight: "18px" },

    flagGridWrap: { border: "1px solid #d9e2ee", borderRadius: 16, background: "#fff", padding: 12, marginBottom: 10 },
    flagGridContent: { paddingBottom: 6, display: "flex", flexWrap: "wrap", justifyContent: "space-between" },
    flagTile: { marginBottom: 12, width: "30%" as any },
    flagCard: { borderRadius: 14, overflow: "hidden", border: "1px solid #d9e2ee", background: "#f3f6fb" },
    flagLabel: { marginTop: 6, fontWeight: 800, color: "rgba(19,35,51,0.70)", textAlign: "center", fontSize: 12.5 },

    countryHeaderRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 10 },
    countryBackBtn: { padding: "8px 12px", borderRadius: 12, border: "1px solid #d9e2ee", background: "#f3f6fb", cursor: "pointer", fontWeight: 900, color: "#132333" },

    limitHint: { marginTop: 8, fontWeight: 800, color: "rgba(19,35,51,0.55)" },

    bottomBar: {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      padding: "10px 16px 16px 16px",
      background: "rgba(246,247,249,0.96)",
      borderTop: "1px solid #d9e2ee",
    },
    bottomInner: { maxWidth: 520, margin: "0 auto" },
    bottomBtn: { background: "#16a34a", padding: 14, borderRadius: 14, textAlign: "center" as any, cursor: "pointer" },
    bottomBtnText: { color: "#fff", fontWeight: 900 },

    modalOverlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.35)",
      padding: 18,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 999,
    },
    modalCard: { background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #d9e2ee", width: "100%", maxWidth: 520 },
    modalTitle: { fontWeight: 900, fontSize: 16, color: "#132333" },
    modalBody: { marginTop: 10, color: "rgba(19,35,51,0.75)", fontWeight: 700, lineHeight: "18px" },
    modalBtnRow: { display: "flex", gap: 10, marginTop: 14 },
    modalBtn: { flex: 1, borderRadius: 14, padding: "12px 0", textAlign: "center" as any, cursor: "pointer", fontWeight: 900, color: "#132333" },
    modalBtnGhost: { background: "#fff", border: "1px solid #d9e2ee" },
    modalBtnPrimary: { background: "#e8f0ff" },
  };

  const FlagTileWidth = (() => {
    // match RN-ish layout responsiveness
    const w = window.innerWidth;
    const cols = w < 340 ? 2 : 3;
    return cols === 3 ? "30%" : "47%";
  })();

  const SelectedChip = ({ code, slotIndex }: { code: string | null; slotIndex: number }) => {
    const logoSrc = code ? AIRPORT_LOGOS?.[code] : null;
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
      <div style={styles.chipWrap}>
        {!isEmpty ? (
          <div
            role="button"
            aria-label="Remove"
            style={styles.chipRemoveBtn}
            onClick={() => onPressRemoveChip(slotIndex)}
          >
            <span style={styles.chipRemoveText}>×</span>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onPressSlot}
          style={{
            ...styles.chipBtn,
            ...(isActive ? styles.chipBtnActive : {}),
          }}
        >
          <div style={styles.chipTop}>
            {isEmpty ? (
              <span style={styles.chipAddPlus}>+</span>
            ) : logoSrc ? (
              <img src={logoSrc} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : null}
          </div>

          <div style={styles.chipBottom}>
            <span style={isEmpty ? styles.chipAddLabel : styles.chipCode}>
              {isEmpty ? "add airport" : String(code)}
            </span>
          </div>
        </button>
      </div>
    );
  };

  return (
    <div style={styles.root}>
      <div style={styles.scrollPad}>
        <div style={styles.card}>
          <div style={styles.h1}>Select airport(s)</div>
          <div style={styles.pMuted}>
            Members may select up to 3 airports. {"\n"}Guests may only select 1.
          </div>

          {/* Selected section (always visible) */}
          <div style={styles.selectedWrap}>
            <div style={styles.selectedTitleRow}>
              <div style={styles.selectedTitle}>Selected: {selectedCount}/{maxFavs}</div>
              <div style={styles.selectedHint}>Tap × to remove</div>
            </div>

            <div style={styles.selectedChipsRow}>
              {slots.map((code, idx) => (
                <SelectedChip key={`${code || "empty"}-${idx}`} code={code} slotIndex={idx} />
              ))}
            </div>

            {disableAvailableChoices ? (
              <div style={styles.limitHint}>
                You’ve reached your limit. Remove a selected airport to choose another.
              </div>
            ) : null}
          </div>

          {/* Picker (collapsed by default) */}
          {isPickerOpen ? (
            <>
              <div style={styles.sectionTitle}>
                {isReplaceMode
                  ? `Replacing airport in slot ${Number(activeSlotIndex ?? 0) + 1}`
                  : `Selecting airport for slot ${Number(activeSlotIndex ?? 0) + 1}`}
              </div>

              <input
                ref={(el) => { searchRef.current = el; }}
                value={search}
                onChange={(e) => setSearch(normalizeCode(e.target.value))}
                placeholder="Search by airport code (e.g. JFK)"
                style={styles.searchInput}
                autoCapitalize="characters"
                autoCorrect="off"
              />

              {/* Region segmented control */}
              <div style={styles.segmentRow}>
                <div
                  role="button"
                  onClick={() => {
                    if (disableAvailableChoices) return;
                    setRegion("Europe");
                    setSelectedCountry(null);
                  }}
                  style={{
                    ...styles.segmentBtn,
                    ...(region === "Europe" ? styles.segmentBtnActive : {}),
                    ...(disableAvailableChoices ? { opacity: 0.6, pointerEvents: "none" as any } : {}),
                  }}
                >
                  Europe
                </div>

                <div
                  role="button"
                  onClick={() => {
                    if (disableAvailableChoices) return;
                    setRegion("Rest");
                    setSelectedCountry(null);
                  }}
                  style={{
                    ...styles.segmentBtn,
                    ...(region === "Rest" ? styles.segmentBtnActive : {}),
                    ...(disableAvailableChoices ? { opacity: 0.6, pointerEvents: "none" as any } : {}),
                  }}
                >
                  Rest of the world
                </div>
              </div>

              {/* COUNTRY STEP */}
              {!selectedCountry ? (
                <>
                  {isSearchActive ? (
                    <div style={styles.sectionTitle}>Type a code to jump to its country</div>
                  ) : (
                    <>
                      <div style={styles.sectionTitle}>Available countries</div>

                      <div style={styles.flagGridWrap}>
                        <div style={styles.flagGridContent}>
                          {countriesBase.map((c: string) => {
                            const flagSrc = (COUNTRY_FLAGS as any)?.[c];
                            const disabled = disableAvailableChoices;

                            return (
                              <div
                                key={c}
                                style={{
                                  ...styles.flagTile,
                                  width: FlagTileWidth,
                                  opacity: disabled ? 0.45 : 1,
                                }}
                              >
                                <div
                                  role="button"
                                  onClick={() => {
                                    if (disabled) return;
                                    setSelectedCountry(c);
                                  }}
                                  style={{ cursor: disabled ? "default" : "pointer" }}
                                >
                                  <div style={styles.flagCard}>
                                    <div
                                      style={{
                                        width: "100%",
                                        aspectRatio: "1 / 1",
                                        background: "#fff",
                                        border: "1px solid #d9e2ee",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      <div
                                        style={{
                                          width: "48%",
                                          height: "48%",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                        }}
                                      >
                                        {flagSrc ? (
                                          <img src={flagSrc} style={{ width: "92%", height: "92%", objectFit: "contain" }} />
                                        ) : (
                                          <div style={{ fontWeight: 800, color: "rgba(19,35,51,0.45)", fontSize: 12 }}>
                                            No flag
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div style={styles.flagLabel}>{c}</div>
                              </div>
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
                  <div style={styles.countryHeaderRow}>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <div
                        style={{
                          width: 32,
                          aspectRatio: "1 / 1",
                          background: "#fff",
                          border: "1px solid #d9e2ee",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {selectedFlagSrc ? (
                          <img src={selectedFlagSrc} style={{ width: "92%", height: "92%", objectFit: "contain" }} />
                        ) : null}
                      </div>

                      <div style={{ ...styles.sectionTitle, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {selectedCountry}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (disableAvailableChoices) return;
                        setSelectedCountry(null);
                        setSearch("");
                      }}
                      style={styles.countryBackBtn}
                    >
                      Back / Other countries
                    </button>
                  </div>

                  {/* AIRPORT STEP GRID */}
                  <div>
                    {airportRows.map((row, rowIdx) => (
                      <div key={`row-${rowIdx}`} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                        {Array.from({ length: AIRPORT_COLS }).map((_, colIdx) => {
                          const a = row[colIdx];

                          if (!a) {
                            return <div key={`empty-${rowIdx}-${colIdx}`} style={{ flex: 1, opacity: 0, height: 102 }} />;
                          }

                          const isSel = favs.includes(a.code);
                          const disabled = isReplaceMode ? false : disableAvailableChoices && !isSel;
                          const logoSrc = (AIRPORT_LOGOS as any)?.[a.code];

                          return (
                            <div key={`${a.code}-${rowIdx}-${colIdx}`} style={{ flex: 1 }}>
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() => {
                                  if (disabled) return;

                                  const slot = typeof activeSlotIndex === "number" ? activeSlotIndex : 0;
                                  const desired = String(a.code || "").toUpperCase();

                                  if (!favs.includes(desired) && !limitReached) {
                                    prefetchScheduleFor(desired, "airport_select_assign");
                                  }

                                  setFavsSafe((prev: any) => {
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
                                  }, "assign");

                                  setIsPickerOpen(false);
                                  setSearch("");
                                }}
                                style={{
                                  ...styles.chipBtn,
                                  height: 102,
                                  opacity: disabled ? 0.45 : 1,
                                }}
                              >
                                <div style={styles.chipTop}>
                                  {logoSrc ? (
                                    <img src={logoSrc} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                  ) : null}
                                </div>
                                <div style={styles.chipBottom}>
                                  <span style={styles.chipCode}>{String(a.code)}</span>
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
      <div style={styles.bottomBar}>
        <div style={styles.bottomInner}>
          <div
            role="button"
            style={styles.bottomBtn}
            onClick={() => {
              const primary = (Array.isArray(favs) ? favs : []).filter(Boolean)[0];
              if (primary) prefetchScheduleFor(primary, "airport_select_done");
              saveFavourites(auth, (Array.isArray(favs) ? favs : []).filter(Boolean), { trigger: "done" });
              nav(-1); // go back to Home
            }}
          >
            <div style={styles.bottomBtnText}>Airport selection completed</div>
          </div>
        </div>
      </div>

      {/* Remove confirm modal */}
      {removeConfirmVisible ? (
        <div
          style={styles.modalOverlay}
          onClick={() => {
            setRemoveConfirmVisible(false);
          }}
        >
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>Remove airport?</div>
            <div style={styles.modalBody}>This will remove the airport from your selection.</div>

            <div style={styles.modalBtnRow}>
              <div
                role="button"
                style={{ ...styles.modalBtn, ...styles.modalBtnGhost }}
                onClick={() => {
                  setRemoveConfirmVisible(false);
                  setPendingRemoveIndex(null);
                }}
              >
                Cancel
              </div>

              <div
                role="button"
                style={{ ...styles.modalBtn, ...styles.modalBtnPrimary }}
                onClick={() => {
                  if (typeof pendingRemoveIndex === "number") removeAt(pendingRemoveIndex);
                  setRemoveConfirmVisible(false);
                  setPendingRemoveIndex(null);
                }}
              >
                Remove
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
