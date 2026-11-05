import { useEffect, useState } from "react";
import { API_URL } from "../config";
import { authHeader } from "../utils/auth";
import { useTranslation } from "react-i18next";
import i18n, { locale } from "../i18n";

const VOTES = [
  { value: "fair", icon: "👍", get label() { return i18n.t("matchRatings.fairPlay"); }, active: "bg-green-600 text-white" },
  { value: "unfair", icon: "👎", get label() { return i18n.t("matchRatings.unsporting"); }, active: "bg-red-600 text-white" },
  { value: "no_show", icon: "🚫", get label() { return i18n.t("matchRatings.noShow"); }, active: "bg-gray-700 text-white" },
];

function PersonAvatar({ person }) {
  return person.avatar ? (
    <img
      src={`${API_URL}${person.avatar}`}
      alt={person.name}
      className="w-10 h-10 rounded-full object-cover shrink-0"
    />
  ) : (
    <span className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold shrink-0">
      {person.name?.charAt(0).toUpperCase()}
    </span>
  );
}

// Ocenjivanje ostalih učesnika posle odigranog termina.
// "people" su učesnici termina bez trenutnog korisnika.
function MatchRatings({ matchId, people }) {
  const { t } = useTranslation();

  const [canRate, setCanRate] = useState(false);
  const [deadline, setDeadline] = useState(null);
  const [votes, setVotes] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/matches/${matchId}/ratings`, {
      headers: authHeader(),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCanRate(data.canRate);
          setDeadline(data.deadline);
          setVotes(data.votes);
        }
      })
      .catch(console.error);
  }, [matchId]);

  if (!canRate || people.length === 0) return null;

  // Čuva ocenu; vraća true kad je uspelo
  const saveVote = async (personId, vote) => {
    try {
      const res = await fetch(
        `${API_URL}/api/matches/${matchId}/ratings/${personId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authHeader(),
          },
          body: JSON.stringify({ vote }),
        }
      );

      const data = await res.json();

      if (data.success) {
        setVotes((prev) => ({ ...prev, [personId]: vote }));
      } else {
        alert(data.message);
      }

      return data.success;

    } catch (error) {
      console.error(error);
      return false;
    }
  };

  // Ponovni klik na istu ocenu je poništava
  const rate = (personId, value) =>
    saveVote(personId, votes[personId] === value ? null : value);

  const unrated = people.filter((person) => !votes[person.id]);
  const rated = people.length - unrated.length;

  // Već date ocene ostaju; "fer" dobijaju samo oni koji još nisu ocenjeni
  const rateRestFair = async () => {
    setSaving(true);
    await Promise.all(unrated.map((person) => saveVote(person.id, "fair")));
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
      <h2 className="text-2xl font-bold">
        {t("matchRatings.rateYourTeammates")}
      </h2>

      <p className="text-gray-500 text-sm mt-1">
        {t("matchRatings.ratingsAppearOnProfilesAs", { value: new Date(deadline).toLocaleDateString(locale()) })}
      </p>

      {/* Napredak */}
      <div className="mt-4">
        <p className="text-sm font-semibold text-gray-700 mb-1.5">
          {t("matchRatings.ratedCount", { rated, total: people.length })}
        </p>

        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-2 bg-green-500 rounded-full transition-all"
            style={{ width: `${(rated / people.length) * 100}%` }}
          />
        </div>
      </div>

      {unrated.length > 1 && (
        <button
          onClick={rateRestFair}
          disabled={saving}
          className="w-full mt-4 py-2.5 rounded-xl border-2 border-green-600 text-green-700 font-semibold hover:bg-green-50 disabled:opacity-60 transition"
        >
          {t("matchRatings.everyonePlayedFair")}
        </button>
      )}

      <ul className="divide-y mt-2">
        {people.map((person) => (
          <li key={person.id} className="py-3">
            <div className="flex items-center gap-3 mb-2">
              <PersonAvatar person={person} />

              <p className="font-semibold min-w-0 truncate">
                {person.name}
              </p>

              {person.team && (
                <span className="ml-auto shrink-0 text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {t("matchRatings.team", { team: person.team })}
                </span>
              )}
            </div>

            {/* Tri jednaka dugmeta, da i na telefonu stanu u jedan red */}
            <div className="grid grid-cols-3 gap-2">
              {VOTES.map((v) => (
                <button
                  key={v.value}
                  onClick={() => rate(person.id, v.value)}
                  aria-pressed={votes[person.id] === v.value}
                  className={`flex flex-col items-center gap-0.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition ${
                    votes[person.id] === v.value
                      ? v.active
                      : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  <span aria-hidden="true" className="text-base leading-none">{v.icon}</span>
                  {v.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default MatchRatings;
