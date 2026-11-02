const pool = require("../database/db");

// Serija termina (ako postoji i aktivna je) i da li je korisnik igrač termina
const getSeriesInfo = async (match_id, user_id) => {
  const result = await pool.query(
    `SELECT
       matches.series_id,
       COALESCE(match_series.active, false) AS active,
       EXISTS (
         SELECT 1 FROM match_players
         WHERE match_id = matches.id AND user_id = $2
       ) AS joined,
       EXISTS (
         SELECT 1 FROM series_regulars
         WHERE series_id = matches.series_id AND user_id = $2
       ) AS regular
     FROM matches
     LEFT JOIN match_series ON match_series.id = matches.series_id
     WHERE matches.id = $1`,
    [match_id, user_id]
  );

  return result.rows[0];
};

// Da li sam stalni igrač serije kojoj termin pripada
const getRegular = async (req, res) => {
  try {
    const info = await getSeriesInfo(req.params.id, req.user.id);

    if (!info) {
      return res.status(404).json({
        success: false,
        message: "Termin ne postoji.",
      });
    }

    res.json({
      success: true,
      series: info.active,
      regular: info.regular,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Greška servera.",
    });
  }
};

// Uključuje/isključuje stalno mesto u seriji (regular: true/false)
const setRegular = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;
    const { regular } = req.body;

    if (typeof regular !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Neispravan zahtev.",
      });
    }

    const info = await getSeriesInfo(id, user_id);

    if (!info) {
      return res.status(404).json({
        success: false,
        message: "Termin ne postoji.",
      });
    }

    if (!info.series_id || !info.active) {
      return res.status(400).json({
        success: false,
        message: "Ovaj termin se ne ponavlja.",
      });
    }

    if (regular) {
      if (!info.joined) {
        return res.status(400).json({
          success: false,
          message: "Prvo se prijavi na termin.",
        });
      }

      await pool.query(
        `INSERT INTO series_regulars(series_id, user_id)
         VALUES($1, $2)
         ON CONFLICT DO NOTHING`,
        [info.series_id, user_id]
      );
    } else {
      await pool.query(
        "DELETE FROM series_regulars WHERE series_id = $1 AND user_id = $2",
        [info.series_id, user_id]
      );
    }

    res.json({
      success: true,
      regular,
      message: regular
        ? "Imaš stalno mesto: biće ti rezervisano i u sledećim terminima."
        : "Stalno mesto je isključeno.",
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Greška servera.",
    });
  }
};

module.exports = {
  getRegular,
  setRegular,
};
