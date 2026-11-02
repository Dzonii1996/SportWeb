const pool = require("../database/db");
const { promoteFromWaitlist } = require("./waitlistController");
const {
  describeMatch,
  notifyUsers,
  matchAudience,
} = require("../utils/notify");

const SPORTS = ["Fudbal", "Košarka"];
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 30;
const MAX_DAYS_AHEAD = 365;

// Proverava podatke termina; vraća poruku greške ili null ako je sve u redu
const validateMatch = ({ sport, location, match_date, match_time, max_players }) => {
  if (sport !== undefined && !SPORTS.includes(sport)) {
    return "Nepoznat sport.";
  }

  if (typeof location !== "string") {
    return "Neispravna lokacija.";
  }

  const place = location.trim();

  if (place.length < 2 || place.length > 100) {
    return "Lokacija mora imati između 2 i 100 znakova.";
  }

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(match_date || "");
  const timeMatch = /^(\d{2}):(\d{2})(:\d{2})?$/.exec(match_time || "");

  if (!dateMatch) {
    return "Neispravan datum.";
  }

  if (!timeMatch) {
    return "Neispravno vreme.";
  }

  const [, y, mo, d] = dateMatch.map(Number);
  const [, h, mi] = timeMatch.map(Number);
  const start = new Date(y, mo - 1, d, h, mi);

  // new Date "popravlja" npr. 31. 2. u 3. 3, pa proveravamo da li je datum stvaran
  if (
    start.getFullYear() !== y ||
    start.getMonth() !== mo - 1 ||
    start.getDate() !== d ||
    h > 23 ||
    mi > 59
  ) {
    return "Neispravan datum ili vreme.";
  }

  if (start < new Date()) {
    return "Termin ne može biti u prošlosti.";
  }

  const latest = new Date();
  latest.setDate(latest.getDate() + MAX_DAYS_AHEAD);

  if (start > latest) {
    return "Termin može biti najviše godinu dana unapred.";
  }

  const playersNum = Number(max_players);

  if (
    !Number.isInteger(playersNum) ||
    playersNum < MIN_PLAYERS ||
    playersNum > MAX_PLAYERS
  ) {
    return `Broj igrača mora biti između ${MIN_PLAYERS} i ${MAX_PLAYERS}.`;
  }

  return null;
};





const createMatch = async (req, res) => {

    
  try {
    const {
  sport,
  location,
  match_date,
  match_time,
  max_players,
} = req.body;
    const user_id = req.user.id;

    if (
      !sport ||
      !location ||
      !match_date ||
      !match_time ||
      !max_players
    ) {
      return res.status(400).json({
        success: false,
        message: "Popuni sva polja.",
      });
    }

    const validationError = validateMatch(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

   const result = await pool.query(
  `INSERT INTO matches
  (user_id, sport, location, match_date, match_time, max_players)
  VALUES ($1,$2,$3,$4,$5,$6)
  RETURNING *`,
  [
    user_id,
    sport,
    location.trim(),
    match_date,
    match_time,
    max_players
  ]
);

    res.status(201).json({
      success: true,
      message: "Termin uspešno kreiran.",
      match: result.rows[0],
    });

  }catch (error) {
  console.error("DATABASE ERROR:", error);

  res.status(500).json({
    success: false,
    message: error.message,
  });
}
};

const getMatches = async (req, res) => {
  try {

   const result = await pool.query(`
SELECT
  matches.*,
  users.name AS creator_name,
  users.avatar AS creator_avatar,
  COUNT(match_players.user_id) AS players
FROM matches
JOIN users
  ON users.id = matches.user_id
LEFT JOIN match_players
  ON match_players.match_id = matches.id
GROUP BY matches.id, users.name, users.avatar
ORDER BY match_date`
);

    res.json({
      success: true,
      matches: result.rows,
    });

  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Greška servera.",
    });
  }
};
const getMatch = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
         matches.*,
         users.name AS creator_name,
         users.avatar AS creator_avatar,
         COUNT(match_players.user_id) AS players
       FROM matches
       JOIN users
         ON users.id = matches.user_id
       LEFT JOIN match_players
         ON match_players.match_id = matches.id
       WHERE matches.id = $1
       GROUP BY matches.id, users.name, users.avatar`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Termin ne postoji.",
      });
    }

    res.json({
      success: true,
      match: result.rows[0],
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Greška servera.",
    });
  }
};
const deleteMatch = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    // Provera da li termin postoji
    const match = await pool.query(
      "SELECT * FROM matches WHERE id = $1",
      [id]
    );

    if (match.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Termin ne postoji.",
      });
    }

    // Samo kreator može da obriše
    if (match.rows[0].user_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: "Nemate dozvolu za brisanje ovog termina.",
      });
    }

    // Ko treba da sazna za otkazivanje; posle brisanja prijave više ne postoje
    const audience = await matchAudience(id, {
      exceptUserId: user_id,
      includeWaitlist: true,
    });

    await pool.query(
      "DELETE FROM matches WHERE id = $1",
      [id]
    );

    try {
      await notifyUsers(
        pool,
        audience,
        `❌ Termin je otkazan: ${describeMatch(match.rows[0])}.`
      );
    } catch (error) {
      console.error("Greška pri slanju notifikacija:", error);
    }

    res.json({
      success: true,
      message: "Termin uspešno obrisan.",
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
const updateMatch = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      location,
      match_date,
      match_time,
      max_players,
    } = req.body;
    const user_id = req.user.id;

    const match = await pool.query(
      "SELECT * FROM matches WHERE id = $1",
      [id]
    );

    if (match.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Termin ne postoji.",
      });
    }

    if (match.rows[0].user_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: "Nemate dozvolu.",
      });
    }

    const validationError = validateMatch({
      location,
      match_date,
      match_time,
      max_players,
    });

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const playersCount = await pool.query(
      "SELECT COUNT(*) FROM match_players WHERE match_id = $1",
      [id]
    );

    if (Number(max_players) < Number(playersCount.rows[0].count)) {
      return res.status(400).json({
        success: false,
        message: `Na termin je već prijavljeno ${playersCount.rows[0].count} igrača.`,
      });
    }

    const result = await pool.query(
      `UPDATE matches
       SET
         location = $1,
         match_date = $2,
         match_time = $3,
         max_players = $4
       WHERE id = $5
       RETURNING *`,
      [
        location.trim(),
        match_date,
        match_time,
        max_players,
        id,
      ]
    );

    // Igrače obaveštavamo samo ako se promenilo mesto ili vreme,
    // a pre popunjavanja sa liste, da novi igrači ne dobiju ovu poruku
    const before = describeMatch(match.rows[0]);
    const after = describeMatch(result.rows[0]);

    if (before !== after) {
      try {
        const audience = await matchAudience(id, {
          exceptUserId: user_id,
          includeWaitlist: true,
        });

        await notifyUsers(
          pool,
          audience,
          `✏️ Termin je izmenjen: ${after} (ranije: ${before}).`,
          id
        );
      } catch (error) {
        console.error("Greška pri slanju notifikacija:", error);
      }
    }

    // Ako je kreator povećao broj mesta, popunjavamo ih sa liste čekanja
    try {
      await promoteFromWaitlist(id);
    } catch (error) {
      console.error("Greška pri popunjavanju sa liste čekanja:", error);
    }

    res.json({
      success: true,
      message: "Termin uspešno izmenjen.",
      match: result.rows[0],
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
    createMatch,
    getMatches,
    getMatch,
    deleteMatch,
    updateMatch
};