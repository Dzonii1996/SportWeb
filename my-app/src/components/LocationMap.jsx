import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import { Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DEFAULT_CENTER, getMyPosition } from "../utils/geo";

// Sopstvena ikonica, jer se podrazumevane Leaflet slike ne učitavaju kroz webpack
const pinIcon = L.divIcon({
  className: "",
  html: '<div style="font-size:32px;line-height:32px;transform:translate(-50%,-100%)">📍</div>',
  iconSize: [0, 0],
});

// Teren u katalogu: ikonica sporta u belom krugu
const venueIcon = (sports) =>
  L.divIcon({
    className: "",
    html: `<div style="transform:translate(-50%,-50%);background:#fff;border:2px solid #16a34a;border-radius:9999px;padding:2px 6px;font-size:16px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.3)">${sports
      .map((s) => (s === "Košarka" ? "🏀" : "⚽"))
      .join("")}</div>`,
    iconSize: [0, 0],
  });

const meIcon = L.divIcon({
  className: "",
  html: '<div style="transform:translate(-50%,-50%);width:16px;height:16px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 2px #2563eb"></div>',
  iconSize: [0, 0],
});

const Tiles = () => (
  <TileLayer
    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  />
);

// Pomera mapu kad se promeni centar (MapContainer ga čita samo pri prvom prikazu)
function Recenter({ center }) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.setView(center, Math.max(map.getZoom(), 15));
    }
  }, [center, map]);

  return null;
}

function ClickToPick({ onPick }) {
  useMapEvents({
    click: (e) => onPick([e.latlng.lat, e.latlng.lng]),
  });

  return null;
}

// Izbor lokacije u formi: klik na mapu postavlja pin.
// value: [lat, lng] ili null; required samo menja tekst uputstva
export function LocationPicker({ value, onChange, required = false }) {
  const [center, setCenter] = useState(null);
  const [locating, setLocating] = useState(false);

  const useMyLocation = async () => {
    setLocating(true);

    try {
      const position = await getMyPosition();
      onChange(position);
      setCenter(position);
    } catch (error) {
      alert(error.message);
    } finally {
      setLocating(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="text-sm text-gray-600">
          {value
            ? "📍 Lokacija je označena. Klikni na mapu da je promeniš."
            : required
            ? "Klikni na mapu da označiš tačno mesto (obavezno)."
            : "Klikni na mapu da označiš tačno mesto (nije obavezno)."}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200"
          >
            {locating ? "Tražim..." : "Moja lokacija"}
          </button>

          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-red-600"
            >
              Ukloni
            </button>
          )}
        </div>
      </div>

      <MapContainer
        center={value || DEFAULT_CENTER}
        zoom={value ? 15 : 13}
        className="h-64 w-full rounded-xl z-0"
      >
        <Tiles />
        <ClickToPick onPick={onChange} />
        <Recenter center={center} />
        {value && <Marker position={value} icon={pinIcon} />}
      </MapContainer>
    </div>
  );
}

// Prikaz lokacije termina sa linkom za navigaciju
export function LocationView({ latitude, longitude }) {
  const position = [latitude, longitude];

  return (
    <div>
      <MapContainer
        center={position}
        zoom={15}
        scrollWheelZoom={false}
        className="h-56 w-full rounded-xl z-0"
      >
        <Tiles />
        <Marker position={position} icon={pinIcon} />
      </MapContainer>

      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block mt-2 text-green-700 hover:underline font-medium"
      >
        🧭 Uputstva do terena
      </a>
    </div>
  );
}

// Prilagođava prikaz tako da se vide svi tereni (i moja lokacija)
function FitBounds({ points }) {
  const map = useMap();
  const key = JSON.stringify(points);

  useEffect(() => {
    const list = JSON.parse(key);

    if (list.length === 1) {
      map.setView(list[0], 14);
    } else if (list.length > 1) {
      map.fitBounds(list, { padding: [30, 30], maxZoom: 15 });
    }
  }, [key, map]);

  return null;
}

// Mapa svih terena iz kataloga; klik na teren otvara kratak opis sa linkom
export function VenuesMap({ venues, myPosition = null }) {
  const points = venues.map((v) => [v.latitude, v.longitude]);

  if (myPosition) points.push(myPosition);

  return (
    <MapContainer
      center={points[0] || DEFAULT_CENTER}
      zoom={13}
      scrollWheelZoom={false}
      className="h-80 md:h-96 w-full rounded-2xl z-0"
    >
      <Tiles />
      <FitBounds points={points} />

      {myPosition && <Marker position={myPosition} icon={meIcon} />}

      {venues.map((venue) => (
        <Marker
          key={venue.id}
          position={[venue.latitude, venue.longitude]}
          icon={venueIcon(venue.sports)}
        >
          <Popup>
            <div className="space-y-1">
              <p className="font-bold text-base">{venue.name}</p>
              <p className="text-gray-600">{venue.address}</p>
              <Link to={`/tereni/${venue.id}`} className="text-green-700 font-semibold">
                Detalji terena →
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
