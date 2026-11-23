import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Printer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FORMATS, formatDate, groupByRound, isBye, roundLabel } from "../utils/tournaments";
import { locale, sportLabel } from "../i18n";
import { photoUrl } from "./PhotoGallery";

// Raspored turnira za štampu (A4). Na ekranu se ne vidi: pri štampi (Ctrl+P ili
// dugme ispod) aplikacija se sakriva, a štampa se samo ovaj list (index.css, @media print).
// Boje su stalne, pa je list isti i u tamnom režimu.

// Utakmice kola po datumu i satu; one bez termina na kraju
const byTime = (list) =>
  [...list].sort(
    (a, b) =>
      (a.game_date || "9").localeCompare(b.game_date || "9") ||
      (a.game_time || "").localeCompare(b.game_time || "") ||
      a.position - b.position
  );

function Sheet({ tournament: t, games }) {
  const { t: tr } = useTranslation();

  const rounds = groupByRound(games);
  const totalRounds = rounds.length;
  const label = (round) => roundLabel(t.format, round, totalRounds);
  const played = (g) => g.score_a !== null && g.score_b !== null;

  // Ekipa koja još nije poznata: "Pobednik: A – B" (kup), inače "Biće određeno"
  const slot = (g, side) => {
    const name = side === "a" ? g.team_a_name : g.team_b_name;

    if (name) return { name, known: true };

    const feeder =
      t.format === "knockout" &&
      games.find((f) => f.round === g.round - 1 && f.position === (side === "a" ? g.position * 2 - 1 : g.position * 2));

    if (feeder?.team_a_name && feeder?.team_b_name) {
      return { name: tr("printSchedule.winnerOf", { pair: `${feeder.team_a_name} – ${feeder.team_b_name}` }), known: false };
    }

    if (feeder) {
      return { name: tr("printSchedule.winnerOfGame", { round: label(feeder.round), n: feeder.position }), known: false };
    }

    return { name: tr("tournamentDetails.toBeDecided"), known: false };
  };

  const playedCount = games.filter((g) => played(g) && !isBye(g)).length;
  const total = games.filter((g) => !isBye(g)).length;

  return (
    <div className="print-sheet">
      <header>
        {t.logo_path && <img src={photoUrl(t.logo_path)} alt="" />}
        <div>
          <h1>{t.name}</h1>
          <p>
            {tr("printSchedule.schedule")} · {sportLabel(t.sport)}, {FORMATS[t.format].label.toLowerCase()} · <b>{t.location}</b>
          </p>
          <p>
            {tr("tournamentDetails.organizer2", { organizer_name: t.organizer_name })} ·{" "}
            {tr("printSchedule.played", { played: playedCount, total })}
          </p>
        </div>
      </header>

      {rounds.map(({ round, games: list }) => (
        <section key={round}>
          <h2>{label(round)}</h2>
          <table>
            <thead>
              <tr>
                <th>{tr("printSchedule.date")}</th>
                <th>{tr("printSchedule.time")}</th>
                <th className="right">{tr("printSchedule.home")}</th>
                <th className="center">{tr("printSchedule.result")}</th>
                <th>{tr("printSchedule.away")}</th>
              </tr>
            </thead>
            <tbody>
              {byTime(list).map((g) => {
                const a = slot(g, "a");
                const b = slot(g, "b");
                const done = played(g);
                const team = (s, id) =>
                  `team ${s.known ? "" : "tbd"} ${done && g.winner_team_id === id ? "win" : ""}`;

                if (isBye(g)) {
                  return (
                    <tr key={g.id} className="played">
                      <td>—</td>
                      <td>—</td>
                      <td className="team right">{g.team_a_name || g.team_b_name}</td>
                      <td className="center" colSpan={2}>{tr("tournamentDetails.byeToTheNextRound")}</td>
                    </tr>
                  );
                }

                return (
                  <tr key={g.id} className={done ? "played" : ""}>
                    <td className="date">{g.game_date ? formatDate(g.game_date) : "—"}</td>
                    <td className="time">{g.game_time ? g.game_time.slice(0, 5) : "—"}</td>
                    <td className={`${team(a, g.team_a_id)} right`}>{a.name}</td>
                    <td className="score">
                      {done ? (
                        <>
                          <b>{g.score_a}</b> : <b>{g.score_b}</b>
                        </>
                      ) : (
                        <>
                          <span className="blank" /> : <span className="blank" />
                        </>
                      )}
                    </td>
                    <td className={team(b, g.team_b_id)}>{b.name}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}

      <footer>
        <span>Sport KM</span>
        <span>{tr("printSchedule.asOf", { date: new Date().toLocaleDateString(locale()) })}</span>
      </footer>
    </div>
  );
}

// Dugme "Štampaj raspored" i list koji se štampa
function PrintSchedule({ tournament, games }) {
  const { t } = useTranslation();

  // Ime PDF fajla pri "Sačuvaj kao PDF" je naslov stranice
  useEffect(() => {
    const original = document.title;
    const before = () => {
      document.title = `${t("printSchedule.schedule")} - ${tournament.name}`;
    };
    const after = () => {
      document.title = original;
    };

    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);

    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
      document.title = original;
    };
  }, [tournament.name, t]);

  return (
    <>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 font-semibold hover:bg-gray-50"
      >
        <Printer size={18} aria-hidden="true" />
        {t("printSchedule.print")}
      </button>

      {createPortal(<Sheet tournament={tournament} games={games} />, document.body)}
    </>
  );
}

export default PrintSchedule;
