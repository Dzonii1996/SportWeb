const cors = require("cors");

const LOCAL_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

const clean = (url) => url.trim().replace(/\/$/, "").toLowerCase();

// Dozvoljene adrese frontenda: FRONTEND_URL i po želji CORS_ORIGINS (odvojene zarezom).
// Bez FRONTEND_URL važi lokalni razvoj.
const allowedOrigins = () => {
  const { FRONTEND_URL, CORS_ORIGINS } = process.env;
  const extra = (CORS_ORIGINS || "").split(",").filter((url) => url.trim() !== "");

  return [...(FRONTEND_URL ? [FRONTEND_URL] : LOCAL_ORIGINS), ...extra].map(clean);
};

// Zahtevi bez Origin zaglavlja (otvaranje linka, curl, Facebook pregled linka) prolaze:
// CORS štiti samo od skripti sa tuđih sajtova u browseru
const corsPolicy = cors({
  origin: (origin, callback) => {
    callback(null, !origin || allowedOrigins().includes(clean(origin)));
  },
});

module.exports = corsPolicy;
