require("dotenv").config();
const { TIMEZONE } = require("./database/config");

// Datumi u JS-u (tekst notifikacija, provere vremena) po istoj zoni kao baza;
// hosting je obično u UTC-u
process.env.TZ = process.env.TZ || TIMEZONE;

const express = require("express");
const path = require("path");

const app = express();

// Iza proxy-ja (hosting) stvarna IP adresa je u zaglavlju; bez ovoga bi
// ograničenje pokušaja sve korisnike videlo kao jednog
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", Number(process.env.TRUST_PROXY));
}
const pool = require("./database/db");
const corsPolicy = require("./middleware/corsPolicy");
const authRoutes = require("./routes/authRoutes");
const matchRoutes = require("./routes/matchRoutes");
const matchPlayerRoutes = require("./routes/matchPlayerRoutes");
const userRoutes = require("./routes/userRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const messageRoutes = require("./routes/messageRoutes");
const waitlistRoutes = require("./routes/waitlistRoutes");
const ratingRoutes = require("./routes/ratingRoutes");
const seriesRoutes = require("./routes/seriesRoutes");
const shareRoutes = require("./routes/shareRoutes");
const inviteRoutes = require("./routes/inviteRoutes");
const venueRoutes = require("./routes/venueRoutes");
const reservationRoutes = require("./routes/reservationRoutes");
const tournamentRoutes = require("./routes/tournamentRoutes");
const photoRoutes = require("./routes/photoRoutes");
const language = require("./middleware/language");
const runMigrations = require("./database/migrate");
const { sendDueReminders } = require("./utils/reminders");
const { generateNextOccurrences } = require("./utils/series");
app.use(corsPolicy);
app.use(express.json());
app.use(language);


app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);
app.use("/api/auth", authRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/matches", matchPlayerRoutes);
app.use("/api/matches", messageRoutes);
app.use("/api/matches", waitlistRoutes);
app.use("/api/matches", ratingRoutes);
app.use("/api/matches", seriesRoutes);
app.use("/api/matches", inviteRoutes);
app.use("/share", shareRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/venues", venueRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use(photoRoutes);
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "SportWeb API radi 🚀",
  });
});

const MIN_SECRET_LENGTH = 32;

// JWT_SECRET mora da postoji; u produkciji mora i da bude dovoljno dug
const checkSecret = () => {
  const secret = process.env.JWT_SECRET || "";

  if (!secret) throw new Error("JWT_SECRET nije podešen.");

  if (secret.length < MIN_SECRET_LENGTH) {
    const message = `JWT_SECRET je kratak (${secret.length} znakova, treba bar ${MIN_SECRET_LENGTH}).`;

    if (process.env.NODE_ENV === "production") throw new Error(message);

    console.warn(`Upozorenje: ${message}`);
  }
};

// Server prima zahteve tek kad su baza i migracije spremne. Ako nešto od toga
// ne uspe, proces se gasi sa greškom, pa hosting prijavi neuspeli deploy
// i pokuša ponovo, umesto da server radi bez baze.
const start = async () => {
  checkSecret();

  const now = await pool.query("SELECT NOW()");
  console.log("Baza povezana, vreme baze:", now.rows[0].now);

  const applied = await runMigrations();
  if (applied.length > 0) console.log("Primenjene migracije:", applied.map((m) => m.name).join(", "));

  const PORT = process.env.PORT || 5000;

  await new Promise((resolve) => app.listen(PORT, resolve));
  console.log(`Server pokrenut na portu ${PORT}`);

  // Svakog minuta: novi termini iz serija, pa podsetnici pred termin
  const runScheduled = async () => {
    try {
      await generateNextOccurrences();
      await sendDueReminders();
    } catch (error) {
      console.error("Greška u zakazanim poslovima:", error.message);
    }
  };

  runScheduled();
  setInterval(runScheduled, 60 * 1000);
};

// Server se pokreće samo kad se app.js pokrene direktno (npm start),
// a ne kad ga testovi učitaju
if (require.main === module) {
  start().catch((error) => {
    console.error("Server nije pokrenut:", error.message || error.code || String(error));
    process.exit(1);
  });
}

module.exports = app;