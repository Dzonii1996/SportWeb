import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, MapPin, Plus, Users, Wallet } from "lucide-react";
import { API_URL } from "../config";
import { formatRSD } from "../utils/price";
import { useAdminStatus } from "../utils/venues";
import { FORMATS, STATUS, formatDate, sportIcon } from "../utils/tournaments";
import { sportFilters } from "../utils/sports";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";

const SPORTS = sportFilters("");

const STATUSES = [
  { value: "", get label() { return i18n.t("common.allTournaments"); } },
  { value: "registration", get label() { return i18n.t("common.registrationOpen"); } },
  { value: "in_progress", get label() { return i18n.t("common.inProgress"); } },
  { value: "finished", get label() { return i18n.t("tournaments.finished"); } },
];

const pill = (active) =>
  `pill ${
    active ? "bg-green-600 text-white" : "bg-gray-200 hover:bg-gray-300"
  }`;

function TournamentCard({ tournament: t }) {
  const { t: tr } = useTranslation();

  const status = STATUS[t.status];

  return (
    <Link
      to={`/turniri/${t.id}`}
      className="flex flex-col rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-lg transition overflow-hidden"
    >
      <div className="p-5 text-white bg-gradient-to-br from-green-600 to-emerald-500">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 shrink-0 rounded-xl bg-white/20 flex items-center justify-center text-2xl">
            {sportIcon(t.sport)}
          </span>

          <div className="min-w-0">
            <h2 className="text-xl font-bold leading-tight break-words">{t.name}</h2>
            <p className="text-sm text-white/90">{FORMATS[t.format].label}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-1 p-5 gap-2.5 text-gray-700">
        <span className={`self-start text-xs font-semibold px-2 py-0.5 rounded-full ${status.className}`}>
          {status.label}
        </span>

        {t.winner_name && <p className="font-semibold">🏆 {t.winner_name}</p>}

        <div className="flex items-center gap-3">
          <Calendar className="text-green-600 shrink-0" size={18} />
          <span className="capitalize">{formatDate(t.start_date)}</span>
        </div>

        <div className="flex items-center gap-3">
          <MapPin className="text-green-600 shrink-0" size={18} />
          <span className="truncate">{t.location}</span>
        </div>

        <div className="flex items-center gap-3">
          <Users className="text-green-600 shrink-0" size={18} />
          <span>{tr("tournaments.teams", { teams_count: t.teams_count, max_teams: t.max_teams })}</span>
        </div>

        {t.entry_fee !== null && (
          <div className="flex items-center gap-3">
            <Wallet className="text-green-600 shrink-0" size={18} />
            <span>{tr("tournaments.entryFee", { amount: formatRSD(t.entry_fee) })}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

function Tournaments() {
  const { t } = useTranslation();

  const { isAdmin, ownedVenues } = useAdminStatus();

  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sport, setSport] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();

    if (sport) params.set("sport", sport);
    if (status) params.set("status", status);

    setLoading(true);

    fetch(`${API_URL}/api/tournaments?${params}`)
      .then((res) => res.json())
      .then((data) => setTournaments(data.tournaments || []))
      .catch((error) => console.error(error))
      .finally(() => setLoading(false));
  }, [sport, status]);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold">{t("common.tournaments")}</h1>
            <p className="hidden sm:block text-gray-600 mt-1">
              {t("tournaments.registerATeamAndFollow")}
            </p>
          </div>

          {(isAdmin || ownedVenues > 0) && (
            <Link
              to="/turniri/novi"
              className="pill inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white shadow-sm"
            >
              <Plus size={18} />
              {t("common.createATournament")}
            </Link>
          )}
        </div>

        <div className="bg-white shadow rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-6 gap-y-3">
          <div className="pill-row">
            {SPORTS.map((s) => (
              <button key={s.value} onClick={() => setSport(s.value)} className={pill(sport === s.value)}>
                {s.label}
              </button>
            ))}
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border p-2.5 rounded-xl"
            aria-label={t("tournaments.tournamentStatus")}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {tournaments.map((t) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}

          {!loading && tournaments.length === 0 && (
            <p className="col-span-full text-center text-gray-600 text-xl py-10">
              {t("tournaments.noTournamentsMatchTheSelected")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Tournaments;
