const { msg, render } = require("../utils/i18n");
const { findSharedMatch } = require("../services/shareService");
const { describeMatch } = require("../utils/notify");
const { SPORT_EMOJI } = require("../utils/fields");

// Adresa frontenda na koju link vodi. Za produkciju postavi FRONTEND_URL u .env
const frontendUrl = () =>
  (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");

const escapeHtml = (text) =>
  String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const page = ({ title, description, url, language }) => {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const u = escapeHtml(url);

  return `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="SportWeb">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${u}">
<meta http-equiv="refresh" content="0; url=${u}">
</head>
<body>
<p><a href="${u}">${t}</a></p>
<script>location.replace(${JSON.stringify(url)});</script>
</body>
</html>`;
};

// Link za deljenje termina: Viber/WhatsApp čitaju naslov i opis za pregled,
// a čovek se odmah prebacuje na stranicu termina u aplikaciji
const shareMatch = async (req, res) => {
  try {
    const match = await findSharedMatch(req.params.id, req.query.key);

    if (!match) {
      return res.status(404).type("html").send(
        page({
          title: render(msg("share.thisGameDoesntExist"), req.language),
          language: req.language,
          description: render(msg("share.thisGameWasCancelledOr"), req.language),
          url: `${frontendUrl()}/matches`,
        })
      );
    }

    const free = Math.max(0, match.max_players - Number(match.players));
    const emoji = SPORT_EMOJI[match.sport] ?? "🏅";

    res.type("html").send(
      page({
        title: render(
          free === 0
            ? msg("share.full", { emoji, sport: match.sport })
            : msg("share.spotsLeft", { emoji, sport: match.sport, n: free }),
          req.language
        ),
        language: req.language,
        description: render(
          msg("share.organizedByJoinOnSportweb", { match: describeMatch(match), name: match.creator_name }),
          req.language
        ),
        url: `${frontendUrl()}/matches/${match.id}${
          match.is_private ? `?key=${match.share_token}` : ""
        }`,
      })
    );

  } catch (error) {
    console.error(error);
    res.status(500).send(render(msg("common.serverError"), req.language));
  }
};

module.exports = {
  shareMatch,
};
