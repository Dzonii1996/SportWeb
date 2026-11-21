const webpush = require("web-push");
const pool = require("../database/db");
const { isMessage, render, translate } = require("./i18n");

// Push obaveštenja na telefonu (PWA, Web Push). Ključevi se prave jednom:
//   npx web-push generate-vapid-keys
// i upisuju u .env kao VAPID_PUBLIC_KEY i VAPID_PRIVATE_KEY. Bez njih se push
// ne šalje, a notifikacije u aplikaciji (zvonce) rade kao i do sada.

const publicKey = () => process.env.VAPID_PUBLIC_KEY || null;

const isConfigured = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

// Apple traži https: adresu ili mailto:, i ne prihvata localhost
const subject = () => {
  if (process.env.VAPID_SUBJECT) return process.env.VAPID_SUBJECT;

  const frontend = process.env.FRONTEND_URL || "";

  return frontend.startsWith("https://") ? frontend : "mailto:admin@example.com";
};

// Isti redosled kao klik na notifikaciju u zvoncu (NotificationBell)
const linkFor = (matchId, links = {}) => {
  if (matchId) return `/matches/${matchId}`;
  if (links.tournamentId) return `/turniri/${links.tournamentId}`;
  if (links.reservationId) return "/rezervacije";
  if (links.venueId) return `/tereni/${links.venueId}`;

  return "/";
};

const textFor = (message, language) =>
  isMessage(message) ? render(message, language) : translate(String(message), language);

// Pretplata koje više nema (korisnik je ugasio obaveštenja ili obrisao aplikaciju)
const GONE = [404, 410];

const sendOne = async (row, payload) => {
  try {
    await webpush.sendNotification(
      { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
      payload,
      {
        TTL: 60 * 60 * 24,
        vapidDetails: {
          subject: subject(),
          publicKey: process.env.VAPID_PUBLIC_KEY,
          privateKey: process.env.VAPID_PRIVATE_KEY,
        },
      }
    );
  } catch (error) {
    if (GONE.includes(error.statusCode)) {
      await pool.query("DELETE FROM push_subscriptions WHERE id = $1", [row.id]);
    } else {
      console.error("Push nije poslat:", error.statusCode ?? "", error.body ?? error.message);
    }
  }
};

// Šalje push svim uređajima korisnika, svakom na njegovom jeziku.
// Nikad ne baca grešku: push je dodatak, ne sme da obori radnju koja ga je izazvala.
const pushToUsers = async (userIds, message, matchId = null, links = {}) => {
  if (!isConfigured() || userIds.length === 0) return;

  try {
    const result = await pool.query(
      "SELECT id, endpoint, p256dh, auth, language FROM push_subscriptions WHERE user_id = ANY($1::int[])",
      [userIds]
    );

    const url = linkFor(matchId, links);

    await Promise.all(
      result.rows.map((row) =>
        sendOne(row, JSON.stringify({ title: "Sport KM", body: textFor(message, row.language), url }))
      )
    );
  } catch (error) {
    console.error("Push nije poslat:", error.message);
  }
};

module.exports = {
  publicKey,
  isConfigured,
  linkFor,
  pushToUsers,
};
