const jwt = require("jsonwebtoken");

// Proverava JWT iz "Authorization: Bearer <token>" i postavlja req.user
const protect = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Morate biti prijavljeni.",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.id,
      email: decoded.email,
    };

    next();

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Sesija je istekla. Prijavite se ponovo.",
    });
  }
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
