import { useState } from "react";
import { Share2, Link2, Check } from "lucide-react";
import { API_URL } from "../config";
import { matchStart } from "../utils/matchDate";

// Deljenje termina u grupe. Link ide preko servera (/share/...), koji
// Viber-u i WhatsApp-u daje naslov i opis za pregled, pa vodi na termin.
function ShareMatch({ match, freeSpots }) {
  const [copied, setCopied] = useState(false);

  // Privatni termin: link nosi ključ, bez njega se termin ne otvara
  const shareUrl = `${API_URL}/share/matches/${match.id}${
    match.is_private && match.share_token ? `?key=${match.share_token}` : ""
  }`;

  const when = matchStart(match.match_date, match.match_time).toLocaleDateString(
    // sr-Latn: bez toga Chrome piše dane ćirilicom ("четвртак")
    "sr-Latn-RS",
    { weekday: "long", day: "numeric", month: "numeric" }
  );
  const emoji = match.sport === "Košarka" ? "🏀" : "⚽";
  const spots =
    freeSpots > 0
      ? `Fali još ${freeSpots} ${freeSpots === 1 ? "igrač" : "igrača"}!`
      : "Popunjeno, ali ima liste čekanja.";

  const text = `${emoji} ${match.sport} – ${match.location}, ${when} u ${match.match_time.slice(0, 5)}. ${spots} Prijavi se: ${shareUrl}`;
  const encoded = encodeURIComponent(text);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Kopiraj tekst:", text);
    }
  };

  // Na telefonu: sistemski meni za deljenje (sve aplikacije)
  const nativeShare = () =>
    navigator.share({ title: `${emoji} ${match.sport}`, text }).catch(() => {});

  const button = "flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition";

  return (
    <div>
      <p className="text-sm font-semibold text-gray-600 mb-2">
        Pozovi ekipu
      </p>

      <div className="grid grid-cols-3 gap-2">
        <a
          href={`viber://forward?text=${encoded}`}
          className={`${button} bg-[#7360f2] hover:bg-[#5f4ee0] text-white`}
        >
          Viber
        </a>

        <a
          href={`https://wa.me/?text=${encoded}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${button} bg-[#25d366] hover:bg-[#1ebe5b] text-white`}
        >
          WhatsApp
        </a>

        {typeof navigator !== "undefined" && navigator.share ? (
          <button onClick={nativeShare} className={`${button} bg-gray-100 hover:bg-gray-200`}>
            <Share2 size={16} />
            Podeli
          </button>
        ) : (
          <button onClick={copyLink} className={`${button} bg-gray-100 hover:bg-gray-200`}>
            {copied ? <Check size={16} className="text-green-600" /> : <Link2 size={16} />}
            {copied ? "Kopirano" : "Kopiraj"}
          </button>
        )}
      </div>
    </div>
  );
}

export default ShareMatch;
