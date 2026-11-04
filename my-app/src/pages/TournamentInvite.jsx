import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { API_URL } from "../config";
import { authHeader } from "../utils/auth";
import { sportIcon } from "../utils/tournaments";
import { useTranslation } from "react-i18next";

// Pozivnica u ekipu: kapiten deli link, igrač se pridružuje jednim klikom
function TournamentInvite() {
  const { t } = useTranslation();

  const { token } = useParams();
  const navigate = useNavigate();
  const loggedIn = Boolean(localStorage.getItem("token"));

  const [team, setTeam] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/tournaments/invite/${token}`)
      .then((res) => res.json())
      .then((data) => (data.success ? setTeam(data.team) : setNotFound(true)))
      .catch(() => setNotFound(true));
  }, [token]);

  const join = async () => {
    const res = await fetch(`${API_URL}/api/tournaments/invite/${token}/join`, {
      method: "POST",
      headers: authHeader(),
    });
    const data = await res.json();

    alert(data.message);

    if (data.success) navigate(`/turniri/${data.tournament_id}`);
  };

  if (notFound) {
    return <div className="max-w-xl mx-auto p-6 text-center mt-10 text-xl">{t("tournamentInvite.theLinkIsntValid")}</div>;
  }

  if (!team) {
    return <div className="text-center mt-20 text-xl">{t("common.loading")}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center py-10 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md text-center space-y-4 h-fit">
        <p className="text-5xl">{sportIcon(team.sport)}</p>
        <h1 className="text-2xl font-bold">{t("tournamentInvite.invitationToTeam", { name: team.name })}</h1>
        <p className="text-gray-600">
          {t("tournamentInvite.tournament")} <span className="font-semibold">{team.tournament_name}</span>
        </p>
        <p className="text-gray-600">{t("tournamentInvite.playersOnTheTeam", { players_count: team.players_count, max_roster: team.max_roster })}</p>

        {loggedIn ? (
          <button
            onClick={join}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold"
          >
            {t("tournamentInvite.joinTheTeam")}
          </button>
        ) : (
          <p className="text-gray-700">
            <Link to="/login" className="text-green-700 font-semibold hover:underline">
              {t("common.signIn")}
            </Link>{" "}
            {t("tournamentInvite.andThenOpenThisLink")}
          </p>
        )}
      </div>
    </div>
  );
}

export default TournamentInvite;
