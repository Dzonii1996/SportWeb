import { useEffect, useState } from "react";
import { API_URL } from "../config";
import { authHeader } from "../utils/auth";

const VOTES = [
  { value: "fair", label: "👍 Fer plej", active: "bg-green-600 text-white" },
  { value: "unfair", label: "👎 Nesportski", active: "bg-red-600 text-white" },
  { value: "no_show", label: "🚫 Nije došao", active: "bg-gray-700 text-white" },
];

// Ocenjivanje ostalih učesnika posle odigranog termina.
// "people" su učesnici termina bez trenutnog korisnika.
function MatchRatings({ matchId, people }) {
  const [canRate, setCanRate] = useState(false);
  const [deadline, setDeadline] = useState(null);
  const [votes, setVotes] = useState({});

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

  const rate = async (personId, value) => {
    // Ponovni klik na istu ocenu je poništava
    const vote = votes[personId] === value ? null : value;

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

    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-2xl font-bold">
        ⭐ Oceni saigrače
      </h2>

      <p className="text-gray-500 text-sm mt-1 mb-4">
        Ocene su vidljive na profilu kao fer plej i nedolasci.
        Možeš ih menjati do{" "}
        {new Date(deadline).toLocaleDateString("sr-RS")}.
      </p>

      <ul className="divide-y">
        {people.map((person) => (
          <li key={person.id} className="py-3">
            <p className="font-semibold mb-2">
              {person.name}
            </p>

            <div className="flex flex-wrap gap-2">
              {VOTES.map((v) => (
                <button
                  key={v.value}
                  onClick={() => rate(person.id, v.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    votes[person.id] === v.value
                      ? v.active
                      : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
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
