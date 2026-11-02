import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";
import { API_URL } from "../config";

const MEDALS = ["🥇", "🥈", "🥉"];

// Rang lista: bodovi kao u fudbalu (pobeda 3, nerešeno 1)
function Leaderboard() {
  const [players, setPlayers] = useState(null);

  const me = JSON.parse(localStorage.getItem("user"));

  useEffect(() => {
    fetch(`${API_URL}/api/users/leaderboard`)
      .then((res) => res.json())
      .then((data) => setPlayers(data.players || []))
      .catch(() => setPlayers([]));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">

        <div className="flex items-center gap-3 mb-2">
          <Trophy className="text-amber-500" size={32} />
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
            Rang lista
          </h1>
        </div>

        <p className="text-gray-500 mb-6">
          Pobeda 3 boda, nerešeno 1. Računaju se termini sa upisanim
          rezultatom i podeljenim timovima.
        </p>

        {players === null ? (
          <p className="text-gray-500">Učitavanje...</p>
        ) : players.length === 0 ? (
          <div className="bg-white border-2 border-dashed rounded-2xl p-10 text-center">
            <p className="text-lg font-semibold text-gray-800">
              Još nema odigranih utakmica sa rezultatom.
            </p>
            <p className="text-gray-500 mt-1">
              Posle termina organizator podeli timove i upiše rezultat.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 text-sm text-gray-500">
                <tr>
                  <th className="text-left font-semibold py-3 pl-4 w-12">#</th>
                  <th className="text-left font-semibold py-3">Igrač</th>
                  <th className="font-semibold py-3 w-12" title="Odigrano">U</th>
                  <th className="font-semibold py-3 w-24 hidden sm:table-cell" title="Pobede / Nerešeno / Porazi">P-N-I</th>
                  <th className="font-semibold py-3 pr-4 w-16 text-right">Bod.</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {players.map((p, i) => (
                  <tr
                    key={p.id}
                    className={p.id === me?.id ? "bg-green-50" : "hover:bg-gray-50"}
                  >
                    <td className="py-3 pl-4 font-bold text-gray-500">
                      {/* Medalja samo za prva tri sa bodovima */}
                      {(p.points > 0 && MEDALS[i]) || i + 1}
                    </td>

                    <td className="py-3">
                      <Link
                        to={`/users/${p.id}`}
                        className="flex items-center gap-3 hover:text-green-700"
                      >
                        {p.avatar ? (
                          <img
                            src={`${API_URL}${p.avatar}`}
                            alt={p.name}
                            className="w-9 h-9 rounded-full object-cover"
                          />
                        ) : (
                          <span className="w-9 h-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold">
                            {p.name.charAt(0).toUpperCase()}
                          </span>
                        )}

                        <span className="font-semibold">
                          {p.name}
                          {p.id === me?.id && (
                            <span className="text-gray-500 font-normal"> (ti)</span>
                          )}
                        </span>
                      </Link>
                    </td>

                    <td className="py-3 text-center text-gray-600">{p.played}</td>

                    <td className="py-3 text-center text-gray-600 hidden sm:table-cell">
                      {p.wins}-{p.draws}-{p.losses}
                    </td>

                    <td className="py-3 pr-4 text-right text-lg font-extrabold">
                      {p.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Leaderboard;
