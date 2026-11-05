import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { authHeader } from "../utils/auth";
import { API_URL } from "../config";
import { todayKey, maxDateKey } from "../utils/matchDate";
import { LocationPicker } from "../components/LocationMap";
import RepeatWeeklyField from "../components/RepeatWeeklyField";
import FieldPriceInput from "../components/FieldPriceInput";
import PrivateMatchField from "../components/PrivateMatchField";
import VenuePicker from "../components/VenuePicker";
import ReserveVenueField from "../components/ReserveVenueField";
import { useVenues } from "../utils/venues";
import { SPORTS, defaultPlayers, sportOption } from "../utils/sports";
import { hourLabel, formatReservationDate } from "../utils/reservations";
import { useTranslation } from "react-i18next";

// Promena sporta menja i broj igrača, ako ga korisnik nije sam menjao
const withSport = (data, sport) => ({
  ...data,
  sport,
  max_players:
    Number(data.max_players) === defaultPlayers(data.sport)
      ? defaultPlayers(sport)
      : data.max_players,
});

function CreateMatch() {
  const { t } = useTranslation();

  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user"));

  // "Napravi termin ovde" sa stranice terena: /create-match?venue=5,
  // a iz rezervacije i &date=2026-11-20&time=18:00&hours=2&reservation=7
  const [searchParams] = useSearchParams();
  const venueParam = searchParams.get("venue");
  const reservationId = searchParams.get("reservation");
  const reservedHours = Number(searchParams.get("hours")) || 1;

  const [formData, setFormData] = useState({
    sport: "Fudbal",
    location: "",
    match_date: /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get("date") || "") ? searchParams.get("date") : "",
    match_time: /^\d{2}:\d{2}$/.test(searchParams.get("time") || "") ? searchParams.get("time") : "",
    max_players: 10,
    field_price: "",
  });

  // Tačno mesto na mapi [lat, lng], nije obavezno
  const [position, setPosition] = useState(null);
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  // Teren iz kataloga ("" = ručni unos lokacije)
  const [venueId, setVenueId] = useState("");
  // Rezervacija terena uz termin (samo za teren koji prima rezervacije)
  const [reserve, setReserve] = useState(true);
  const [reservationHours, setReservationHours] = useState(1);

  const venues = useVenues();
  const selectedVenue = venues?.find((v) => String(v.id) === venueId);
  const bookable = Boolean(selectedVenue?.accepts_reservations && selectedVenue?.owner_id);

  // Izbor terena popunjava lokaciju, tačku na mapi i cenu (po satu).
  // Sport se menja samo ako teren nije za trenutno izabrani.
  const selectVenue = useCallback((venue) => {
    if (!venue) {
      setVenueId("");
      return;
    }

    setVenueId(String(venue.id));
    setPosition([venue.latitude, venue.longitude]);
    setFormData((data) => ({
      ...withSport(data, venue.sports.includes(data.sport) ? data.sport : venue.sports[0]),
      location: venue.name,
      // Iz rezervacije: cena za sve rezervisane sate
      field_price:
        venue.price_per_hour !== null
          ? venue.price_per_hour * (reservationId ? reservedHours : 1)
          : data.field_price,
    }));
    setReservationHours(1);
  }, [reservationId, reservedHours]);

  // Trajanje rezervacije menja i ukupnu cenu terena
  const changeReservationHours = (hours) => {
    setReservationHours(hours);

    if (selectedVenue?.price_per_hour !== null && selectedVenue?.price_per_hour !== undefined) {
      setFormData((data) => ({ ...data, field_price: selectedVenue.price_per_hour * hours }));
    }
  };

  useEffect(() => {
    const venue = venues?.find((v) => String(v.id) === venueParam);

    if (venue) selectVenue(venue);
  }, [venues, venueParam, selectVenue]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // Promena sporta: teren koji nije za taj sport se poništava
  const handleSportChange = (e) => {
    const venue = venues?.find((v) => String(v.id) === venueId);

    if (venue && !venue.sports.includes(e.target.value)) {
      setVenueId("");
    }

    setFormData((data) => withSport(data, e.target.value));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post(
        `${API_URL}/api/matches`,
        {
          user_id: user.id,
          ...formData,
          repeat_weekly: repeatWeekly,
          is_private: isPrivate,
          venue_id: venueId || null,
          reservation_id: reservationId || null,
          reserve: !reservationId && bookable && reserve,
          reservation_hours: reservationHours,
          latitude: position?.[0] ?? null,
          longitude: position?.[1] ?? null,
        },
        { headers: authHeader() }
      );

      alert(response.data.message);

      // Na stranicu termina, odakle se odmah deli link (privatni nije na listi)
      navigate(`/matches/${response.data.match.id}`);

    } catch (error) {
      alert(
        error.response?.data?.message || t("createMatch.couldNotCreateTheGame")
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center py-4 sm:py-10 px-4">

      <div className="bg-white p-5 sm:p-8 rounded-2xl shadow-lg w-full max-w-lg h-fit">

        <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">
          {t("createMatch.createANewGame")}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">

          <select
            name="sport"
            value={formData.sport}
            onChange={handleSportChange}
            className="w-full border p-3 rounded-xl"
          >
            {SPORTS.map((s) => (
              <option key={s.value} value={s.value}>{sportOption(s.value)}</option>
            ))}
          </select>

          {/* Iz rezervacije: teren, datum i vreme su zaključani */}
          {reservationId ? (
            <div className="border border-green-200 bg-green-50 rounded-xl p-4 text-gray-700">
              <p className="font-semibold">{t("createMatch.gameForYourBooking")}</p>
              <p className="text-sm">
                🏟️ {selectedVenue?.name || formData.location} ·{" "}
                {formData.match_date && formatReservationDate(`${formData.match_date}T00:00`)}{" "}
                {formData.match_time && `· ${formData.match_time}–${hourLabel(Number(formData.match_time.slice(0, 2)) + reservedHours)}`}
              </p>
            </div>
          ) : (
            <VenuePicker
              venues={venues}
              sport={formData.sport}
              value={venueId}
              onChange={selectVenue}
            />
          )}

          {/* Ručni unos kad teren nije sa liste */}
          {!venueId && (
            <>
              <input
                type="text"
                name="location"
                placeholder={t("common.location")}
                value={formData.location}
                onChange={handleChange}
                required
                minLength={2}
                maxLength={100}
                className="w-full border p-3 rounded-xl"
              />

              <LocationPicker value={position} onChange={setPosition} />
            </>
          )}

          {!reservationId && (
            <>
              <input
                type="date"
                name="match_date"
                value={formData.match_date}
                onChange={handleChange}
                required
                min={todayKey()}
                max={maxDateKey()}
                className="w-full border p-3 rounded-xl"
              />

              <input
                type="time"
                name="match_time"
                value={formData.match_time}
                onChange={handleChange}
                required
                step={bookable && reserve ? 3600 : undefined}
                className="w-full border p-3 rounded-xl"
              />

              {bookable && (
                <ReserveVenueField
                  checked={reserve}
                  onChange={setReserve}
                  hours={reservationHours}
                  onHoursChange={changeReservationHours}
                  time={formData.match_time}
                />
              )}
            </>
          )}

          <input
            type="number"
            name="max_players"
            required
            min="2"
            max="30"
            value={formData.max_players}
            onChange={handleChange}
            className="w-full border p-3 rounded-xl"
          />

          <FieldPriceInput
            name="field_price"
            value={formData.field_price}
            onChange={handleChange}
          />

          <RepeatWeeklyField checked={repeatWeekly} onChange={setRepeatWeekly} />

          <PrivateMatchField checked={isPrivate} onChange={setIsPrivate} />

          <button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl"
          >
            {t("common.createGame")}
          </button>

        </form>

      </div>

    </div>
  );
}

export default CreateMatch;