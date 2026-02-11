// ================== START statusColourCodes.js ==================
// Display-only status colour code translations
// Location: src/assets/statusColourCodes.js
// Rules:
// - Static map only
// - No logic, no fallbacks here

const STATUS_COLOUR_CODES = {
  SCHEDULED: "#b2b2b2", // grey

  DELAYED: "#ff8503", // amber

  CANCELLED: "#f5554a", // red

  ONTIME: "#5ab66f", // green
  ON_TIME: "#5ab66f", // green

  NEW_EARLY_DEPARTURE_TIME: "#ffd22b", // yellow
  EARLY_DEPARTURE: "#ffd22b", // yellow

  DELAYED_DEPARTURE: "#ff8503", // amber
  NEW_DEPARTURE_TIME: "#ff8503", // amber

  DEPARTED: "#2986cc", // blue

  IN_FLIGHT: "#2986cc", // blue

  LANDED: "#2986cc", // blue

  EARLY_ARRIVAL: "#5ab66f", // green

  ARRIVED: "#b2b2b2", // grey

  DELAYED_ARRIVAL: "#ff8503", // amber

  DIVERTED: "#f5554a", // red
};

export default STATUS_COLOUR_CODES;

// ================== END statusColourCodes.js ==================
