const { msg } = require("./i18n");
const crypto = require("crypto");
const pool = require("../database/db");

// Tajni ključ za link privatnog termina
const newShareToken = () => crypto.randomBytes(16).toString("hex");

// Da li korisnik (može biti i neprijavljen) sme da vidi termin.
// Javni termin vide svi. Privatni: ključ iz linka, kreator, igrači,
// lista čekanja i pozvani.
const canViewMatch = async (matchId, userId, key) => {
  const result = await pool.query(
    `SELECT
       NOT m.is_private
       OR (m.share_token IS NOT NULL AND m.share_token = $3)
       OR m.user_id = $2
       OR EXISTS (SELECT 1 FROM match_players WHERE match_id = m.id AND user_id = $2)
       OR EXISTS (SELECT 1 FROM match_waitlist WHERE match_id = m.id AND user_id = $2)
       OR EXISTS (SELECT 1 FROM match_invites WHERE match_id = m.id AND user_id = $2)
       AS visible
     FROM matches m
     WHERE m.id = $1`,
    [matchId, userId || null, typeof key === "string" ? key : null]
  );

  return Boolean(result.rows[0]?.visible);
};

// Middleware za rute termina: privatan termin bez prava pristupa izgleda
// kao da ne postoji (404), da se ne bi moglo proveravati koji ID-jevi postoje.
// Ključ dolazi iz ?key= u adresi.
const requireVisible = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || !(await canViewMatch(id, req.user?.id, req.query.key))) {
      return res.status(404).json({
        success: false,
        message: msg("common.thisGameDoesntExist"),
      });
    }

    next();

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: msg("common.serverError"),
    });
  }
};

module.exports = {
  newShareToken,
  canViewMatch,
  requireVisible,
};
