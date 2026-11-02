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
const createTables = require("./database/createtable");
app.use(cors());
app.use(express.json());


app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);
app.use("/api/auth", authRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/matches", matchPlayerRoutes);
app.use("/api/matches", messageRoutes);
app.use("/api/matches", waitlistRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "SportWeb API radi 🚀",
  });
});

// Port
const PORT = process.env.PORT || 5000;
pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.log("Greška pri povezivanju sa bazom:", err.message);
  } else {
    console.log("Baza povezana!");
    console.log("Vreme baze:", res.rows[0].now);
    createTables();
  }
});
app.listen(PORT, () => {
  console.log(`Server pokrenut na portu ${PORT}`);
});