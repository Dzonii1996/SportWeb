const { msg } = require("../utils/i18n");
const jwt = require("jsonwebtoken");
const pool = require("../database/db");

const sessionExpired = (res) =>
  res.status(401).json({
    success: false,
    message: msg("common.yourSessionHasExpiredPlease"),
  });

// Da li token i dalje važi: nalog postoji, a token nije stariji od promene lozinke.
// iat je u sekundama; poredimo na nivou sekunde, da token izdat
// odmah posle promene lozinke (u istoj sekundi) i dalje važi.
const isTokenValid = async (decoded) => {
  // Epoch sekunde računa baza, u istoj vremenskoj zoni u kojoj je NOW() upisan
  const user = await pool.query(
    `SELECT FLOOR(EXTRACT(EPOCH FROM password_changed_at::timestamptz))::bigint AS changed_at
     FROM users WHERE id = $1`,
    [decoded.id]
  );

  if (user.rows.length === 0) return false;

  const changedAt = user.rows[0].changed_at;

  return changedAt === null || decoded.iat >= Number(changedAt);
};

// Proverava JWT iz "Authorization: Bearer <token>" i postavlja req.user.
// Token izdat pre poslednje promene lozinke više ne važi.
const protect = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: msg("common.youMustBeSignedIn"),
    });
  }

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return sessionExpired(res);
  }

  try {
    if (!(await isTokenValid(decoded))) {
      return sessionExpired(res);
    }
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: msg("common.serverError"),
    });
  }

  req.user = {
    id: decoded.id,
    email: decoded.email,
  };

  next();
};

// Za javne rute: ako je poslat ispravan token postavlja req.user,
// a bez tokena (ili sa neispravnim ili opozvanim) pušta zahtev dalje kao anoniman
const optionalAuth = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (await isTokenValid(decoded)) {
        req.user = {
          id: decoded.id,
          email: decoded.email,
        };
      }
    } catch (error) {
      // Neispravan token na javnoj ruti: nastavljamo bez korisnika
    }
  }

  next();
};

// Dozvoljava pristup samo vlasniku naloga iz :id parametra
const onlySelf = (req, res, next) => {
  if (Number(req.params.id) !== Number(req.user.id)) {
    return res.status(403).json({
      success: false,
      message: msg("common.youDontHavePermission"),
    });
  }

  next();
};

module.exports = {
  protect,
  optionalAuth,
  onlySelf,
};
