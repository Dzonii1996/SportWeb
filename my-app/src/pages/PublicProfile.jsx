import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { User, Mail, CalendarDays, Users } from "lucide-react";
import { API_URL } from "../config";

function PublicProfile() {
  const { id } = useParams();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/users/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error(error);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="text-center mt-20 text-xl">
        Učitavanje...
      </div>
    );
  }

  if (!profile || !profile.success) {
    return (
      <div className="text-center mt-20">
        <h1 className="text-2xl font-bold">
          Korisnik nije pronađen.
        </h1>

        <Link
          to="/matches"
          className="inline-block mt-5 bg-green-600 text-white px-5 py-3 rounded-xl"
        >
          Nazad na termine
        </Link>
      </div>
    );
  }

  const user = profile.user;

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4">

      <div className="max-w-2xl mx-auto">

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">

          {/* Header */}
          <div className="bg-green-600 text-white p-8 text-center">

            {user.avatar ? (
              <img
                src={`${API_URL}${user.avatar}`}
                alt={user.name}
                className="w-28 h-28 mx-auto rounded-full object-cover border-4 border-white shadow-lg"
              />
            ) : (
              <div className="w-28 h-28 mx-auto rounded-full bg-white text-green-600 flex items-center justify-center text-5xl font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}

            <h1 className="text-3xl font-bold mt-5">
              {user.name}
            </h1>

            <p className="text-green-100 mt-1">
              Član SportWeb zajednice
            </p>

          </div>

          {/* Informacije */}
          <div className="p-8 space-y-5">

            <div className="flex items-center gap-4">
              <User className="text-green-600" />
              <div>
                <p className="text-sm text-gray-500">
                  Ime
                </p>
                <p className="font-semibold">
                  {user.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Mail className="text-green-600" />
              <div>
                <p className="text-sm text-gray-500">
                  Email
                </p>
                <p className="font-semibold">
                  {user.email}
                </p>
              </div>
            </div>

            <div className="border-t pt-6">

              <h2 className="text-xl font-bold mb-5">
                Statistika
              </h2>

              <div className="grid grid-cols-2 gap-4">

                <div className="bg-green-50 rounded-xl p-5 text-center">
                  <CalendarDays
                    className="mx-auto text-green-600 mb-2"
                    size={32}
                  />

                  <p className="text-3xl font-bold text-green-600">
                    {profile.stats.created}
                  </p>

                  <p className="text-gray-600">
                    Kreiranih termina
                  </p>
                </div>

                <div className="bg-blue-50 rounded-xl p-5 text-center">
                  <Users
                    className="mx-auto text-blue-600 mb-2"
                    size={32}
                  />

                  <p className="text-3xl font-bold text-blue-600">
                    {profile.stats.joined}
                  </p>

                  <p className="text-gray-600">
                    Prijavljenih termina
                  </p>
                </div>

              </div>

              {/* Fer plej iz ocena saigrača */}
              <div className="grid grid-cols-3 gap-4 mt-4">

                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold">
                    {profile.stats.played}
                  </p>
                  <p className="text-gray-600 text-sm">
                    Odigranih termina
                  </p>
                </div>

                <div className="bg-yellow-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-700">
                    {profile.stats.fairPlay === null
                      ? "—"
                      : `${profile.stats.fairPlay}%`}
                  </p>
                  <p className="text-gray-600 text-sm">
                    Fer plej
                    {profile.stats.fair + profile.stats.unfair > 0 &&
                      ` (${profile.stats.fair + profile.stats.unfair} ocena)`}
                  </p>
                </div>

                <div
                  className={`rounded-xl p-4 text-center ${
                    profile.stats.noShows > 0 ? "bg-red-50" : "bg-gray-50"
                  }`}
                >
                  <p
                    className={`text-2xl font-bold ${
                      profile.stats.noShows > 0 ? "text-red-600" : ""
                    }`}
                  >
                    {profile.stats.noShows}
                  </p>
                  <p className="text-gray-600 text-sm">
                    Nedolazaka
                  </p>
                </div>

              </div>

            </div>

            <Link
              to="/matches"
              className="block w-full text-center bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold"
            >
              ⚽ Nazad na termine
            </Link>

          </div>

        </div>

      </div>

    </div>
  );
}

export default PublicProfile;