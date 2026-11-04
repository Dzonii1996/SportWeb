import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  MapPin,
  Wallet,
  Clock,
  Phone,
  Layers,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react";
import MatchCard from "../components/MatchCard";
import VenueReviews from "../components/VenueReviews";
import VenueBooking from "../components/VenueBooking";
import ReservationSettings from "../components/ReservationSettings";
import { RatingBadge } from "../components/Stars";
import { LocationView } from "../components/LocationMap";
import { API_URL } from "../config";
import { authHeader } from "../utils/auth";
import { formatRSD } from "../utils/price";
import { isPastMatch } from "../utils/matchDate";
import {
  sportIcons,
  indoorLabel,
  imageUrl,
  approveVenue,
  rejectVenue,
} from "../utils/venues";
import { useTranslation } from "react-i18next";
import i18n, { sportLabel, surfaceLabel } from "../i18n";

const STATUS_BANNERS = {
  pending: {
    className: "bg-amber-50 border-amber-300 text-amber-900",
    get text() { return i18n.t("venueDetails.thisSuggestionIsAwaitingAdmin"); },
  },
  rejected: {
    className: "bg-red-50 border-red-300 text-red-900",
    get text() { return i18n.t("venueDetails.theSuggestionWasNotApproved"); },
  },
};

function VenueDetails() {
  const { t } = useTranslation();

  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  const load = useCallback(() => {
    fetch(`${API_URL}/api/venues/${id}`, { headers: authHeader() })
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setData(result);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Korisnik traži vlasništvo; poruka pomaže adminu da ga proveri
  const claimVenue = async () => {
    const message = window.prompt(
      t("venueDetails.howCanTheAdminVerify"),
      ""
    );

    if (message === null) return;

    const res = await fetch(`${API_URL}/api/venues/${id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ message }),
    });
    const result = await res.json();

    alert(result.message);
    load();
  };

  const removeOwner = async () => {
    if (!window.confirm(t("venueDetails.removeTheOwnerBookingsAre"))) {
      return;
    }

    const res = await fetch(`${API_URL}/api/venues/${id}/owner`, {
      method: "DELETE",
      headers: authHeader(),
    });
    const result = await res.json();

    alert(result.message);
    load();
  };

  const deleteVenue = async () => {
    if (!window.confirm(t("venueDetails.deleteTheVenueGamesThere"))) {
      return;
    }

    const res = await fetch(`${API_URL}/api/venues/${id}`, {
      method: "DELETE",
      headers: authHeader(),
    });
    const result = await res.json();

    alert(result.message);

    if (result.success) navigate("/tereni");
  };

  if (notFound) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center mt-10">
        <p className="text-xl mb-4">{t("venueDetails.thisVenueDoesntExist")}</p>
        <Link to="/tereni" className="text-green-700 font-semibold hover:underline">
          {t("venueDetails.allVenues")}
        </Link>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center mt-20 text-xl">{t("common.loading")}</div>;
  }

  const {
    venue,
    images,
    matches,
    can_edit: canEdit,
    is_admin: isAdmin,
    is_owner: isOwner,
    my_claim: myClaim,
  } = data;
  const banner = STATUS_BANNERS[venue.status];
  const loggedIn = Boolean(localStorage.getItem("token"));

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-5xl mx-auto p-6 space-y-6">

        <Link to="/tereni" className="inline-flex items-center gap-1.5 text-gray-600 hover:text-gray-900">
          <ArrowLeft size={18} />
          {t("common.allVenues")}
        </Link>

        {banner && (
          <div className={`border rounded-2xl p-4 ${banner.className}`}>
            <p className="font-medium">{banner.text}</p>
            {venue.status === "rejected" && venue.rejection_reason && (
              <p className="mt-1">{t("common.reason", { rejection_reason: venue.rejection_reason })}</p>
            )}

            {isAdmin && venue.status !== "approved" && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => approveVenue(venue.id).then(load)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-semibold"
                >
                  {t("common.approve")}
                </button>
                {venue.status === "pending" && (
                  <button
                    onClick={() => rejectVenue(venue.id).then(load)}
                    className="border border-red-300 text-red-700 px-4 py-2 rounded-xl font-semibold hover:bg-red-100"
                  >
                    {t("common.reject")}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Zaglavlje */}
          <div className="p-6 text-white bg-gradient-to-br from-green-600 to-emerald-500">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-xl bg-white/20 flex items-center justify-center text-2xl">
                  {sportIcons(venue.sports)}
                </span>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold leading-tight break-words">{venue.name}</h1>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <span className="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">
                      {venue.sports.map(sportLabel).join(" · ")}
                    </span>
                    <span className="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">
                      {indoorLabel(venue.indoor)}
                    </span>
                    <RatingBadge
                      avg={venue.rating_avg}
                      count={venue.rating_count}
                      className="text-xs bg-white/20 px-2 py-0.5 rounded-full"
                    />
                  </div>
                </div>
              </div>

              {canEdit && (
                <div className="flex gap-1.5">
                  <Link
                    to={`/tereni/${venue.id}/izmeni`}
                    title={t("common.editVenue")}
                    aria-label={t("common.editVenue")}
                    className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/35 flex items-center justify-center transition"
                  >
                    <Pencil size={16} />
                  </Link>
                  {isAdmin && (
                    <button
                      onClick={deleteVenue}
                      title={t("venueDetails.deleteVenue")}
                      aria-label={t("venueDetails.deleteVenue")}
                      className="w-9 h-9 rounded-full bg-white/20 hover:bg-red-500 flex items-center justify-center transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Slike */}
          {images.length > 0 && (
            <div className="p-4 pb-0">
              <img
                src={imageUrl(images[Math.min(activeImage, images.length - 1)].path)}
                alt={venue.name}
                className="w-full h-64 md:h-96 object-cover rounded-xl"
              />

              {images.length > 1 && (
                <div className="flex gap-2 mt-2 overflow-x-auto">
                  {images.map((img, i) => (
                    <button
                      key={img.id}
                      onClick={() => setActiveImage(i)}
                      className={`shrink-0 rounded-lg overflow-hidden border-2 ${
                        i === activeImage ? "border-green-600" : "border-transparent"
                      }`}
                    >
                      <img src={imageUrl(img.path)} alt="" className="w-20 h-14 object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="p-6 grid md:grid-cols-2 gap-6">
            <div className="space-y-3 text-gray-700">
              <div className="flex items-start gap-3">
                <MapPin className="text-green-600 shrink-0 mt-0.5" size={18} />
                <span>{venue.address}</span>
              </div>

              {venue.surface && (
                <div className="flex items-center gap-3">
                  <Layers className="text-green-600 shrink-0" size={18} />
                  <span>{t("venueDetails.surface", { surface: surfaceLabel(venue.surface) })}</span>
                </div>
              )}

              {venue.price_per_hour !== null && (
                <div className="flex items-center gap-3">
                  <Wallet className="text-green-600 shrink-0" size={18} />
                  <span>
                    {t("common.about")} <span className="font-semibold">{formatRSD(venue.price_per_hour)}</span> {t("common.perHour")}
                  </span>
                </div>
              )}

              {venue.working_hours && (
                <div className="flex items-start gap-3">
                  <Clock className="text-green-600 shrink-0 mt-0.5" size={18} />
                  <span>{venue.working_hours}</span>
                </div>
              )}

              {venue.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="text-green-600 shrink-0" size={18} />
                  <a href={`tel:${venue.phone.replace(/[^0-9+]/g, "")}`} className="text-green-700 hover:underline">
                    {venue.phone}
                  </a>
                </div>
              )}

              {venue.description && (
                <p className="whitespace-pre-line pt-2 border-t">{venue.description}</p>
              )}

              {isAdmin && venue.suggested_by_name && (
                <p className="text-sm text-gray-500">{t("venueDetails.suggestedBy", { suggested_by_name: venue.suggested_by_name })}</p>
              )}
            </div>

            <LocationView latitude={venue.latitude} longitude={venue.longitude} />
          </div>
        </div>

        {/* Vlasništvo */}
        {venue.status === "approved" && (
          <>
            {isOwner && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                {t("venueDetails.youOwnThisVenueYou")}{" "}
                <Link to="/rezervacije" className="text-green-700 font-semibold hover:underline">
                  {t("common.bookings")}
                </Link>
                .
              </div>
            )}

            {isAdmin && venue.owner_id && !isOwner && (
              <div className="bg-white border rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <span>{t("venueDetails.owner")} <span className="font-semibold">{venue.owner_name}</span></span>
                <button onClick={removeOwner} className="text-red-600 font-semibold hover:underline">
                  {t("venueDetails.removeOwner")}
                </button>
              </div>
            )}

            {!venue.owner_id && loggedIn && (
              <div className="bg-white border rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-gray-700">
                  {myClaim === "pending"
                    ? t("venueDetails.theOwnershipRequestWasSent")
                    : t("venueDetails.doYouOwnThisVenue")}
                </span>
                {myClaim !== "pending" && (
                  <button
                    onClick={claimVenue}
                    className="px-4 py-2 rounded-xl border border-green-600 text-green-700 font-semibold hover:bg-green-50"
                  >
                    {t("venueDetails.imTheOwner")}
                  </button>
                )}
              </div>
            )}

            {canEdit && <ReservationSettings key={`settings-${venue.updated_at}`} venue={venue} onSaved={load} />}

            {venue.accepts_reservations && venue.owner_id && (
              <VenueBooking key={`booking-${venue.updated_at}`} venue={venue} isOwner={isOwner} />
            )}
          </>
        )}

        {venue.status === "approved" && <VenueReviews venueId={venue.id} onChange={load} />}

        {/* Termini na terenu */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-2xl font-bold">{t("venueDetails.upcomingGames")}</h2>

            {venue.status === "approved" && (
              <Link
                to={loggedIn ? `/create-match?venue=${venue.id}` : "/login"}
                className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-full font-semibold shadow-sm"
              >
                <Plus size={18} />
                {t("venueDetails.createAGameHere")}
              </Link>
            )}
          </div>

          {matches.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-6">
              {matches.map((match) => (
                <MatchCard
                  key={match.id}
                  id={match.id}
                  creatorId={match.user_id}
                  creatorAvatar={match.creator_avatar}
                  creatorName={match.creator_name}
                  sport={match.sport}
                  location={match.location}
                  date={match.match_date}
                  time={match.match_time}
                  players={Number(match.players || 0)}
                  maxPlayers={match.max_players}
                  isPast={isPastMatch(match.match_date, match.match_time)}
                  repeatWeekly={match.repeat_weekly}
                  fieldPrice={match.field_price}
                />
              ))}
            </div>
          ) : (
            <p className="text-gray-600 bg-white rounded-2xl border p-6 text-center">
              {t("venueDetails.noGamesScheduledAtThis")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default VenueDetails;
