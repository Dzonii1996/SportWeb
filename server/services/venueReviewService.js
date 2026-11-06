const pool = require("../database/db");
const { HttpError } = require("../utils/http");
const { isAdmin } = require("../utils/admin");

const MAX_COMMENT = 1000;

// Ocene postoje samo za odobrene terene
const findApprovedVenue = async (id) => {
  if (!Number.isInteger(Number(id))) return null;

  const result = await pool.query(
    "SELECT id FROM venues WHERE id = $1 AND status = 'approved'",
    [id]
  );

  return result.rows[0] || null;
};

const notFound = () => new HttpError(404, "Teren ne postoji.");

// Ocene terena, najnovije prve. Uz svaku: da li je autor igrao termin na tom terenu.
// Prijavljeni korisnik dobija i svoju ocenu (my_review) i da li sme da briše tuđe (admin).
const getReviews = async ({ id, userId }) => {
  const venue = await findApprovedVenue(id);

  if (!venue) throw notFound();

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

  return {
    reviews: result.rows,
    distribution,
    my_review: result.rows.find((r) => Number(r.user_id) === Number(userId)) || null,
    can_moderate: await isAdmin(userId),
  };
};

// Upis ili izmena sopstvene ocene (jedna po korisniku i terenu)
const saveReview = async ({ id, userId, body }) => {
  const venue = await findApprovedVenue(id);

  if (!venue) throw notFound();

  const rating = Number(body.rating);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new HttpError(400, "Ocena mora biti od 1 do 5 zvezdica.");
  }

  const raw = body.comment;
  const comment = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;

  if (raw !== undefined && raw !== null && typeof raw !== "string") {
    throw new HttpError(400, "Neispravan komentar.");
  }

  if (comment && comment.length > MAX_COMMENT) {
    throw new HttpError(400, `Komentar može imati najviše ${MAX_COMMENT} znakova.`);
  }

  const result = await pool.query(
    `INSERT INTO venue_reviews(venue_id, user_id, rating, comment)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (venue_id, user_id)
     DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = NOW()
     RETURNING *, (xmax = 0) AS created`,
    [venue.id, userId, rating, comment]
  );
  const { created, ...review } = result.rows[0];

  return {
    httpStatus: created ? 201 : 200,
    message: created ? "Hvala na oceni!" : "Ocena je izmenjena.",
    review,
  };
};

// Autor briše svoju ocenu; admin može da obriše bilo koju (npr. uvredljiv komentar)
const deleteReview = async ({ reviewId, id, userId }) => {
  const result = await pool.query(
    "SELECT user_id FROM venue_reviews WHERE id = $1 AND venue_id = $2",
    [Number(reviewId) || 0, Number(id) || 0]
  );
  const review = result.rows[0];

  if (!review) {
    throw new HttpError(404, "Ocena ne postoji.");
  }

  if (Number(review.user_id) !== Number(userId) && !(await isAdmin(userId))) {
    throw new HttpError(403, "Nemate dozvolu.");
  }

  await pool.query("DELETE FROM venue_reviews WHERE id = $1", [reviewId]);

  return {
    message: "Ocena je obrisana.",
  };
};

module.exports = {
  getReviews,
  saveReview,
  deleteReview,
};
