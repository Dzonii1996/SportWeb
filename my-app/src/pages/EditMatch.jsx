import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { authHeader } from "../utils/auth";

function EditMatch() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [location, setLocation] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [matchTime, setMatchTime] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("");

  useEffect(() => {
    fetch("http://localhost:5000/api/matches")
      .then((res) => res.json())
      .then((data) => {
        const match = data.matches.find(
          (m) => m.id === Number(id)
        );

        if (match) {
          setLocation(match.location);
          setMatchDate(match.match_date.split("T")[0]);
          setMatchTime(match.match_time.slice(0, 5));
          setMaxPlayers(match.max_players);
        }
      });
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const user = JSON.parse(localStorage.getItem("user"));

    const res = await fetch(
      `http://localhost:5000/api/matches/${id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(),
        },
        body: JSON.stringify({
          user_id: user.id,
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
      navigate("/matches");
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
          placeholder="Lokacija"
        />

        <input
          type="date"
          className="w-full border p-3 rounded-xl"
          value={matchDate}
          onChange={(e) =>
            setMatchDate(e.target.value)
          }
        />

        <input
          type="time"
          className="w-full border p-3 rounded-xl"
          value={matchTime}
          onChange={(e) =>
            setMatchTime(e.target.value)
          }
        />

        <input
          type="number"
          className="w-full border p-3 rounded-xl"
          value={maxPlayers}
          onChange={(e) =>
            setMaxPlayers(e.target.value)
          }
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