const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
const pool = require("./database/db");
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
const language = require("./middleware/language");
const createTables = require("./database/createtable");
const { sendDueReminders } = require("./utils/reminders");
const { generateNextOccurrences } = require("./utils/series");
app.use(cors());
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
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "SportWeb API radi 🚀",
  });
});

// Server se pokreće samo kad se app.js pokrene direktno (npm start),
// a ne kad ga testovi učitaju
if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  pool.query("SELECT NOW()", (err, res) => {
    if (err) {
      console.log("Greška pri povezivanju sa bazom:", err.message);
    } else {
      console.log("Baza povezana!");
      console.log("Vreme baze:", res.rows[0].now);
      createTables()
        .then(() => {
          // Svakog minuta: novi termini iz serija, pa podsetnici pred termin
          const runScheduled = async () => {
            try {
              await generateNextOccurrences();
              await sendDueReminders();
            } catch (error) {
              console.log("Greška u zakazanim poslovima:", error.message);
            }
          };

          runScheduled();
          setInterval(runScheduled, 60 * 1000);
        })
        .catch((error) =>
          console.log("Greška pri kreiranju tabela:", error.message)
        );
    }
  });

  app.listen(PORT, () => {
    console.log(`Server pokrenut na portu ${PORT}`);
  });
}

module.exports = app;