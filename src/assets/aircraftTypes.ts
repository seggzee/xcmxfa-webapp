// ================== START aircraftTypes.js ==================
// Display-only aircraft type translations
// Location: src/assets/aircraftTypes.js
// Rules:
// - Static map only
// - Short manufacturer codes only (B / A / E)
// - Values are final UI strings (already capped)
// - No logic, no fallbacks here

const AIRCRAFT_TYPES = {
  // Embraer
  E75: "E175",
  E7W: "E175",
  E175: "E175",

  E90: "E190",  
  "290": "E190-E2",
  E190: "E190",

  "295": "E195-E2",
  "195": "E195",
  E195: "E195",

  // Boeing
  B737: "B737",
  "73H": "B737-8",
  "738": "B737-8",
  B738: "B737-8",
  "73J": "B737-9",
  B739: "B737-9",

  B777: "B777",
  "772": "B777-2",
  "773": "B777-3",

  B787: "B787",
  "781": "B787-X",
  "789": "B787-9",

  // Airbus
  A319: "A319",

  A320: "A320",
  "32Q": "A320-N",

  A321: "A321",

  "339": "A330-N",
  "333": "A330-3",
  "332": "A330-2",
};

export default AIRCRAFT_TYPES;

// ================== END aircraftTypes.js ==================
