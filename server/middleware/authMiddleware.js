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
  onlySelf,
};
