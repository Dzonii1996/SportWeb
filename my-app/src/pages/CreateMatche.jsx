import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

function CreateMatch() {
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user"));

  const [formData, setFormData] = useState({
    sport: "Fudbal",
    location: "",
    match_date: "",
    match_time: "",
    max_players: 10,
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post(
        "http://localhost:5000/api/matches",
        {
          user_id: user.id,
          ...formData,
        }
      );

      alert(response.data.message);

      navigate("/matches");

    } catch (error) {
      alert(
        error.response?.data?.message || "Greška prilikom kreiranja termina."
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center py-10">

      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-lg">

        <h1 className="text-3xl font-bold mb-6">
          Kreiraj novi termin
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">

          <select
            name="sport"
            value={formData.sport}
            onChange={handleChange}
            className="w-full border p-3 rounded-xl"
          >
            <option value="Fudbal">⚽ Fudbal</option>
            <option value="Košarka">🏀 Košarka</option>
          </select>

          <input
            type="text"
            name="location"
            placeholder="Lokacija"
            value={formData.location}
            onChange={handleChange}
            className="w-full border p-3 rounded-xl"
          />

          <input
            type="date"
            name="match_date"
            value={formData.match_date}
            onChange={handleChange}
            className="w-full border p-3 rounded-xl"
          />

          <input
            type="time"
            name="match_time"
            value={formData.match_time}
            onChange={handleChange}
            className="w-full border p-3 rounded-xl"
          />

          <input
            type="number"
            name="max_players"
            min="2"
            max="30"
            value={formData.max_players}
            onChange={handleChange}
            className="w-full border p-3 rounded-xl"
          />

          <button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl"
          >
            Kreiraj termin
          </button>

        </form>

      </div>

    </div>
  );
}

export default CreateMatch;