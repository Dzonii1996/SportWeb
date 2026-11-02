import { useEffect, useState } from "react";
import { User, Mail, CalendarDays, Users } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { authHeader, logout } from "../utils/auth";

function Profile() {
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user"));

  const [profile, setProfile] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    fetch(`http://localhost:5000/api/users/${user.id}`)
      .then((res) => res.json())
      .then((data) => setProfile(data))
      .catch(console.error);
  }, [navigate, user]);

  const uploadAvatar = async () => {
    if (!selectedFile) {
      alert("Izaberite sliku.");
      return;
    }

    const formData = new FormData();
    formData.append("avatar", selectedFile);

    try {
      const res = await fetch(
        `http://localhost:5000/api/users/${user.id}/avatar`,
        {
          method: "POST",
          headers: authHeader(),
          body: formData,
        }
      );

      const data = await res.json();

      alert(data.message || "Profilna slika uspešno sačuvana.");

      if (data.success) {
        window.location.reload();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (!profile) {
    return (
      <div className="text-center mt-20 text-xl">
        Učitavanje...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto mt-10 px-4">

      <div className="bg-white rounded-2xl shadow-xl p-8">

        <div className="flex flex-col items-center mb-8">

          <img
            src={
              profile.user.avatar
                ? `http://localhost:5000${profile.user.avatar}`
                : "/default-avatar.png"
            }
            alt="Profil"
            className="w-32 h-32 rounded-full object-cover border-4 border-green-600"
          />

          <input
            type="file"
            accept="image/*"
            className="mt-4"
            onChange={(e) => setSelectedFile(e.target.files[0])}
          />

          <button
            onClick={uploadAvatar}
            className="mt-3 bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-xl font-semibold"
          >
            📷 Sačuvaj profilnu sliku
          </button>

        </div>

        <h1 className="text-3xl font-bold text-center mb-8">
          Moj profil
        </h1>

        <div className="space-y-5">

          <div className="flex items-center gap-4">
            <User className="text-green-600" />
            <span className="text-lg">
              {profile.user.name}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Mail className="text-green-600" />
            <span className="text-lg">
              {profile.user.email}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <CalendarDays className="text-green-600" />
            <span>
              Kreiranih termina:
              <b> {profile.stats.created}</b>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Users className="text-green-600" />
            <span>
              Prijavljenih termina:
              <b> {profile.stats.joined}</b>
            </span>
          </div>

        </div>

        <div className="mt-10 space-y-3">

          <Link
            to="/my-matches"
            className="block w-full text-center bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold"
          >
            📅 Moji termini
          </Link>

          <button
            onClick={handleLogout}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-semibold"
          >
            Odjavi se
          </button>

        </div>

      </div>

    </div>
  );
}

export default Profile;