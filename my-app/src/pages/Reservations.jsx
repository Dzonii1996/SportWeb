import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Clock, Plus } from "lucide-react";
import { API_URL } from "../config";
import { authHeader } from "../utils/auth";
import { formatRSD } from "../utils/price";
import { useAdminStatus } from "../utils/venues";
import {
  STATUS,
  ACTIVE,
  hourLabel,
  reservationStart,
  formatReservationDate,
  createMatchUrl,
  reservationAction,
} from "../utils/reservations";
import { useTranslation } from "react-i18next";

// Kartica jedne rezervacije; "children" su dugmad za akcije
function ReservationCard({ reservation: r, showUser = false, children }) {
  const { t } = useTranslation();

  const status = STATUS[r.status];
  const hours = r.end_hour - r.start_hour;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col sm:flex-row gap-4">
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/tereni/${r.venue_id}`} className="text-lg font-bold hover:text-green-700">
            {r.venue_name}
          </Link>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${status.className}`}>
            {status.label}
          </span>
        </div>

        <p className="flex items-center gap-2 text-gray-700">
          <Clock size={16} className="text-green-600 shrink-0" />
          <span className="capitalize">{formatReservationDate(r.reservation_date)}</span>
          <span className="font-semibold">
            {hourLabel(r.start_hour)}–{hourLabel(r.end_hour)}
          </span>
          {r.price_per_hour !== null && (
            <span className="text-gray-500">{t("reservations.approx", { amount: formatRSD(r.price_per_hour * hours) })}</span>
          )}
        </p>

        {!showUser && (
          <p className="flex items-center gap-2 text-gray-600 text-sm">
            <MapPin size={16} className="text-green-600 shrink-0" />
            {r.venue_address}
          </p>
        )}

        {showUser && (
          <p className="text-gray-700">
            <Link to={`/users/${r.user_id}`} className="font-semibold hover:text-green-700">
              {r.user_name}
            </Link>{" "}
            <a href={`mailto:${r.user_email}`} className="text-gray-500 text-sm hover:underline">
              {r.user_email}
            </a>
          </p>
        )}

        {showUser && r.match_max_players !== null && r.match_max_players !== undefined && (
          <p className="text-gray-700 text-sm">
            {t("reservations.gameOnSportwebOfPlayers", { match_players: r.match_players, match_max_players: r.match_max_players })}
          </p>
        )}

        {r.note && <p className="text-gray-700 text-sm">📝 {r.note}</p>}
        {r.owner_note && <p className="text-gray-700 text-sm">{t("reservations.owner", { owner_note: r.owner_note })}</p>}
      </div>

      {children && <div className="flex sm:flex-col gap-2 shrink-0">{children}</div>}
    </div>
  );
}

const button = "px-4 py-2 rounded-xl font-semibold text-center whitespace-nowrap";

function Reservations() {
  const { t } = useTranslation();

  const { ownedVenues, loaded } = useAdminStatus();
  const [tab, setTab] = useState("mine");
  const [mine, setMine] = useState([]);
  const [owner, setOwner] = useState([]);

  // Vraća rezervacije na mojim terenima (za izbor početnog taba)
  const load = useCallback(() => {
    fetch(`${API_URL}/api/reservations/mine`, { headers: authHeader() })
      .then((res) => res.json())
      .then((data) => setMine(data.reservations || []))
      .catch((error) => console.error(error));

    return fetch(`${API_URL}/api/reservations/owner`, { headers: authHeader() })
      .then((res) => res.json())
      .then((data) => {
        setOwner(data.reservations || []);
        return data.reservations || [];
      })
      .catch((error) => {
        console.error(error);
        return [];
      });
  }, []);

  // Vlasnik sa novim zahtevima odmah vidi svoj tab
  useEffect(() => {
    load().then((list) => {
      if (list.some((r) => r.status === "pending")) setTab("owner");
    });
  }, [load]);

  const pendingForOwner = owner.filter((r) => r.status === "pending");

  const act = async (r, name, ask) => {
    let reason;

    if (ask) {
      reason = window.prompt(ask, "");
      if (reason === null) return;
    } else if (name === "cancel" && !window.confirm(t("reservations.cancelTheBooking"))) {
      return;
    }

    if (await reservationAction(r.id, name, reason)) load();
  };

  const now = new Date();
  const upcoming = mine.filter((r) => reservationStart(r) > now);
  const past = mine.filter((r) => reservationStart(r) <= now);
  const confirmedForOwner = owner.filter((r) => r.status === "confirmed");
  const isOwner = loaded && ownedVenues > 0;

  const tabClass = (value) =>
    `px-4 py-2 rounded-full font-semibold transition ${
      tab === value ? "bg-green-600 text-white" : "bg-gray-200 hover:bg-gray-300"
    }`;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold">{t("common.bookings")}</h1>
          <Link to="/tereni" className="text-green-700 font-semibold hover:underline">
            {t("reservations.venuesThatTakeBookings")}
          </Link>
        </div>

        {isOwner && (
          <div className="flex gap-2">
            <button onClick={() => setTab("mine")} className={tabClass("mine")}>
              {t("reservations.myBookings")}
            </button>
            <button onClick={() => setTab("owner")} className={tabClass("owner")}>
              {t("reservations.atMyVenues")}
              {pendingForOwner.length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {pendingForOwner.length}
                </span>
              )}
            </button>
          </div>
        )}

        {tab === "mine" || !isOwner ? (
          <>
            {upcoming.length === 0 && (
              <p className="text-gray-600 bg-white rounded-2xl border p-6 text-center">
                {t("reservations.youHaveNoUpcomingBookings")}
              </p>
            )}

            <div className="space-y-4">
              {upcoming.map((r) => (
                <ReservationCard key={r.id} reservation={r}>
                  {r.match_id ? (
                    <Link
                      to={`/matches/${r.match_id}`}
                      className={`${button} border border-green-600 text-green-700 hover:bg-green-50`}
                    >
                      {t("reservations.openGame")}
                    </Link>
                  ) : ACTIVE.includes(r.status) && (
                    <Link to={createMatchUrl(r)} className={`${button} bg-green-600 hover:bg-green-700 text-white inline-flex items-center gap-1.5 justify-center`}>
                      <Plus size={16} />
                      {t("reservations.createGame")}
                    </Link>
                  )}
                  {ACTIVE.includes(r.status) && (
                    <button
                      onClick={() => act(r, "cancel")}
                      className={`${button} border border-red-300 text-red-700 hover:bg-red-50`}
                    >
                      {t("common.cancel")}
                    </button>
                  )}
                </ReservationCard>
              ))}
            </div>

            {past.length > 0 && (
              <>
                <h2 className="text-xl font-bold pt-4">{t("reservations.past")}</h2>
                <div className="space-y-4 opacity-75">
                  {past.map((r) => (
                    <ReservationCard key={r.id} reservation={r} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold">{t("reservations.pendingRequests")}</h2>
            {pendingForOwner.length === 0 ? (
              <p className="text-gray-600 bg-white rounded-2xl border p-6 text-center">
                {t("reservations.noNewRequests")}
              </p>
            ) : (
              <div className="space-y-4">
                {pendingForOwner.map((r) => (
                  <ReservationCard key={r.id} reservation={r} showUser>
                    <button
                      onClick={() => act(r, "confirm")}
                      className={`${button} bg-green-600 hover:bg-green-700 text-white`}
                    >
                      {t("common.confirm")}
                    </button>
                    <button
                      onClick={() => act(r, "reject", t("reservations.messageForTheUserOptional"))}
                      className={`${button} border border-red-300 text-red-700 hover:bg-red-50`}
                    >
                      {t("common.reject")}
                    </button>
                  </ReservationCard>
                ))}
              </div>
            )}

            <h2 className="text-xl font-bold pt-4">{t("reservations.confirmed")}</h2>
            {confirmedForOwner.length === 0 ? (
              <p className="text-gray-600 bg-white rounded-2xl border p-6 text-center">
                {t("reservations.noConfirmedUpcomingBookings")}
              </p>
            ) : (
              <div className="space-y-4">
                {confirmedForOwner.map((r) => (
                  <ReservationCard key={r.id} reservation={r} showUser>
                    {reservationStart(r) > now && (
                      <button
                        onClick={() => act(r, "cancel", t("reservations.reasonForCancellingTheUser"))}
                        className={`${button} border border-red-300 text-red-700 hover:bg-red-50`}
                      >
                        {t("common.cancel")}
                      </button>
                    )}
                  </ReservationCard>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Reservations;
