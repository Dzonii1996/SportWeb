import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { authHeader } from "../utils/auth";
import { API_URL } from "../config";
import { localDateKey, todayKey, maxDateKey } from "../utils/matchDate";

function EditMatch() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [location, setLocation] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [matchTime, setMatchTime] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/api/matches/${id}`)
      .then((res) => res.json())
      .then((data) => {
        const match = data.match;

        if (match) {
          setLocation(match.location);
          // Lokalni datum; split("T") nad UTC vrednošću daje dan ranije
          setMatchDate(localDateKey(match.match_date));
          setMatchTime(match.match_time.slice(0, 5));
          setMaxPlayers(match.max_players);
        }
      });
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const res = await fetch(
      `${API_URL}/api/matches/${id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(),
        },
        body: JSON.stringify({
          location,
          match_date: matchDate,
          match_time: matchTime,
          max_players: Number(maxPlayers),
        }),
      }
    );

    const data = await res.json();

    alert(data.message);

    if (data.success) {
      navigate(`/matches/${id}`);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">
        Izmeni termin
      </h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <input
          className="w-full border p-3 rounded-xl"
          value={location}
          onChange={(e) =>
            setLocation(e.target.value)
          }
          required
          minLength={2}
          maxLength={100}
          placeholder="Lokacija"
        />

        <input
          type="date"
          className="w-full border p-3 rounded-xl"
          value={matchDate}
          onChange={(e) =>
            setMatchDate(e.target.value)
          }
          required
          min={todayKey()}
          max={maxDateKey()}
        />

        <input
          type="time"
          className="w-full border p-3 rounded-xl"
          value={matchTime}
          onChange={(e) =>
            setMatchTime(e.target.value)
          }
          required
        />

        <input
          type="number"
          className="w-full border p-3 rounded-xl"
          value={maxPlayers}
          onChange={(e) =>
            setMaxPlayers(e.target.value)
          }
          required
          min="2"
          max="30"
        />

        <button
          className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl"
        >
          Sačuvaj izmene
        </button>
      </form>
    </div>
  );
}

export default EditMatch;
