import {
  MapPin,
  Calendar,
  Users,
  Pencil,
  Trash2,
  MessageCircle,
  Wallet,
  Mountain,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authHeader } from "../utils/auth";
import { API_URL } from "../config";
import { formatDistance } from "../utils/geo";
import { sportEmoji } from "../utils/sports";
import { difficultyLabel } from "../utils/hike";
import { formatRSD, pricePerPlayer } from "../utils/price";
import { matchStart, inConfirmWindow } from "../utils/matchDate";
import { useTranslation } from "react-i18next";
import { locale, sportLabel } from "../i18n";


function MatchCard({
  id,
  creatorId,
  creatorAvatar,
  creatorName,

  sport,
  location,
  date,
  time,
  players,
  maxPlayers,
  isPast = false,
  distance = null,
  repeatWeekly = false,
  fieldPrice = null,
  scoreA = null,
  scoreB = null,
  isPrivate = false,
  hike = null,
}) {
  const { t } = useTranslation();

  const [showPlayers, setShowPlayers] = useState(false);
  const [playersList, setPlayersList] = useState([]);
  const [joined, setJoined] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const isCreator = JSON.parse(localStorage.getItem("user"))?.id === creatorId;
  const percentage = Math.min(100, (players / maxPlayers) * 100);
  const freeSpots = Math.max(0, maxPlayers - players);
  const isFull = freeSpots === 0;
  // Odigran ili pun termin prikazujemo prigušeno
  const inactive = isFull || isPast;

  // "uto, 10. 11. • 20:30" (sr-Latn: bez toga Chrome piše dane ćirilicom)
  const formattedDate = matchStart(date, time).toLocaleDateString(locale(), {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  });

  useEffect(() => {
    const checkJoined = async () => {
      const user = JSON.parse(localStorage.getItem("user"));

      if (!user) return;

      try {
        const res = await fetch(
          `${API_URL}/api/matches/${id}/players`
        );

        const data = await res.json();

        const me = data.players.find(
          (player) => player.id === user.id
        );

        setJoined(Boolean(me));
        setConfirmed(Boolean(me?.confirmed));

      } catch (error) {
        console.error(error);
      }
    };

    if (id) {
      checkJoined();
    }
  }, [id]);

  const joinMatch = async () => {
    const user = JSON.parse(localStorage.getItem("user"));

    if (!user) {
      alert(t("matchCard.youMustBeSignedIn"));
      return;
    }

    try {
      const res = await fetch(
        `${API_URL}/api/matches/${id}/join`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader(),
          },
        }
      );

      const data = await res.json();

      alert(data.message);

      if (data.success) {
        setJoined(true);
        window.location.reload();
      }

    } catch (error) {
      console.error(error);
    }
  };

  const leaveMatch = async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/matches/${id}/leave`,
        {
          method: "DELETE",
          headers: authHeader(),
        }
      );

      const data = await res.json();

      alert(data.message);

      if (data.success) {
        setJoined(false);
        window.location.reload();
      }

    } catch (error) {
      console.error(error);
    }
  };

  const deleteMatch = async () => {
    const confirmDelete = window.confirm(
      t("matchCard.areYouSureYouWant")
    );

    if (!confirmDelete) return;

    try {
      const res = await fetch(
        `${API_URL}/api/matches/${id}`,
        {
          method: "DELETE",
          headers: authHeader(),
        }
      );

      const data = await res.json();

      alert(data.message);

      if (data.success) {
        window.location.reload();
      }

    } catch (error) {
      console.error(error);
    }
  };

  const getPlayers = async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/matches/${id}/players`
      );

      const data = await res.json();

      setPlayersList(data.players || []);
      setShowPlayers(true);

    } catch (error) {
      console.error(error);
    }
  };

  // Glavno dugme: prijava, napuštanje ili lista čekanja
  const primaryAction = () => {
    const base = "flex items-center justify-center w-full py-3 rounded-xl font-semibold transition";

    if (isPast) {
      return (
        <div className={`${base} bg-gray-100 text-gray-500`}>
          {t("common.gameHasBeenPlayed")}
        </div>
      );
    }

    if (joined) {
      return (
        <button
          onClick={leaveMatch}
          className={`${base} border-2 border-red-200 text-red-600 hover:bg-green-600 hover:border-green-600 hover:text-white`}
        >
          {t("common.leaveGame")}
        </button>
      );
    }

    if (isFull) {
      // Pun termin: lista čekanja je na stranici termina
      return (
        <Link
          to={`/matches/${id}`}
          className={`${base} bg-orange-500 hover:bg-orange-600 text-white shadow-sm`}
        >
          {t("matchCard.fullWaitlist")}
        </Link>
      );
    }

    return (
      <button
        onClick={joinMatch}
        className={`${base} bg-green-600 hover:bg-green-700 text-white shadow-sm`}
      >
        {t("common.join")}
      </button>
    );
  };

  const secondary =
    "flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 transition";

  return (
    <div
      className={`flex flex-col rounded-2xl border shadow-sm hover:shadow-lg transition overflow-hidden ${
        inactive ? "bg-gray-50 border-gray-200" : "bg-white border-gray-100"
      }`}
    >
      {/* Zaglavlje */}
      <div
        className={`relative p-5 text-white ${
          isPast
            ? "bg-gray-400"
            : isFull
            ? "bg-gradient-to-br from-gray-500 to-gray-600"
            : "bg-gradient-to-br from-green-600 to-emerald-500"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl">
              {sportEmoji(sport)}
            </span>

            <div>
              <h2 className="text-xl font-bold leading-tight">{sportLabel(sport)}</h2>

              <div className="flex flex-wrap gap-1.5 mt-1">
                {isPrivate && (
                  <span className="text-xs font-semibold bg-black/20 px-2 py-0.5 rounded-full">
                    {t("matchCard.private")}
                  </span>
                )}

                {repeatWeekly && (
                  <span className="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">
                    {t("matchCard.weekly")}
                  </span>
                )}

                {isPast ? (
                  <span className="text-xs font-bold bg-black/20 px-2 py-0.5 rounded-full">
                    {scoreA !== null && scoreA !== undefined
                      ? `🏆 ${scoreA} : ${scoreB}`
                      : t("common.played")}
                  </span>
                ) : isFull ? (
                  <span className="text-xs font-bold bg-red-500 px-2 py-0.5 rounded-full">
                    {t("common.full")}
                  </span>
                ) : (
                  <span className="text-xs font-bold bg-white text-green-700 px-2 py-0.5 rounded-full">
                    {t("matchCard.spots", { count: freeSpots })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Kreator: izmena i brisanje kao male ikonice */}
          {isCreator && (
            <div className="flex gap-1.5">
              <Link
                to={`/matches/${id}/edit`}
                title={t("common.editGame")}
                aria-label={t("common.editGame")}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/35 flex items-center justify-center transition"
              >
                <Pencil size={16} />
              </Link>

              <button
                onClick={deleteMatch}
                title={t("common.deleteGame")}
                aria-label={t("common.deleteGame")}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-red-500 flex items-center justify-center transition"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>

        <Link
          to={`/users/${creatorId}`}
          className="inline-flex items-center gap-2 mt-4 text-sm hover:opacity-80 transition"
        >
          {creatorAvatar ? (
            <img
              src={`${API_URL}${creatorAvatar}`}
              alt={creatorName}
              className="w-7 h-7 rounded-full object-cover border-2 border-white/70"
            />
          ) : (
            <span className="w-7 h-7 rounded-full bg-white text-green-700 flex items-center justify-center font-bold text-xs">
              {creatorName?.charAt(0).toUpperCase()}
            </span>
          )}

          {isCreator ? (
            <span className="font-semibold">{t("common.yourGame")}</span>
          ) : (
            <>
              <span className="text-white/80">{t("common.organizer")}</span>
              <span className="font-semibold">
                {creatorName || t("matchCard.unknownUser")}
              </span>
            </>
          )}
        </Link>
      </div>

      {/* Detalji */}
      <div className="flex flex-col flex-1 p-5 gap-4">

        <div className="space-y-2.5 text-gray-700">
          <div className="flex items-center gap-3">
            <MapPin className="text-green-600 shrink-0" size={18} />
            <span className="truncate">{location}</span>

            {distance !== null && (
              <span className="ml-auto text-xs bg-green-50 text-green-700 font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                {formatDistance(distance)}
              </span>
            )}
          </div>

          {hike && (
            <div className="flex items-center gap-3">
              <Mountain className="text-green-600 shrink-0" size={18} />
              <span className="truncate">{hike.route}</span>
              <span className="ml-auto text-xs bg-green-50 text-green-700 font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                {difficultyLabel(hike.difficulty)}
              </span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Calendar className="text-green-600 shrink-0" size={18} />
            <span>
              <span className="capitalize">{formattedDate}</span>
              {" • "}
              <span className="font-semibold">{time?.slice(0, 5)}</span>
            </span>
          </div>

          {fieldPrice !== null && fieldPrice !== undefined && (
            <div className="flex items-center gap-3">
              <Wallet className="text-green-600 shrink-0" size={18} />
              <span>
                <span className="font-semibold">
                  {formatRSD(pricePerPlayer(fieldPrice, players))}
                </span>{" "}
                {t("common.perPlayer")}
              </span>
            </div>
          )}
        </div>

        {/* Popunjenost */}
        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="flex items-center gap-1.5 text-gray-600">
              <Users size={15} />
              {t("matchCard.players", { players, maxPlayers })}
            </span>

            {joined && !isPast && (
              <span className="text-green-700 font-semibold">{t("common.youreIn")}</span>
            )}
          </div>

          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-2 rounded-full ${
                isFull ? "bg-orange-400" : percentage >= 75 ? "bg-amber-400" : "bg-green-500"
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Dugmad: glavno + dva sporedna, uvek na dnu kartice */}
        <div className="mt-auto space-y-2">
          {joined && !confirmed && inConfirmWindow(date, time) && (
            <Link
              to={`/matches/${id}`}
              className="block text-center text-sm font-semibold bg-amber-50 border border-amber-300 text-amber-900 rounded-xl py-2 hover:bg-amber-100"
            >
              {t("matchCard.gameIsComingUpConfirm")}
            </Link>
          )}

          {primaryAction()}

          <div className="grid grid-cols-2 gap-2">
            <Link to={`/matches/${id}`} className={secondary}>
              <MessageCircle size={17} />
              {t("matchCard.detailsAndChat")}
            </Link>

            <button onClick={getPlayers} className={secondary}>
              <Users size={17} />
              {t("matchCard.participants")}
            </button>
          </div>
        </div>
      </div>

      {showPlayers && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
          onClick={() => setShowPlayers(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                {t("matchCard.joinedPlayers", { length: playersList.length })}
              </h2>

              <button
                onClick={() => setShowPlayers(false)}
                className="p-1.5 rounded-full hover:bg-gray-100"
                aria-label={t("common.close")}
              >
                <X size={20} />
              </button>
            </div>

            {playersList.length > 0 ? (
              <ul className="divide-y max-h-80 overflow-y-auto">
                {playersList.map((player) => (
                  <li key={player.id}>
                    <Link
                      to={`/users/${player.id}`}
                      className="flex items-center gap-3 py-2.5 hover:text-green-700"
                    >
                      <span className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm">
                        {player.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="font-medium">{player.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">{t("common.noPlayersHaveJoined")}</p>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default MatchCard;
