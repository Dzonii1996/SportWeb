import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { User, Mail, CalendarDays, Users } from "lucide-react";
import { API_URL } from "../config";
import { authHeader } from "../utils/auth";
import { useTranslation } from "react-i18next";

function PublicProfile() {
  const { t } = useTranslation();

  const { id } = useParams();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/users/${id}`, { headers: authHeader() })
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
       {t("common.loading")}
      </div>
    );
  }

  if (!profile || !profile.success) {
    return (
      <div className="text-center mt-20">
        <h1 className="text-2xl font-bold">
         {t("publicProfile.userNotFound")}
        </h1>

        <Link
          to="/matches"
          className="inline-block mt-5 bg-green-600 text-white px-5 py-3 rounded-xl"
        >
         {t("common.backToGames")}
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
             {t("publicProfile.memberOfTheSportwebCommunity")}
            </p>

          </div>

          {/* Informacije */}
          <div className="p-8 space-y-5">

            <div className="flex items-center gap-4">
              <User className="text-green-600" />
              <div>
                <p className="text-sm text-gray-500">
                 {t("common.name")}
                </p>
                <p className="font-semibold">
                  {user.name}
                </p>
              </div>
            </div>

            {/* Server šalje email samo kad vlasnik gleda svoj profil */}
            {user.email && (
            <div className="flex items-center gap-4">
              <Mail className="text-green-600" />
              <div>
                <p className="text-sm text-gray-500">
                 {t("publicProfile.emailOnlyYouCanSee")}
                </p>
                <p className="font-semibold">
                  {user.email}
                </p>
              </div>
            </div>
            )}

            <div className="border-t pt-6">

              <h2 className="text-xl font-bold mb-5">
               {t("publicProfile.stats")}
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
                   {t("publicProfile.gamesCreated")}
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
                   {t("publicProfile.gamesJoined")}
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
                   {t("publicProfile.gamesPlayed")}
                  </p>
                </div>

                <div className="bg-yellow-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-700">
                    {profile.stats.fairPlay === null
                      ? "—"
                      : `${profile.stats.fairPlay}%`}
                  </p>
                  <p className="text-gray-600 text-sm">
                   {t("publicProfile.fairPlay")}
                    {profile.stats.fair + profile.stats.unfair > 0 &&
                      t("publicProfile.ratings", { value: profile.stats.fair + profile.stats.unfair })}
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
                   {t("publicProfile.noShows")}
                  </p>
                </div>

              </div>

              {/* Učinak iz upisanih rezultata */}
              {profile.stats.wins + profile.stats.draws + profile.stats.losses > 0 && (
                <div className="mt-4 bg-gray-50 rounded-xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-gray-500">{t("publicProfile.recordWDL")}</p>
                      <p className="text-xl font-bold">
                        <span className="text-green-700">{profile.stats.wins}</span>
                        {" / "}
                        <span className="text-gray-600">{profile.stats.draws}</span>
                        {" / "}
                        <span className="text-red-600">{profile.stats.losses}</span>
                        <span className="text-base font-medium text-gray-500">
                          {" "}{t("publicProfile.wins", { winRate: profile.stats.winRate })}
                        </span>
                      </p>
                    </div>

                    {profile.stats.streak >= 2 && (
                      <span className="bg-orange-100 text-orange-700 font-semibold px-3 py-1 rounded-full text-sm">
                       {t("publicProfile.winsInARow", { streak: profile.stats.streak })}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 mt-3">
                    <span className="text-sm text-gray-500 mr-1">{t("publicProfile.form")}</span>
                    {profile.stats.form.map((o, i) => (
                      <span
                        key={i}
                        title={{ W: t("publicProfile.win"), D: t("publicProfile.draw"), L: t("publicProfile.loss") }[o]}
                        className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-white ${
                          { W: "bg-green-600", D: "bg-gray-400", L: "bg-red-500" }[o]
                        }`}
                      >
                        {{ W: "P", D: "N", L: "I" }[o]}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            </div>

            <Link
              to="/matches"
              className="block w-full text-center bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold"
            >
             {t("publicProfile.backToGames")}
            </Link>

          </div>

        </div>

      </div>

    </div>
  );
}

export default PublicProfile;