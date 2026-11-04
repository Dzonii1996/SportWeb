import { Link } from "react-router-dom";
import { MapPin, Wallet, CalendarDays } from "lucide-react";
import { formatDistance } from "../utils/geo";
import { formatRSD } from "../utils/price";
import { sportIcons, indoorLabel, imageUrl } from "../utils/venues";
import { RatingBadge } from "./Stars";
import { useTranslation } from "react-i18next";
import { surfaceLabel } from "../i18n";

// Kartica terena na listi; izgled prati MatchCard
function VenueCard({ venue, distance = null }) {
  const { t } = useTranslation();

  return (
    <Link
      to={`/tereni/${venue.id}`}
      className="flex flex-col rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-lg transition overflow-hidden"
    >
      {/* Zaglavlje: naslovna slika ili gradijent */}
      <div className="relative h-36 bg-gradient-to-br from-green-600 to-emerald-500 text-white">
        {venue.cover_image && (
          <img
            src={imageUrl(venue.cover_image)}
            alt={venue.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        {venue.rating_count > 0 && (
          <RatingBadge
            avg={venue.rating_avg}
            count={venue.rating_count}
            className="absolute top-3 right-3 text-xs bg-white/90 text-gray-800 px-2 py-0.5 rounded-full"
          />
        )}

        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <span className="text-xs font-semibold bg-white/90 text-gray-800 px-2 py-0.5 rounded-full">
            {indoorLabel(venue.indoor)}
          </span>

          {venue.surface && (
            <span className="text-xs font-semibold bg-white/90 text-gray-800 px-2 py-0.5 rounded-full">
              {surfaceLabel(venue.surface)}
            </span>
          )}
        </div>

        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
          <h2 className="text-xl font-bold leading-tight drop-shadow">{venue.name}</h2>
          <span className="text-2xl shrink-0">{sportIcons(venue.sports)}</span>
        </div>
      </div>

      <div className="flex flex-col flex-1 p-5 gap-2.5 text-gray-700">
        <div className="flex items-center gap-3">
          <MapPin className="text-green-600 shrink-0" size={18} />
          <span className="truncate">{venue.address}</span>

          {distance !== null && (
            <span className="ml-auto text-xs bg-green-50 text-green-700 font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
              {formatDistance(distance)}
            </span>
          )}
        </div>

        {venue.price_per_hour !== null && venue.price_per_hour !== undefined && (
          <div className="flex items-center gap-3">
            <Wallet className="text-green-600 shrink-0" size={18} />
            <span>
              {t("common.about")} <span className="font-semibold">{formatRSD(venue.price_per_hour)}</span> {t("common.perHour")}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <CalendarDays className="text-green-600 shrink-0" size={18} />
          <span>
            {venue.upcoming_matches > 0
              ? t("venueCard.upcomingGames", { upcoming_matches: venue.upcoming_matches })
              : t("venueCard.noGamesScheduled")}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default VenueCard;
