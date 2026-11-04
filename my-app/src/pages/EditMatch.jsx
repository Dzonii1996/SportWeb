import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { authHeader } from "../utils/auth";
import { API_URL } from "../config";
import { localDateKey, todayKey, maxDateKey } from "../utils/matchDate";
import { hasCoords } from "../utils/geo";
import { LocationPicker } from "../components/LocationMap";
import RepeatWeeklyField from "../components/RepeatWeeklyField";
import FieldPriceInput from "../components/FieldPriceInput";
import PrivateMatchField from "../components/PrivateMatchField";
import VenuePicker from "../components/VenuePicker";
import { useVenues } from "../utils/venues";
import { hourLabel } from "../utils/reservations";
import { useTranslation } from "react-i18next";

function EditMatch() {
  const { t } = useTranslation();

  const { id } = useParams();
  const navigate = useNavigate();

  const [location, setLocation] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [matchTime, setMatchTime] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("");
  const [fieldPrice, setFieldPrice] = useState("");
  const [position, setPosition] = useState(null);
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [inSeries, setInSeries] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [sport, setSport] = useState("Fudbal");
  // Teren iz kataloga ("" = ručni unos) i njegov naziv, ako više nije na listi
  const [venueId, setVenueId] = useState("");
  const [venueName, setVenueName] = useState(null);
  // Aktivna rezervacija terena: teren, datum i vreme se ne menjaju dok postoji
  const [reservation, setReservation] = useState(null);

  const venues = useVenues();

  useEffect(() => {
    // Token: kreator vidi i privatni termin bez ključa iz linka
    fetch(`${API_URL}/api/matches/${id}`, { headers: authHeader() })
      .then((res) => res.json())
      .then((data) => {
        const match = data.match;

        if (match) {
          setLocation(match.location);
          // Lokalni datum; split("T") nad UTC vrednošću daje dan ranije
          setMatchDate(localDateKey(match.match_date));
          setMatchTime(match.match_time.slice(0, 5));
          setMaxPlayers(match.max_players);
          setFieldPrice(match.field_price ?? "");
          setPosition(
            hasCoords(match) ? [match.latitude, match.longitude] : null
          );
          setRepeatWeekly(Boolean(match.repeat_weekly));
          setInSeries(Boolean(match.repeat_weekly));
          setIsPrivate(Boolean(match.is_private));
          setSport(match.sport);
          setVenueId(match.venue_id ? String(match.venue_id) : "");
          setVenueName(match.venue_name);
          setReservation(
            ["pending", "confirmed"].includes(match.reservation_status)
              ? { start: match.reservation_start_hour, end: match.reservation_end_hour }
              : null
          );
        }

        setLoaded(true);
      });
  }, [id]);

  // Izbor terena popunjava lokaciju, tačku na mapi i cenu (po satu)
  const selectVenue = (venue) => {
    if (!venue) {
      setVenueId("");
      return;
    }

    setVenueId(String(venue.id));
    setLocation(venue.name);
    setPosition([venue.latitude, venue.longitude]);

    if (venue.price_per_hour !== null) {
      setFieldPrice(venue.price_per_hour);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const res = await fetch(
      `${API_URL}/api/matches/${id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(),
        },
        body: JSON.stringify({
          location,
          match_date: matchDate,
          match_time: matchTime,
          max_players: Number(maxPlayers),
          field_price: fieldPrice,
          repeat_weekly: repeatWeekly,
          is_private: isPrivate,
          venue_id: venueId || null,
          latitude: position?.[0] ?? null,
          longitude: position?.[1] ?? null,
        }),
      }
    );

    const data = await res.json();

    alert(data.message);

    if (data.success) {
      navigate(`/matches/${id}`);
    }
  };

  if (!loaded) {
    return (
      <div className="text-center mt-20 text-xl">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">
        {t("common.editGame")}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        {reservation && (
          <div className="border border-green-200 bg-green-50 rounded-xl p-4 text-sm text-gray-700">
            <p className="font-semibold">
              {t("editMatch.theVenueIsBookedFor", { venueName, hourLabel: hourLabel(reservation.start), hourLabel2: hourLabel(reservation.end) })}
            </p>
            <p>
              {t("editMatch.theVenueDateAndTime")}
            </p>
          </div>
        )}

        {!reservation && (
          <VenuePicker
            venues={venues}
            sport={sport}
            value={venueId}
            onChange={selectVenue}
            currentName={venueName}
          />
        )}

        {/* Ručni unos kad teren nije sa liste */}
        {!venueId && !reservation && (
          <>
            <input
              className="w-full border p-3 rounded-xl"
              value={location}
              onChange={(e) =>
                setLocation(e.target.value)
              }
              required
              minLength={2}
              maxLength={100}
              placeholder={t("common.location")}
            />

            <LocationPicker value={position} onChange={setPosition} />
          </>
        )}

        <input
          type="date"
          className="w-full border p-3 rounded-xl disabled:bg-gray-100 disabled:text-gray-500"
          disabled={Boolean(reservation)}
          value={matchDate}
          onChange={(e) =>
            setMatchDate(e.target.value)
          }
          required
          min={todayKey()}
          max={maxDateKey()}
        />

        <input
          type="time"
          className="w-full border p-3 rounded-xl disabled:bg-gray-100 disabled:text-gray-500"
          disabled={Boolean(reservation)}
          value={matchTime}
          onChange={(e) =>
            setMatchTime(e.target.value)
          }
          required
        />

        <input
          type="number"
          className="w-full border p-3 rounded-xl"
          value={maxPlayers}
          onChange={(e) =>
            setMaxPlayers(e.target.value)
          }
          required
          min="2"
          max="30"
        />

        <FieldPriceInput
          value={fieldPrice}
          onChange={(e) => setFieldPrice(e.target.value)}
        />

        <RepeatWeeklyField
          checked={repeatWeekly}
          onChange={setRepeatWeekly}
          inSeries={inSeries}
        />

        <PrivateMatchField checked={isPrivate} onChange={setIsPrivate} />

        <button
          className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl"
        >
          {t("common.saveChanges")}
        </button>
      </form>
    </div>
  );
}

export default EditMatch;
