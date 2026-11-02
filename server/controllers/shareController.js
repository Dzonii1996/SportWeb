const pool = require("../database/db");
const { describeMatch } = require("../utils/notify");

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

const page = ({ title, description, url }) => {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const u = escapeHtml(url);

  return `<!doctype html>
<html lang="sr">
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
    const id = Number(req.params.id);

    const result = Number.isInteger(id)
      ? await pool.query(
          `SELECT
             matches.*,
             users.name AS creator_name,
             (SELECT COUNT(*) FROM match_players WHERE match_id = matches.id) AS players
           FROM matches
           JOIN users ON users.id = matches.user_id
           WHERE matches.id = $1`,
          [id]
        )
      : { rows: [] };

    const found = result.rows[0];
    const key = typeof req.query.key === "string" ? req.query.key : null;

    // Privatni termin bez ispravnog ključa izgleda kao da ne postoji
    const match =
      found && (!found.is_private || (found.share_token && key === found.share_token))
        ? found
        : null;

    if (!match) {
      return res.status(404).type("html").send(
        page({
          title: "Termin ne postoji",
          description: "Ovaj termin je otkazan ili ne postoji.",
          url: `${frontendUrl()}/matches`,
        })
      );
    }

    const free = Math.max(0, match.max_players - Number(match.players));
    const emoji = match.sport === "Košarka" ? "🏀" : "⚽";

    res.type("html").send(
      page({
        title: `${emoji} ${match.sport} · ${
          free === 0 ? "popunjeno" : `slobodno još ${free}`
        }`,
        description: `${describeMatch(match)} · organizuje ${match.creator_name}. Prijavi se na SportWeb-u.`,
        url: `${frontendUrl()}/matches/${match.id}${
          match.is_private ? `?key=${match.share_token}` : ""
        }`,
      })
    );

  } catch (error) {
    console.error(error);
    res.status(500).send("Greška servera.");
  }
};

module.exports = {
  shareMatch,
};
