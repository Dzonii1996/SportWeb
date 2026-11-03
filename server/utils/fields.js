// Zajednička provera polja za termine i terene

const SPORTS = ["Fudbal", "Košarka"];

// Cena terena u dinarima nije obavezna. Vraća { error } ili { price } (null kad nije poslata).
const MAX_PRICE = 1000000;

const parsePrice = ({ field_price }) => {
  if (field_price === undefined || field_price === null || field_price === "") {
    return { price: null };
  }

  const price = Number(field_price);

  if (!Number.isInteger(price) || price < 0 || price > MAX_PRICE) {
    return { error: "Cena terena mora biti ceo broj dinara (do 1.000.000)." };
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
    return { error: "Neispravna lokacija na mapi." };
  }

  return { latitude: lat, longitude: lng };
};

module.exports = {
  SPORTS,
  MAX_PRICE,
  parsePrice,
  parseCoords,
};
