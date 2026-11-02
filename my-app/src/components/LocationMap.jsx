import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DEFAULT_CENTER, getMyPosition } from "../utils/geo";

// Sopstvena ikonica, jer se podrazumevane Leaflet slike ne učitavaju kroz webpack
const pinIcon = L.divIcon({
  className: "",
  html: '<div style="font-size:32px;line-height:32px;transform:translate(-50%,-100%)">📍</div>',
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
// value: [lat, lng] ili null
export function LocationPicker({ value, onChange }) {
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
