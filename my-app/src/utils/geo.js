import i18n from "../i18n";

// Kosovska Mitrovica: početni prikaz mape kad termin nema lokaciju
export const DEFAULT_CENTER = [42.8914, 20.866];

export const hasCoords = (match) =>
  match?.latitude !== null &&
  match?.latitude !== undefined &&
  match?.longitude !== null &&
  match?.longitude !== undefined;

// Udaljenost između dve tačke u km (haversine)
export const distanceKm = (lat1, lng1, lat2, lng2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const formatDistance = (km) =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;

// Trenutna lokacija korisnika iz browsera
export const getMyPosition = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error(i18n.t("geo.yourBrowserDoesntSupportLocation")));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
      () => reject(new Error(i18n.t("geo.locationIsntAvailableCheckYour"))),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
