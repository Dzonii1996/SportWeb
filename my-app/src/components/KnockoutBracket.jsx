import { useEffect, useRef } from "react";
import { Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isBye, roundLabel } from "../utils/tournaments";

// Kostur kupa kao na velikim takmičenjima: polovina ekipa ide sleva, polovina zdesna,
// a finale sa peharom je u sredini. Na užem ekranu se kostur pomera vodoravno.

const CARD_W = 146;
const GAP = 24;
const CARD_H = 60;
const FINAL_H = 76;
const SLOT = 84;
const LABEL_H = 30;
const MIN_HEIGHT = 220;

const columnX = (column) => column * (CARD_W + GAP);

function Team({ name, score, penalties, winner, decided, bye }) {
  const { t } = useTranslation();

  return (
    <div className={`flex items-center gap-2 px-3 h-1/2 ${decided && !winner ? "opacity-45" : ""}`}>
      <span
        className={`w-1 self-stretch my-1.5 rounded-full ${winner ? "bg-amber-300" : "bg-transparent"}`}
        aria-hidden="true"
      />
      <span className={`flex-1 min-w-0 truncate text-sm ${winner ? "font-semibold" : ""}`}>
        {name || (
          <span className="italic text-white/45">
            {bye ? t("tournamentDetails.bye") : t("tournamentDetails.toBeDecided")}
          </span>
        )}
      </span>
      {score !== null && score !== undefined && (
        <span className="text-sm font-bold tabular-nums">
          {score}
          {penalties !== null && penalties !== undefined && (
            <sup className="text-[10px] font-medium text-white/60 ml-0.5">({penalties})</sup>
          )}
        </span>
      )}
    </div>
  );
}

function GameCard({ game, final, style }) {
  const decided = game.winner_team_id !== null;
  const bye = isBye(game);
  const winnerIs = (id) => id !== null && Number(game.winner_team_id) === Number(id);

  const open = () =>
    document.getElementById(`game-${game.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });

  return (
    <button
      type="button"
      onClick={open}
      style={style}
      className={`absolute text-left text-white rounded-xl border backdrop-blur-sm transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 divide-y divide-white/10 ${
        final
          ? "bg-white/15 border-amber-300/70 shadow-[0_0_24px_rgba(252,211,77,0.25)]"
          : "bg-white/[0.07] border-white/15 hover:border-white/35"
      }`}
    >
      <Team
        name={game.team_a_name}
        score={bye ? null : game.score_a}
        penalties={game.penalties_a}
        winner={winnerIs(game.team_a_id)}
        decided={decided}
        bye={bye}
      />
      <Team
        name={game.team_b_name}
        score={bye ? null : game.score_b}
        penalties={game.penalties_b}
        winner={winnerIs(game.team_b_id)}
        decided={decided}
        bye={bye}
      />
    </button>
  );
}

function KnockoutBracket({ rounds, winnerName }) {
  const { t } = useTranslation();
  const scroller = useRef(null);
  const total = rounds.length;

  // Na širem ekranu je finale na sredini pogleda; na telefonu se kreće od prvog kola
  useEffect(() => {
    const el = scroller.current;

    if (el && el.clientWidth >= 640) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [total]);

  if (total === 0) return null;

  const firstPerSide = Math.max(1, rounds[0].games.length / 2);
  const height = Math.max(firstPerSide * SLOT, MIN_HEIGHT);
  const columns = 2 * total - 1;
  const width = columnX(columns - 1) + CARD_W;
  const finalCenter = LABEL_H + height / 2;

  const cards = [];
  const lines = [];
  const labels = [];

  rounds.forEach(({ round, games }) => {
    const isFinal = round === total;
    const label = roundLabel("knockout", round, total);

    if (isFinal) {
      const game = games[0];

      cards.push({
        game,
        final: true,
        x: columnX(total - 1),
        y: finalCenter - FINAL_H / 2,
        h: FINAL_H,
      });
      labels.push({ text: label, x: columnX(total - 1), final: true });
      return;
    }

    const perSide = games.length / 2;
    const leftColumn = round - 1;
    const rightColumn = columns - round;
    const centerOf = (index, count) => LABEL_H + ((index + 0.5) * height) / count;

    labels.push({ text: label, x: columnX(leftColumn) });
    labels.push({ text: label, x: columnX(rightColumn) });

    games.forEach((game) => {
      const left = game.position <= perSide;
      const index = left ? game.position - 1 : game.position - 1 - perSide;
      const y = centerOf(index, perSide);
      const column = left ? leftColumn : rightColumn;

      cards.push({ game, x: columnX(column), y: y - CARD_H / 2, h: CARD_H });

      // Linija do utakmice u sledećem kolu (ili do finala)
      const nextY = round + 1 === total ? finalCenter : centerOf(Math.floor(index / 2), perSide / 2);
      const from = left ? columnX(column) + CARD_W : columnX(column);
      const to = left ? columnX(column + 1) : columnX(column - 1) + CARD_W;
      const middle = (from + to) / 2;

      lines.push({
        key: game.id,
        d: `M${from} ${y} H${middle} V${nextY} H${to}`,
        done: game.winner_team_id !== null,
      });
    });
  });

  const finalCard = cards.find((c) => c.final);

  return (
    <div className="rounded-2xl overflow-hidden bg-[#0b1437] text-white shadow-sm">
      <div
        className="relative px-5 sm:px-6 pt-5 pb-4"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 45%, rgba(56,189,248,0.18), transparent 60%)," +
            "radial-gradient(circle at 20% 15%, rgba(255,255,255,0.35) 0 1px, transparent 1.5px)," +
            "radial-gradient(circle at 75% 30%, rgba(255,255,255,0.25) 0 1px, transparent 1.5px)," +
            "radial-gradient(circle at 40% 80%, rgba(255,255,255,0.25) 0 1px, transparent 1.5px)," +
            "linear-gradient(180deg, #0b1437 0%, #13235c 100%)",
          backgroundSize: "100% 100%, 140px 140px, 190px 190px, 230px 230px, 100% 100%",
        }}
      >
        <h2 className="text-2xl font-bold">{t("tournamentDetails.bracket")}</h2>

        {winnerName && (
          <p className="mt-1 text-amber-200 font-semibold">
            {t("tournamentDetails.champion")}: {winnerName}
          </p>
        )}

        <div ref={scroller} className="mt-4 -mx-5 sm:-mx-6 px-5 sm:px-6 overflow-x-auto pb-2">
          <div className="relative mx-auto" style={{ width, height: LABEL_H + height + 8 }}>
            {labels.map((label, i) =>
              label.final ? null : (
                <span
                  key={i}
                  className="absolute top-0 text-[11px] font-semibold uppercase tracking-wider text-sky-200/70 text-center"
                  style={{ left: label.x, width: CARD_W }}
                >
                  {label.text}
                </span>
              )
            )}

            <svg className="absolute inset-0 pointer-events-none" width={width} height={LABEL_H + height + 8} aria-hidden="true">
              {lines.map((line) => (
                <path
                  key={line.key}
                  d={line.d}
                  fill="none"
                  stroke={line.done ? "rgba(252,211,77,0.55)" : "rgba(255,255,255,0.22)"}
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              ))}
            </svg>

            {finalCard && (
              <div
                className="absolute flex flex-col items-center text-center"
                style={{ left: finalCard.x, width: CARD_W, top: finalCard.y - 70 }}
              >
                <Trophy size={34} className="text-amber-300 drop-shadow-[0_0_10px_rgba(252,211,77,0.6)]" />
                <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-amber-200">
                  {roundLabel("knockout", total, total)}
                </span>
              </div>
            )}

            {cards.map(({ game, final, x, y, h }) => (
              <GameCard key={game.id} game={game} final={final} style={{ left: x, top: y, width: CARD_W, height: h }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default KnockoutBracket;
