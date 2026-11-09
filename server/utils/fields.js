const { msg } = require("./i18n");
// Zajednička provera polja za termine i terene

// Sportovi sa terenima, turnirima i rang listom
const SPORTS = ["Fudbal", "Košarka", "Tenis", "Odbojka"];

// Planinarenje postoji samo kao termin: bez terena, timova i rezultata
const HIKING = "Planinarenje";
const MATCH_SPORTS = [...SPORTS, HIKING];

const SPORT_EMOJI = { Fudbal: "⚽", Košarka: "🏀", Tenis: "🎾", Odbojka: "🏐", Planinarenje: "🥾" };

// "Teren nije za ..."
const SPORT_ACCUSATIVE = {
  Fudbal: "fudbal",
  Košarka: "košarku",
  Tenis: "tenis",
  Odbojka: "odbojku",
  Planinarenje: "planinarenje",
};

// Cena terena u dinarima nije obavezna. Vraća { error } ili { price } (null kad nije poslata).
const MAX_PRICE = 1000000;

const parsePrice = ({ field_price }) => {
  if (field_price === undefined || field_price === null || field_price === "") {
    return { price: null };
  }

  const price = Number(field_price);

  if (!Number.isInteger(price) || price < 0 || price > MAX_PRICE) {
    return { error: msg("common.theVenuePriceMustBe") };
  }

  return { price };
};

// Koordinate nisu obavezne, ali ako postoje moraju biti obe i ispravne.
// Vraća { error } ili { latitude, longitude } (oba null kad nisu poslate).
const parseCoords = ({ latitude, longitude }) => {
  const empty = (v) => v === undefined || v === null || v === "";

  if (empty(latitude) && empty(longitude)) {
    return { latitude: null, longitude: null };
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (
    empty(latitude) ||
    empty(longitude) ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return { error: msg("common.invalidLocationOnTheMap") };
  }

  return { latitude: lat, longitude: lng };
};

const HIKE_DIFFICULTIES = ["easy", "medium", "hard"];
const MAX_GEAR = 500;

// Broj koji nije obavezan: prazno je null, a neispravno undefined
const optionalNumber = (value, isValid) => {
  if (value === undefined || value === null || value === "") return null;

  const number = Number(value);

  return Number.isFinite(number) && isValid(number) ? number : undefined;
};

// Podaci o stazi; obavezni samo za planinarenje. Vraća { error } ili { hike }
// (null za ostale sportove).
const parseHike = ({ sport, hike }) => {
  if (sport !== HIKING) return { hike: null };

  const route = typeof hike?.route === "string" ? hike.route.trim() : "";

  if (route.length < 2 || route.length > 100) {
    return { error: msg("common.enterTheTrailOrPeak") };
  }

  if (!HIKE_DIFFICULTIES.includes(hike.difficulty)) {
    return { error: msg("common.pickTheTrailDifficulty") };
  }

  const distance = optionalNumber(hike.distance_km, (n) => n > 0 && n <= 200);
  const ascent = optionalNumber(hike.ascent_m, (n) => Number.isInteger(n) && n >= 0 && n <= 9000);
  const duration = optionalNumber(hike.duration_hours, (n) => n > 0 && n <= 72);

  if (distance === undefined) return { error: msg("common.invalidTrailLength") };
  if (ascent === undefined) return { error: msg("common.invalidAscent") };
  if (duration === undefined) return { error: msg("common.invalidDuration") };

  const gear = typeof hike.gear === "string" && hike.gear.trim() !== "" ? hike.gear.trim() : null;

  if (gear && gear.length > MAX_GEAR) {
    return { error: msg("common.theGearListCanHave", { value: MAX_GEAR }) };
  }

  return {
    hike: {
      route,
      difficulty: hike.difficulty,
      distance_km: distance,
      ascent_m: ascent,
      duration_hours: duration,
      gear,
    },
  };
};

module.exports = {
  SPORTS,
  HIKING,
  MATCH_SPORTS,
  parseHike,
  SPORT_EMOJI,
  SPORT_ACCUSATIVE,
  MAX_PRICE,
  parsePrice,
  parseCoords,
};
