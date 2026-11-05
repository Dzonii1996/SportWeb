import { useState } from "react";
import { Share2, Link2, Check } from "lucide-react";
import { API_URL } from "../config";
import { matchStart } from "../utils/matchDate";
import { sportEmoji } from "../utils/sports";
import { useTranslation } from "react-i18next";
import { locale, sportLabel } from "../i18n";

// Deljenje termina u grupe. Link ide preko servera (/share/...), koji
// Viber-u i WhatsApp-u daje naslov i opis za pregled, pa vodi na termin.
function ShareMatch({ match, freeSpots }) {
  const { t } = useTranslation();

  const [copied, setCopied] = useState(false);

  // Privatni termin: link nosi ključ, bez njega se termin ne otvara
  const shareUrl = `${API_URL}/share/matches/${match.id}${
    match.is_private && match.share_token ? `?key=${match.share_token}` : ""
  }`;

  const when = matchStart(match.match_date, match.match_time).toLocaleDateString(
    // sr-Latn: bez toga Chrome piše dane ćirilicom ("четвртак")
    locale(),
    { weekday: "long", day: "numeric", month: "numeric" }
  );
  const emoji = sportEmoji(match.sport);
  const spots =
    freeSpots > 0
      ? t("shareMatch.moreNeeded", { freeSpots, value: freeSpots === 1 ? t("shareMatch.player") : t("shareMatch.players") })
      : t("shareMatch.fullButTheresAWaitlist");

  const text = t("shareMatch.atJoin", { emoji, sport: sportLabel(match.sport), location: match.location, when, value: match.match_time.slice(0, 5), spots, shareUrl });
  const encoded = encodeURIComponent(text);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("shareMatch.copyTheText"), text);
    }
  };

  // Na telefonu: sistemski meni za deljenje (sve aplikacije)
  const nativeShare = () =>
    navigator.share({ title: `${emoji} ${sportLabel(match.sport)}`, text }).catch(() => {});

  const button = "flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition";

  return (
    <div>
      <p className="text-sm font-semibold text-gray-600 mb-2">
        {t("shareMatch.inviteTheTeam")}
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
            {t("shareMatch.share")}
          </button>
        ) : (
          <button onClick={copyLink} className={`${button} bg-gray-100 hover:bg-gray-200`}>
            {copied ? <Check size={16} className="text-green-600" /> : <Link2 size={16} />}
            {copied ? t("shareMatch.copied") : t("shareMatch.copy")}
          </button>
        )}
      </div>
    </div>
  );
}

export default ShareMatch;
