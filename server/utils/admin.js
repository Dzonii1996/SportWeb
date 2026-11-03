const pool = require("../database/db");

// Emailovi iz ADMIN_EMAILS (odvojeni zarezom), mala slova
const adminEmails = () =>
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

// Admin je korisnik sa users.is_admin = true ili sa emailom iz ADMIN_EMAILS
const isAdmin = async (userId) => {
  if (!userId) return false;

  const result = await pool.query(
    `SELECT is_admin OR LOWER(email) = ANY($2::text[]) AS admin
     FROM users WHERE id = $1`,
    [userId, adminEmails()]
  );

  return Boolean(result.rows[0]?.admin);
};

// ID-jevi svih admina (za notifikaciju o novom predlogu terena)
const adminIds = async () => {
  const result = await pool.query(
    "SELECT id FROM users WHERE is_admin OR LOWER(email) = ANY($1::text[])",
    [adminEmails()]
  );

  return result.rows.map((r) => r.id);
};

// Middleware posle protect: pušta dalje samo admina
const requireAdmin = async (req, res, next) => {
  try {
    if (!(await isAdmin(req.user.id))) {
      return res.status(403).json({
        success: false,
        message: "Samo admin može ovo da uradi.",
      });
    }

    next();

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Greška servera.",
    });
  }
};

module.exports = {
  isAdmin,
  adminIds,
  requireAdmin,
};
