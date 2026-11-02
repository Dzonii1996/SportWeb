import { useEffect, useState } from "react";
import MatchCard from "../components/MatchCard";
import { API_URL } from "../config";
import { isPastMatch } from "../utils/matchDate";

function MyMatches() {
  const [createdMatches, setCreatedMatches] = useState([]);
  const [joinedMatches, setJoinedMatches] = useState([]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));

    if (!user) return;

    fetch(`${API_URL}/api/users/${user.id}/matches`)
      .then((res) => res.json())
      .then((data) => {
        setCreatedMatches(data.created);
        setJoinedMatches(data.joined);
      })
      .catch((err) => console.error(err));
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-8">Moji termini</h1>

      <h2 className="text-2xl font-semibold mb-4">
        Termini koje sam napravio
      </h2>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {createdMatches.length > 0 ? (
          createdMatches.map((match) => (
            <MatchCard
              key={match.id}
              id={match.id}
              creatorId={match.user_id}
              creatorName={match.creator_name}
              creatorAvatar={match.creator_avatar}
              sport={match.sport}
              location={match.location}
              date={match.match_date}
              time={match.match_time}
              players={Number(match.players || 0)}
              maxPlayers={match.max_players}
              isPast={isPastMatch(match.match_date, match.match_time)}
              repeatWeekly={match.repeat_weekly}
              fieldPrice={match.field_price}
              scoreA={match.score_a}
              scoreB={match.score_b}
              isPrivate={match.is_private}
            />
          ))
        ) : (
          <p>Niste napravili nijedan termin.</p>
        )}
      </div>

      <h2 className="text-2xl font-semibold mb-4">
        Termini na koje sam prijavljen
      </h2>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {joinedMatches.length > 0 ? (
          joinedMatches.map((match) => (
            <MatchCard
              key={match.id}
              id={match.id}
              creatorId={match.user_id}
              creatorName={match.creator_name}
              creatorAvatar={match.creator_avatar}
              sport={match.sport}
              location={match.location}
              date={match.match_date}
              time={match.match_time}
              players={Number(match.players || 0)}
              maxPlayers={match.max_players}
              isPast={isPastMatch(match.match_date, match.match_time)}
              repeatWeekly={match.repeat_weekly}
              fieldPrice={match.field_price}
              scoreA={match.score_a}
              scoreB={match.score_b}
              isPrivate={match.is_private}
            />
          ))
        ) : (
          <p>Niste prijavljeni ni na jedan termin.</p>
        )}
      </div>
    </div>
  );
}

export default MyMatches;