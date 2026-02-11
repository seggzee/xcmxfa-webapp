/**
 * Idiot-guide:
 * These keys mirror the AsyncStorage keys in RN AppRoot.js.
 * On web we use localStorage instead of AsyncStorage.
 *
 * IMPORTANT:
 * - Do not rename these keys unless you also migrate stored values.
 */

export const STORAGE_FAVS_MEMBER = "@xcmxfa:favourites_member"; // member: max 3 airports
export const STORAGE_FAVS_GUEST = "@xcmxfa:favourites_guest";   // guest: max 1 airport
export const STORAGE_PENDING_USERNAME = "@xcmxfa:pendingUsername"; // resume-onboarding helper
