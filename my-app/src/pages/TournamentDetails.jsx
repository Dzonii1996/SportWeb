import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, MapPin, Pencil, Users, Wallet } from "lucide-react";
import { API_URL } from "../config";
import { authHeader } from "../utils/auth";
import { localDateKey } from "../utils/matchDate";
import { formatRSD } from "../utils/price";
import {
  FORMATS,
  STATUS,
  formatDate,
  groupByRound,
  isBye,
  roundLabel,
  sportIcon,
  tournamentRequest,
} from "../utils/tournaments";

const card = "bg-white rounded-2xl border border-gray-100 shadow-sm p-6";
const primary = "bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-semibold";
const outline = "px-4 py-2 rounded-xl border border-gray-200 font-medium hover:bg-gray-50";
const danger = "px-4 py-2 rounded-xl border border-red-300 text-red-700 font-semibold hover:bg-red-50";
const number = "w-16 border p-2 rounded-lg text-center";

const RESERVATION_LABELS = {
  pending: "⏳ teren čeka potvrdu",
  confirmed: "✅ teren rezervisan",
  rejected: "❌ vlasnik nije prihvatio",
  cancelled: "🚫 rezervacija otkazana",
};

// Tabela lige
function Standings({ rows, sport }) {
  const diffLabel = sport === "Košarka" ? "Koš-razlika" : "Gol-razlika";

  return (
    <div className={card}>
      <h2 className="text-2xl font-bold mb-4">Tabela</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Ekipa</th>
              <th className="py-2 px-2 text-center" title="Odigrano">O</th>
              <th className="py-2 px-2 text-center" title="Pobede">P</th>
              {sport !== "Košarka" && <th className="py-2 px-2 text-center" title="Nerešeno">N</th>}
              <th className="py-2 px-2 text-center" title="Porazi">I</th>
              <th className="py-2 px-2 text-center" title={diffLabel}>+/−</th>
              <th className="py-2 pl-2 text-center">Bod</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.team_id} className="border-b last:border-0">
                <td className="py-2 pr-2 text-gray-500">{i + 1}.</td>
                <td className="py-2 pr-2 font-semibold">{row.name}</td>
                <td className="py-2 px-2 text-center">{row.played}</td>
                <td className="py-2 px-2 text-center">{row.wins}</td>
                {sport !== "Košarka" && <td className="py-2 px-2 text-center">{row.draws}</td>}
                <td className="py-2 px-2 text-center">{row.losses}</td>
                <td className="py-2 px-2 text-center">{row.diff > 0 ? `+${row.diff}` : row.diff}</td>
                <td className="py-2 pl-2 text-center font-bold">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Jedna utakmica; organizator odavde upisuje rezultat i vreme
function GameRow({ game, tournament, canEdit, onChange }) {
  const [mode, setMode] = useState(null);
  const [scoreA, setScoreA] = useState(game.score_a ?? "");
  const [scoreB, setScoreB] = useState(game.score_b ?? "");
  const [penaltiesA, setPenaltiesA] = useState(game.penalties_a ?? "");
  const [penaltiesB, setPenaltiesB] = useState(game.penalties_b ?? "");
  const [date, setDate] = useState(game.game_date ? localDateKey(game.game_date) : "");
  const [time, setTime] = useState(game.game_time?.slice(0, 5) || "");

  const played = game.score_a !== null;
  const bye = isBye(game);
  const ready = game.team_a_id !== null && game.team_b_id !== null;
  const base = `/${tournament.id}/games/${game.id}`;
  // Penali samo u kupu u fudbalu, kad je nerešeno
  const needsPenalties =
    tournament.format === "knockout" &&
    tournament.sport === "Fudbal" &&
    scoreA !== "" &&
    Number(scoreA) === Number(scoreB);

  const saveResult = async (e) => {
    e.preventDefault();

    const ok = await tournamentRequest(`${base}/result`, {
      method: "PUT",
      silent: true,
      body: {
        score_a: Number(scoreA),
        score_b: Number(scoreB),
        penalties_a: needsPenalties ? Number(penaltiesA) : undefined,
        penalties_b: needsPenalties ? Number(penaltiesB) : undefined,
      },
    });

    if (ok) {
      setMode(null);
      onChange();
    }
  };

  const saveSchedule = async (e) => {
    e.preventDefault();

    const ok = await tournamentRequest(`${base}/schedule`, {
      method: "PUT",
      body: { game_date: date, game_time: time },
    });

    if (ok) {
      setMode(null);
      onChange();
    }
  };

  const nameOf = (name) =>
    name || <span className="text-gray-400 font-normal">{bye ? "—" : "čeka se"}</span>;
  const isWinner = (id) => id !== null && Number(game.winner_team_id) === Number(id);

  return (
    <div className="border rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className={`flex-1 min-w-0 text-right break-words ${isWinner(game.team_a_id) ? "font-bold" : "font-medium"}`}>
          {nameOf(game.team_a_name)}
        </span>

        <span className="shrink-0 w-20 text-center font-bold">
          {played ? `${game.score_a} : ${game.score_b}` : bye ? "" : "–"}
        </span>

        <span className={`flex-1 min-w-0 break-words ${isWinner(game.team_b_id) ? "font-bold" : "font-medium"}`}>
          {nameOf(game.team_b_name)}
        </span>
      </div>

      {bye && <p className="text-center text-sm text-gray-500">Slobodan prolaz u sledeće kolo</p>}

      {game.penalties_a !== null && (
        <p className="text-center text-sm text-gray-500">
          Penali {game.penalties_a} : {game.penalties_b}
        </p>
      )}

      {game.game_date && (
        <p className="text-center text-sm text-gray-600">
          <span className="capitalize">{formatDate(game.game_date)}</span> u {game.game_time.slice(0, 5)}
          {game.reservation_status && ` · ${RESERVATION_LABELS[game.reservation_status]}`}
        </p>
      )}

      {canEdit && !bye && (
        <div className="flex flex-wrap justify-center gap-3 text-sm">
          {ready && (
            <button
              onClick={() => setMode(mode === "result" ? null : "result")}
              className="text-green-700 font-semibold hover:underline"
            >
              {played ? "Ispravi rezultat" : "Upiši rezultat"}
            </button>
          )}

          {tournament.status === "in_progress" && (
            <button
              onClick={() => setMode(mode === "schedule" ? null : "schedule")}
              className="text-green-700 font-semibold hover:underline"
            >
              {game.game_date ? "Promeni vreme" : "Odredi vreme"}
            </button>
          )}
        </div>
      )}

      {mode === "result" && (
        <form onSubmit={saveResult} className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <input
            type="number"
            min="0"
            max="999"
            required
            value={scoreA}
            onChange={(e) => setScoreA(e.target.value)}
            className={number}
            aria-label={`Rezultat ${game.team_a_name}`}
          />
          <span className="font-bold">:</span>
          <input
            type="number"
            min="0"
            max="999"
            required
            value={scoreB}
            onChange={(e) => setScoreB(e.target.value)}
            className={number}
            aria-label={`Rezultat ${game.team_b_name}`}
          />

          {needsPenalties && (
            <>
              <span className="text-sm text-gray-600">Penali</span>
              <input
                type="number"
                min="0"
                max="99"
                required
                value={penaltiesA}
                onChange={(e) => setPenaltiesA(e.target.value)}
                className={number}
                aria-label="Penali prve ekipe"
              />
              <span className="font-bold">:</span>
              <input
                type="number"
                min="0"
                max="99"
                required
                value={penaltiesB}
                onChange={(e) => setPenaltiesB(e.target.value)}
                className={number}
                aria-label="Penali druge ekipe"
              />
            </>
          )}

          <button type="submit" className={primary}>Sačuvaj</button>
        </form>
      )}

      {mode === "schedule" && (
        <form onSubmit={saveSchedule} className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border p-2 rounded-lg"
          />
          <input
            type="time"
            required
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="border p-2 rounded-lg"
          />
          <button type="submit" className={primary}>Sačuvaj</button>
        </form>
      )}
    </div>
  );
}

// Moja ekipa: igrači i (za kapitena) link za pozivanje
function MyTeam({ team, tournament, me, onChange }) {
  const isCaptain = Number(team.captain_id) === Number(me?.id);
  const open = tournament.status === "registration";
  const inviteUrl = team.invite_token
    ? `${window.location.origin}/turniri/pozivnica/${team.invite_token}`
    : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      alert("Link je kopiran.");
    } catch {
      window.prompt("Kopiraj link:", inviteUrl);
    }
  };

  const remove = async (player) => {
    const self = Number(player.id) === Number(me?.id);

    if (!window.confirm(self ? "Napustiti ekipu?" : `Ukloniti igrača ${player.name}?`)) return;

    const ok = await tournamentRequest(
      `/${tournament.id}/teams/${team.id}/players/${player.id}`,
      { method: "DELETE" }
    );

    if (ok) onChange();
  };

  const withdraw = async () => {
    if (!window.confirm("Odjaviti celu ekipu sa turnira?")) return;

    if (await tournamentRequest(`/${tournament.id}/teams/${team.id}`, { method: "DELETE" })) {
      onChange();
    }
  };

  return (
    <div className="bg-green-50 border border-green-200 rounded-2xl p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Tvoja ekipa: {team.name}</h2>
        {team.status === "pending" && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
            Čeka potvrdu organizatora
          </span>
        )}
      </div>

      <ul className="space-y-1">
        {team.players.map((player) => {
          const self = Number(player.id) === Number(me?.id);
          const removable =
            open && Number(player.id) !== Number(team.captain_id) && (isCaptain || self);

          return (
            <li key={player.id} className="flex items-center justify-between gap-2">
              <span>
                {player.name}
                {Number(player.id) === Number(team.captain_id) && " (kapiten)"}
              </span>
              {removable && (
                <button onClick={() => remove(player)} className="text-sm text-red-600 hover:underline">
                  {self ? "Napusti" : "Ukloni"}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-sm text-gray-600">Igrača: {team.players.length} / {tournament.max_roster}</p>

      {isCaptain && open && (
        <div className="flex flex-wrap gap-2">
          <button onClick={copy} className={primary}>Kopiraj link za igrače</button>
          <button onClick={withdraw} className={danger}>Odjavi ekipu</button>
        </div>
      )}
    </div>
  );
}

// Organizator: potvrda ekipa, kotizacija, početak i otkazivanje
function Organizer({ tournament, teams, onChange }) {
  const base = `/${tournament.id}`;
  const approved = teams.filter((t) => t.status === "approved");
  const pending = teams.filter((t) => t.status === "pending");
  const active = ["registration", "in_progress"].includes(tournament.status);

  const act = async (path, options) => {
    if (await tournamentRequest(path, options)) onChange();
  };

  const start = () => {
    const warning = pending.length
      ? ` Ekipe na čekanju (${pending.length}) će biti odbijene.`
      : "";

    if (window.confirm(`Zatvoriti prijave i napraviti raspored? Potvrđenih ekipa: ${approved.length}.${warning}`)) {
      act(`${base}/start`);
    }
  };

  const cancel = () => {
    if (window.confirm("Otkazati turnir? Ekipe dobijaju obaveštenje, a rezervacije terena se oslobađaju.")) {
      act(`${base}/cancel`);
    }
  };

  return (
    <div className={`${card} space-y-4`}>
      <h2 className="text-xl font-bold">Organizator</h2>

      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="font-medium">Prijave na čekanju</p>

          {pending.map((team) => (
            <div key={team.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-xl p-3">
              <span className="font-semibold">
                {team.name}{" "}
                <span className="text-sm font-normal text-gray-500">
                  (igrača: {team.players.length})
                </span>
              </span>

              <span className="flex gap-2">
                <button onClick={() => act(`${base}/teams/${team.id}/approve`, { silent: true })} className={primary}>
                  Potvrdi
                </button>
                <button onClick={() => act(`${base}/teams/${team.id}/reject`, { silent: true })} className={danger}>
                  Odbij
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {tournament.entry_fee !== null && approved.length > 0 && (
        <div className="space-y-1">
          <p className="font-medium">Kotizacija ({formatRSD(tournament.entry_fee)})</p>

          {approved.map((team) => (
            <label key={team.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={team.paid}
                onChange={(e) =>
                  act(`${base}/teams/${team.id}/paid`, {
                    method: "PUT",
                    silent: true,
                    body: { paid: e.target.checked },
                  })
                }
                className="w-4 h-4"
              />
              {team.name}
            </label>
          ))}
        </div>
      )}

      {active && (
        <div className="flex flex-wrap gap-2">
          {tournament.status === "registration" && (
            <>
              <button onClick={start} disabled={approved.length < 2} className={`${primary} disabled:opacity-50`}>
                Počni turnir
              </button>
              <Link to={`/turniri/${tournament.id}/izmeni`} className={`${outline} inline-flex items-center gap-1.5`}>
                <Pencil size={16} />
                Izmeni
              </Link>
            </>
          )}

          <button onClick={cancel} className={danger}>Otkaži turnir</button>
        </div>
      )}

      {tournament.status === "registration" && approved.length < 2 && (
        <p className="text-sm text-gray-500">Za početak trebaju bar 2 potvrđene ekipe.</p>
      )}
    </div>
  );
}

function TournamentDetails() {
  const { id } = useParams();
  const me = JSON.parse(localStorage.getItem("user") || "null");

  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [teamName, setTeamName] = useState("");

  const load = useCallback(() => {
    fetch(`${API_URL}/api/tournaments/${id}`, { headers: authHeader() })
      .then((res) => res.json())
      .then((result) => (result.success ? setData(result) : setNotFound(true)))
      .catch(() => setNotFound(true));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const registerTeam = async (e) => {
    e.preventDefault();

    const ok = await tournamentRequest(`/${id}/teams`, { body: { name: teamName } });

    if (ok) {
      setTeamName("");
      load();
    }
  };

  if (notFound) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center mt-10">
        <p className="text-xl mb-4">Turnir ne postoji.</p>
        <Link to="/turniri" className="text-green-700 font-semibold hover:underline">
          ← Svi turniri
        </Link>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center mt-20 text-xl">Učitavanje...</div>;
  }

  const { tournament: t, teams, games, standings, can_manage: canManage, my_team_id: myTeamId } = data;
  const status = STATUS[t.status];
  const approved = teams.filter((team) => team.status === "approved");
  const myTeam = teams.find((team) => team.id === myTeamId);
  const rounds = groupByRound(games);
  const totalRounds = rounds.length;
  const editableGames = canManage && ["in_progress", "finished"].includes(t.status);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Link to="/turniri" className="inline-flex items-center gap-1.5 text-gray-600 hover:text-gray-900">
          <ArrowLeft size={18} />
          Svi turniri
        </Link>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 text-white bg-gradient-to-br from-green-600 to-emerald-500">
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-xl bg-white/20 flex items-center justify-center text-2xl">
                {sportIcon(t.sport)}
              </span>

              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight break-words">{t.name}</h1>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <span className="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">
                    {t.sport} · {FORMATS[t.format].label}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${status.className}`}>
                    {status.label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-3 text-gray-700">
            {t.winner_name && (
              <p className="text-xl font-bold text-gray-900">🏆 Pobednik: {t.winner_name}</p>
            )}

            <div className="flex items-center gap-3">
              <Calendar className="text-green-600 shrink-0" size={18} />
              <span className="capitalize">{formatDate(t.start_date)}</span>
            </div>

            <div className="flex items-center gap-3">
              <MapPin className="text-green-600 shrink-0" size={18} />
              {t.venue_id ? (
                <Link to={`/tereni/${t.venue_id}`} className="text-green-700 hover:underline">
                  {t.location}
                </Link>
              ) : (
                <span>{t.location}</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Users className="text-green-600 shrink-0" size={18} />
              <span>
                Ekipa: {approved.length} / {t.max_teams} · do {t.max_roster} igrača u ekipi
              </span>
            </div>

            {t.entry_fee !== null && (
              <div className="flex items-center gap-3">
                <Wallet className="text-green-600 shrink-0" size={18} />
                <span>Kotizacija: {formatRSD(t.entry_fee)} po ekipi</span>
              </div>
            )}

            <p className="text-sm text-gray-500">Organizator: {t.organizer_name}</p>

            {t.rules && <p className="whitespace-pre-line pt-2 border-t">{t.rules}</p>}
          </div>
        </div>

        {canManage && <Organizer tournament={t} teams={teams} onChange={load} />}

        {myTeam && <MyTeam team={myTeam} tournament={t} me={me} onChange={load} />}

        {/* Prijava ekipe */}
        {t.status === "registration" && !myTeam && (
          <div className={card}>
            <h2 className="text-xl font-bold mb-3">Prijavi ekipu</h2>

            {me ? (
              <form onSubmit={registerTeam} className="flex flex-wrap gap-2">
                <input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Naziv ekipe"
                  required
                  minLength={2}
                  maxLength={50}
                  className="flex-1 min-w-[12rem] border p-3 rounded-xl"
                />
                <button type="submit" className={primary}>Prijavi ekipu</button>
              </form>
            ) : (
              <p className="text-gray-600">
                <Link to="/login" className="text-green-700 font-semibold hover:underline">
                  Prijavi se
                </Link>{" "}
                da prijaviš ekipu.
              </p>
            )}

            <p className="text-sm text-gray-500 mt-2">
              Postaješ kapiten i dobijaš link kojim pozivaš igrače. Ako imaš link od kapitena, otvori njega.
            </p>
          </div>
        )}

        {standings.length > 0 && <Standings rows={standings} sport={t.sport} />}

        {/* Raspored */}
        {rounds.length > 0 && (
          <div className={`${card} space-y-5`}>
            <h2 className="text-2xl font-bold">Raspored i rezultati</h2>

            {rounds.map(({ round, games: list }) => (
              <div key={round} className="space-y-2">
                <h3 className="font-semibold text-gray-700">{roundLabel(t.format, round, totalRounds)}</h3>

                {list.map((game) => (
                  <GameRow
                    key={`${game.id}-${game.score_a}-${game.score_b}-${game.game_date}-${game.game_time}`}
                    game={game}
                    tournament={t}
                    canEdit={editableGames}
                    onChange={load}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Ekipe */}
        {approved.length > 0 && (
          <div className={card}>
            <h2 className="text-2xl font-bold mb-4">Ekipe</h2>

            <div className="grid sm:grid-cols-2 gap-3">
              {approved.map((team) => (
                <div key={team.id} className="border rounded-xl p-3">
                  <p className="font-semibold">{team.name}</p>
                  <p className="text-sm text-gray-600">
                    {team.players.map((p) => p.name).join(", ")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TournamentDetails;
