import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Megaphone, Calendar, MapPin, Users, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { API_URL } from "../config";
import { sportLabel } from "../i18n";
import { sportColors } from "../utils/sports";
import { formatDate, sportIcon } from "../utils/tournaments";
import { LogoBadge } from "./TournamentLogo";

// Turniri koji se najavljuju na početnoj: otvorene prijave i oni u toku
const ANNOUNCED = ["registration", "in_progress"];
const MAX_SHOWN = 2;

// Obaveštenje na početnoj o turnirima na koje može da se prijavi ili koji su u toku.
// Bez takvih turnira ništa se ne prikazuje.
function TournamentAnnouncement() {
  const { t } = useTranslation();
  const [tournaments, setTournaments] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/api/tournaments`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) return;

        setTournaments(
          data.tournaments
            .filter((tr) => ANNOUNCED.includes(tr.status))
            .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
            .slice(0, MAX_SHOWN)
        );
      })
      .catch(() => {});
  }, []);

  if (tournaments.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 space-y-4">
      {tournaments.map((tr) => {
        const colors = sportColors(tr.sport);
        const open = tr.status === "registration";

        return (
          <Link
            key={tr.id}
            to={`/turniri/${tr.id}`}
            className={`group block rounded-2xl text-white bg-gradient-to-br ${colors.header} shadow-lg hover:shadow-xl transition overflow-hidden`}
          >
            <div className="p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-5">
              {tr.logo_path ? (
                <LogoBadge path={tr.logo_path} alt={tr.name} className="w-16 h-16 sm:w-20 sm:h-20" />
              ) : (
                <span className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-xl bg-white/20 flex items-center justify-center text-4xl">
                  {sportIcon(tr.sport)}
                </span>
              )}

              <div className="flex-1 min-w-0">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide bg-white/20 rounded-full px-3 py-1">
                  <Megaphone size={14} />
                  {t("home.announcement")}
                </span>

                <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold leading-tight break-words">
                  {tr.name}
                </h2>

                <p className="mt-1 text-white/90 font-medium">
                  {sportIcon(tr.sport)} {sportLabel(tr.sport)} ·{" "}
                  {open ? t("home.tournamentRegistrationOpen") : t("home.tournamentInProgress")}
                </p>

                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-white/90">
                  <span className="flex items-center gap-1.5 capitalize">
                    <Calendar size={16} /> {formatDate(tr.start_date)}
                  </span>
                  <span className="flex items-center gap-1.5 min-w-0">
                    <MapPin size={16} className="shrink-0" /> <span className="truncate">{tr.location}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users size={16} /> {t("tournaments.teams", { teams_count: tr.teams_count, max_teams: tr.max_teams })}
                  </span>
                </div>
              </div>

              <span className="self-start sm:self-center inline-flex items-center gap-2 bg-white text-gray-900 font-semibold px-5 py-3 rounded-xl shadow-sm group-hover:gap-3 transition-all">
                {open ? t("home.registerYourTeam") : t("home.followTheTournament")}
                <ArrowRight size={18} />
              </span>
            </div>
          </Link>
        );
      })}
    </section>
  );
}

export default TournamentAnnouncement;
