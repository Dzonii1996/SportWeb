import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_URL } from "../config";
import { authHeader } from "../utils/auth";
import { todayKey } from "../utils/matchDate";
import { formatRSD } from "../utils/price";
import {
  MAX_DAYS_AHEAD,
  busyAt,
  hourLabel,
  maxDurationFrom,
} from "../utils/reservations";
import { useTranslation } from "react-i18next";

const dateKeyIn = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Rezervacija terena: izbor dana, slobodnog sata i trajanja.
// Vlasnik istom formom upisuje zauzeto vreme (npr. rezervaciju telefonom).
function VenueBooking({ venue, isOwner }) {
  const { t } = useTranslation();

  const loggedIn = Boolean(localStorage.getItem("token"));

  const [date, setDate] = useState(todayKey());
  const [data, setData] = useState(null);
  const [start, setStart] = useState(null);
  const [hours, setHours] = useState(1);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setStart(null);

    fetch(`${API_URL}/api/venues/${venue.id}/availability?date=${date}`)
      .then((res) => res.json())
      .then((result) => setData(result.success ? result : null))
      .catch(() => setData(null));
  }, [venue.id, date]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) return null;

  const { open_hour: open, close_hour: close, busy, price_per_hour: price } = data;
  const now = new Date();
  const isToday = date === todayKey();
  const isPast = (hour) => isToday && hour <= now.getHours();
  const maxHours = start === null ? 0 : maxDurationFrom(start, busy, close);

  const pick = (hour) => {
    setStart(hour);
    setHours((h) => Math.min(Math.max(h, 1), maxDurationFrom(hour, busy, close)));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`${API_URL}/api/venues/${venue.id}/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ date, start_hour: start, hours, note }),
      });
      const result = await res.json();

      alert(result.message);

      if (result.success) setNote("");
      load();
    } finally {
      setSaving(false);
    }
  };

  const hourList = [];
  for (let h = open; h < close; h++) hourList.push(h);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{t("venueBooking.bookTheVenue")}</h2>
          <p className="text-gray-600 text-sm">
            {isOwner
              ? t("venueBooking.enterTimeTakenOutsideSportweb")
              : t("venueBooking.pickADayAndA")}
          </p>
        </div>

        <input
          type="date"
          value={date}
          min={todayKey()}
          max={dateKeyIn(MAX_DAYS_AHEAD)}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="border p-2.5 rounded-xl"
        />
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        {hourList.map((hour) => {
          const taken = busyAt(hour, busy);
          const disabled = Boolean(taken) || isPast(hour);
          const selected = start !== null && hour >= start && hour < start + hours;

          let className = "border-gray-200 hover:border-green-500 hover:bg-green-50";
          if (selected) className = "bg-green-600 border-green-600 text-white";
          else if (taken?.status === "confirmed") className = "bg-red-50 border-red-200 text-red-400";
          else if (taken) className = "bg-amber-50 border-amber-200 text-amber-500";
          else if (disabled) className = "bg-gray-50 border-gray-100 text-gray-300";

          return (
            <button
              key={hour}
              type="button"
              disabled={disabled}
              onClick={() => pick(hour)}
              title={taken ? (taken.status === "confirmed" ? t("venueBooking.taken") : t("venueBooking.hasAPendingRequest")) : ""}
              className={`border rounded-xl py-2 text-sm font-semibold transition ${className}`}
            >
              {hourLabel(hour)}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <span>{t("venueBooking.free")}</span>
        <span className="text-amber-600">{t("venueBooking.awaitingConfirmation")}</span>
        <span className="text-red-500">{t("venueBooking.taken2")}</span>
      </div>

      {start !== null && maxHours > 0 && (
        loggedIn ? (
          <form onSubmit={submit} className="border rounded-xl p-4 space-y-3 bg-gray-50">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold">
                {t("venueBooking.fromTo", { hourLabel: hourLabel(start), hourLabel2: hourLabel(start + hours) })}
              </span>

              <select
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="border p-2 rounded-xl bg-white"
                aria-label={t("venueBooking.duration")}
              >
                {Array.from({ length: maxHours }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h}>
                    {t("common.hours", { count: h })}
                  </option>
                ))}
              </select>

              {price !== null && (
                <span className="text-gray-600">
                  {t("venueBooking.approx")} <span className="font-semibold">{formatRSD(price * hours)}</span>
                </span>
              )}
            </div>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder={isOwner ? t("venueBooking.whoIsItForE") : t("venueBooking.noteForTheOwnerOptional")}
              className="w-full border p-3 rounded-xl bg-white"
            />

            <button
              type="submit"
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl font-semibold"
            >
              {saving ? t("common.sending") : isOwner ? t("venueBooking.markAsTaken") : t("venueBooking.sendRequest")}
            </button>
          </form>
        ) : (
          <p className="text-gray-600">
            <Link to="/login" className="text-green-700 font-semibold hover:underline">
              {t("common.signIn")}
            </Link>{" "}
            {t("venueBooking.toSendABookingRequest")}
          </p>
        )
      )}
    </div>
  );
}

export default VenueBooking;
