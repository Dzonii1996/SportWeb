const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const pool = require("../database/db");

const api = request(app);

// Prazni sve tabele pre svakog testa
const resetDb = () =>
  pool.query(`
    TRUNCATE users, matches, match_players, notifications,
             match_messages, match_waitlist, match_ratings, match_reminders,
             match_series, series_regulars
    RESTART IDENTITY CASCADE
  `);

let userCounter = 0;

const createUser = async (name = `Igrač ${++userCounter}`) => {
  const result = await pool.query(
    `INSERT INTO users(name, email, password)
     VALUES($1, $2, 'nije-za-prijavu')
     RETURNING id, name`,
    [name, `user${Date.now()}${++userCounter}@test.rs`]
  );

  return result.rows[0];
};

const tokenFor = (user) =>
  jwt.sign({ id: user.id, email: "test" }, process.env.JWT_SECRET, { expiresIn: "5m" });

const auth = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` });

// "YYYY-MM-DD" za danas + days (lokalno vreme)
const dateIn = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Termin direktno u bazi; startsInHours < 0 pravi odigran termin
// (API ne dozvoljava kreiranje termina u prošlosti)
const createMatch = async (creator, { maxPlayers = 10, startsInHours = 48, location = "Teren" } = {}) => {
  const result = await pool.query(
    `INSERT INTO matches(user_id, sport, location, match_date, match_time, max_players)
     VALUES($1, 'Fudbal', $2,
            (NOW() + $3 * INTERVAL '1 hour')::date,
            (NOW() + $3 * INTERVAL '1 hour')::time(0),
            $4)
     RETURNING *`,
    [creator.id, location, startsInHours, maxPlayers]
  );

  return result.rows[0];
};

const addPlayers = (match, users) =>
  Promise.all(
    users.map((u) =>
      pool.query(
        "INSERT INTO match_players(match_id, user_id) VALUES($1, $2)",
        [match.id, u.id]
      )
    )
  );

const notificationsOf = async (user) =>
  (
    await pool.query(
      "SELECT message, match_id, is_read FROM notifications WHERE user_id = $1 ORDER BY id",
      [user.id]
    )
  ).rows;

const playerIds = async (match) =>
  (
    await pool.query(
      "SELECT user_id FROM match_players WHERE match_id = $1 ORDER BY user_id",
      [match.id]
    )
  ).rows.map((r) => r.user_id);

module.exports = {
  api,
  pool,
  resetDb,
  createUser,
  auth,
  dateIn,
  createMatch,
  addPlayers,
  notificationsOf,
  playerIds,
};
