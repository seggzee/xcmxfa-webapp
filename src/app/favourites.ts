export const FAV_KEY_MEMBER = "@xcmxfa:favourites_member";
export const FAV_KEY_GUEST = "@xcmxfa:favourites_guest";

export function getMaxFavs(auth: any) {
  const isMember = auth?.mode === "member";
  const isKnown = !isMember && Boolean(auth?.user); // reserved like RN
  const isMemberOrKnown = isMember || isKnown;
  return isMemberOrKnown ? 3 : 1;
}

export function getFavKey(auth: any) {
  const isMember = auth?.mode === "member";
  const isKnown = !isMember && Boolean(auth?.user);
  const isMemberOrKnown = isMember || isKnown;
  return isMemberOrKnown ? FAV_KEY_MEMBER : FAV_KEY_GUEST;
}

export function loadFavourites(auth: any): string[] {
  const key = getFavKey(auth);
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    const out = Array.isArray(arr) ? arr : [];
    return out
      .map((x) => String(x || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))
      .filter(Boolean);
  } catch (e) {
    console.error("[favourites] load failed", e);
    return [];
  }
}

export function saveFavourites(auth: any, favourites: string[], meta?: any) {
  const key = getFavKey(auth);
  const clean = (Array.isArray(favourites) ? favourites : [])
    .map((x) => String(x || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))
    .filter(Boolean);

  try {
    localStorage.setItem(key, JSON.stringify(clean));
  } catch (e) {
    console.error("[favourites] save failed", e);
  }

  // Strict-mode visibility (parity with RN triggers, but web logs it)
  if (meta?.trigger) {
    console.log(`[favourites] saved (${key}) trigger=${meta.trigger}`, clean);
  }
}
