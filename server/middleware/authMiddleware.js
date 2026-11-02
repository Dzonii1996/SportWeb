const jwt = require("jsonwebtoken");
const pool = require("../database/db");

const sessionExpired = (res) =>
  res.status(401).json({
    success: false,
    message: "Sesija je istekla. Prijavite se ponovo.",
  });

// Proverava JWT iz "Authorization: Bearer <token>" i postavlja req.user.
// Token izdat pre poslednje promene lozinke više ne važi.
const protect = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Morate biti prijavljeni.",
    });
  }

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return sessionExpired(res);
  }

  try {
    // Epoch sekunde računa baza, u istoj vremenskoj zoni u kojoj je NOW() upisan
    const user = await pool.query(
      `SELECT FLOOR(EXTRACT(EPOCH FROM password_changed_at::timestamptz))::bigint AS changed_at
       FROM users WHERE id = $1`,
      [decoded.id]
    );

    // Obrisan nalog
    if (user.rows.length === 0) {
      return sessionExpired(res);
    }

    // iat je u sekundama; poredimo na nivou sekunde, da token izdat
    // odmah posle promene lozinke (u istoj sekundi) i dalje važi
    const changedAt = user.rows[0].changed_at;

    if (changedAt !== null && decoded.iat < Number(changedAt)) {
      return sessionExpired(res);
    }
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Greška servera.",
    });
  }

  req.user = {
    id: decoded.id,
    email: decoded.email,
  };

  next();
};

// Za javne rute: ako je poslat ispravan token postavlja req.user,
// a bez tokena (ili sa neispravnim) pušta zahtev dalje kao anoniman
const optionalAuth = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = {
        id: decoded.id,
        email: decoded.email,
      };
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
      message: "Nemate dozvolu.",
    });
  }

  next();
};

module.exports = {
  protect,
  optionalAuth,
  onlySelf,
};
