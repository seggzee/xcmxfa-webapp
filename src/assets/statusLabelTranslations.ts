// ================== START statusLabelTranslations.js ==================
// Display-only status label translations
// Location: src/assets/statusLabelTranslations.js
// Rules:
// - Static map only
// - No logic, no fallbacks here
// - Keys match API opStatus values (as received)

const STATUS_LABEL_TRANSLATIONS = {
  SCHEDULED: "Scheduled",

  DELAYED: "Delayed",

  CANCELLED: "Cancelled",

  ONTIME: "On time",
  ON_TIME: "On time",

  NEW_EARLY_DEPARTURE_TIME: "Early departure",
  EARLY_DEPARTURE: "Early departure",

  DELAYED_DEPARTURE: "Delayed dep",
  NEW_DEPARTURE_TIME: "New dep time",

  DEPARTED: "Departed",

  IN_FLIGHT: "In flight",

  LANDED: "Landed",

  EARLY_ARRIVAL: "Early arrival",

  ARRIVED: "Arrived",

  DELAYED_ARRIVAL: "Delayed arr",

  DIVERTED: "Diverted",
};

export default STATUS_LABEL_TRANSLATIONS;

// ================== END statusLabelTranslations.js ==================
