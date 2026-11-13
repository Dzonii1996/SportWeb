import { useState } from "react";
import { CalendarClock, CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { locale } from "../i18n";
import { localDateKey, todayKey } from "../utils/matchDate";
import { isBye, roundLabel, tournamentRequest } from "../utils/tournaments";

const INTERVALS = [30, 45, 60, 75, 90, 120];

// Organizator zakazuje celo kolo: dan, vreme prve utakmice i razmak između utakmica
export function RoundScheduler({ tournament, round, onDone }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("18:00");
  const [interval, setGap] = useState(60);

  const save = async (e) => {
    e.preventDefault();

    const ok = await tournamentRequest(`/${tournament.id}/rounds/${round}/schedule`, {
      method: "PUT",
      body: { game_date: date, start_time: time, interval },
    });

    if (ok) {
      setOpen(false);
      onDone();
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-green-700 font-semibold hover:underline"
      >
        <CalendarClock size={16} />
        {t("tournamentDetails.scheduleRound")}
      </button>
    );
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-2 bg-green-50 border border-green-200 rounded-xl p-3">
      <label className="flex flex-col text-xs text-gray-600 gap-1">
        {t("tournamentDetails.day")}
        <input type="date" required min={todayKey()} value={date} onChange={(e) => setDate(e.target.value)} className="border p-2 rounded-lg bg-white text-sm text-gray-900" />
      </label>
      <label className="flex flex-col text-xs text-gray-600 gap-1">
        {t("tournamentDetails.firstGameAt")}
        <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className="border p-2 rounded-lg bg-white text-sm text-gray-900" />
      </label>
      <label className="flex flex-col text-xs text-gray-600 gap-1">
        {t("tournamentDetails.everyMinutes")}
        <select value={interval} onChange={(e) => setGap(Number(e.target.value))} className="border p-2 rounded-lg bg-white text-sm text-gray-900">
          {INTERVALS.map((m) => (
            <option key={m} value={m}>{t("tournamentDetails.minutes", { n: m })}</option>
          ))}
        </select>
      </label>
      <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-semibold">
        {t("common.save")}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 rounded-xl text-gray-600 hover:bg-white">
        {t("common.cancel")}
      </button>
    </form>
  );
}

// Raspored po danima: koji dan, u koliko sati i ko sa kim igra
export function DaySchedule({ tournament, games, totalRounds }) {
  const { t } = useTranslation();

  const playable = games.filter((g) => !isBye(g));
  const scheduled = playable
    .filter((g) => g.game_date && g.game_time)
    .map((g) => ({ ...g, day: localDateKey(g.game_date) }))
    .sort((a, b) => a.day.localeCompare(b.day) || a.game_time.localeCompare(b.game_time));

  if (scheduled.length === 0) return null;

  const days = [];
  scheduled.forEach((g) => {
    const last = days[days.length - 1];
    if (last && last.day === g.day) last.games.push(g);
    else days.push({ day: g.day, games: [g] });
  });

  const unscheduled = playable.length - scheduled.length;
  const today = todayKey();
  const name = (team) => team || <span className="italic text-gray-400">{t("tournamentDetails.toBeDecided")}</span>;
  // "Subota, 21. novembar": veliko je samo prvo slovo
  const dayLabel = (day) => {
    const text = new Date(`${day}T00:00`).toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" });

    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <CalendarDays className="text-green-600" size={24} />
        {t("tournamentDetails.gameDays")}
      </h2>

      {days.map(({ day, games: list }) => (
        <div key={day}>
          <h3 className={`font-semibold mb-2 flex items-center gap-2 ${day < today ? "text-gray-400" : "text-gray-800"}`}>
            {dayLabel(day)}
            {day === today && (
              <span className="text-xs normal-case font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                {t("tournamentDetails.today")}
              </span>
            )}
          </h3>

          <ul className="divide-y border rounded-xl overflow-hidden">
            {list.map((g) => {
              const played = g.score_a !== null;

              return (
                <li key={g.id}>
                  <a
                    href={`#game-${g.id}`}
                    className={`flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 ${played ? "text-gray-500" : ""}`}
                  >
                    <span className="w-12 shrink-0 font-bold tabular-nums text-green-700">{g.game_time.slice(0, 5)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate font-medium">
                        {name(g.team_a_name)} <span className="text-gray-400">–</span> {name(g.team_b_name)}
                        {played && <span className="ml-2 font-bold text-gray-700">{g.score_a} : {g.score_b}</span>}
                      </span>
                      <span className="block text-xs text-gray-500">{roundLabel(tournament.format, g.round, totalRounds)}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {unscheduled > 0 && (
        <p className="text-sm text-gray-500">{t("tournamentDetails.unscheduledGames", { n: unscheduled })}</p>
      )}
    </div>
  );
}
