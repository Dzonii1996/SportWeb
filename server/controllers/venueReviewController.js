const pool = require("../database/db");
const { isAdmin } = require("../utils/admin");

const MAX_COMMENT = 1000;

const serverError = (res, error) => {
  console.error(error);

  res.status(500).json({
    success: false,
    message: "Greška servera.",
  });
};

// Ocene postoje samo za odobrene terene
const findApprovedVenue = async (id) => {
  if (!Number.isInteger(Number(id))) return null;

  const result = await pool.query(
    "SELECT id FROM venues WHERE id = $1 AND status = 'approved'",
    [id]
  );

  return result.rows[0] || null;
};

const notFound = (res) =>
  res.status(404).json({ success: false, message: "Teren ne postoji." });

// Ocene terena, najnovije prve. Uz svaku: da li je autor igrao termin na tom terenu.
// Prijavljeni korisnik dobija i svoju ocenu (my_review) i da li sme da briše tuđe (admin).
const getReviews = async (req, res) => {
  try {
    const venue = await findApprovedVenue(req.params.id);

    if (!venue) return notFound(res);

    const result = await pool.query(
      `SELECT
         r.id, r.user_id, r.rating, r.comment, r.created_at, r.updated_at,
         u.name AS user_name,
         u.avatar AS user_avatar,
         EXISTS (
           SELECT 1 FROM matches m
           WHERE m.venue_id = r.venue_id
             AND (m.match_date + m.match_time) < NOW()
             AND (m.user_id = r.user_id
                  OR EXISTS (SELECT 1 FROM match_players mp
                             WHERE mp.match_id = m.id AND mp.user_id = r.user_id))
         ) AS played_here
       FROM venue_reviews r
       JOIN users u ON u.id = r.user_id
       WHERE r.venue_id = $1
       ORDER BY r.updated_at DESC, r.id DESC`,
      [venue.id]
    );

    // Koliko ocena ima svaka zvezdica (5 do 1), za grafikon
    const distribution = [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: result.rows.filter((r) => r.rating === stars).length,
    }));

    const userId = req.user?.id;

    res.json({
      success: true,
      reviews: result.rows,
      distribution,
      my_review: result.rows.find((r) => Number(r.user_id) === Number(userId)) || null,
      can_moderate: await isAdmin(userId),
    });

  } catch (error) {
    serverError(res, error);
  }
};

// Upis ili izmena sopstvene ocene (jedna po korisniku i terenu)
const saveReview = async (req, res) => {
  try {
    const venue = await findApprovedVenue(req.params.id);

    if (!venue) return notFound(res);

    const rating = Number(req.body.rating);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Ocena mora biti od 1 do 5 zvezdica.",
      });
    }

    const raw = req.body.comment;
    const comment = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;

    if (raw !== undefined && raw !== null && typeof raw !== "string") {
      return res.status(400).json({ success: false, message: "Neispravan komentar." });
    }

    if (comment && comment.length > MAX_COMMENT) {
      return res.status(400).json({
        success: false,
        message: `Komentar može imati najviše ${MAX_COMMENT} znakova.`,
      });
    }

    const result = await pool.query(
      `INSERT INTO venue_reviews(venue_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (venue_id, user_id)
       DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = NOW()
       RETURNING *, (xmax = 0) AS created`,
      [venue.id, req.user.id, rating, comment]
    );
    const { created, ...review } = result.rows[0];

    res.status(created ? 201 : 200).json({
      success: true,
      message: created ? "Hvala na oceni!" : "Ocena je izmenjena.",
      review,
    });

  } catch (error) {
    serverError(res, error);
  }
};

// Autor briše svoju ocenu; admin može da obriše bilo koju (npr. uvredljiv komentar)
const deleteReview = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT user_id FROM venue_reviews WHERE id = $1 AND venue_id = $2",
      [Number(req.params.reviewId) || 0, Number(req.params.id) || 0]
    );
    const review = result.rows[0];

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Ocena ne postoji.",
      });
    }

    if (Number(review.user_id) !== Number(req.user.id) && !(await isAdmin(req.user.id))) {
      return res.status(403).json({
        success: false,
        message: "Nemate dozvolu.",
      });
    }

    await pool.query("DELETE FROM venue_reviews WHERE id = $1", [req.params.reviewId]);

    res.json({
      success: true,
      message: "Ocena je obrisana.",
    });

  } catch (error) {
    serverError(res, error);
  }
};

module.exports = {
  getReviews,
  saveReview,
  deleteReview,
};
