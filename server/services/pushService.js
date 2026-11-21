const pool = require("../database/db");
const { msg } = require("../utils/i18n");
const { HttpError } = require("../utils/http");
const push = require("../utils/push");

const LANGUAGES = ["sr", "en"];

// Javni ključ kojim browser pravi pretplatu; null ako push nije podešen na serveru
const getPublicKey = async () => ({
  publicKey: push.publicKey(),
});

const isHttpsUrl = (value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

const isKey = (value) => typeof value === "string" && value.length > 0 && value.length <= 200;

// Pretplata iz browsera (PushSubscription.toJSON()). Isti uređaj može promeniti
// korisnika (odjava pa prijava drugog), zato endpoint prelazi na onoga ko ga šalje.
const subscribe = async ({ userId, body }) => {
  if (!push.isConfigured()) {
    throw new HttpError(503, msg("push.notConfigured"));
  }

  const { endpoint, keys = {} } = body.subscription ?? {};

  if (typeof endpoint !== "string" || endpoint.length > 1000 || !isHttpsUrl(endpoint) || !isKey(keys.p256dh) || !isKey(keys.auth)) {
    throw new HttpError(400, msg("push.invalidSubscription"));
  }

  const language = LANGUAGES.includes(body.language) ? body.language : "sr";

  await pool.query(
    `INSERT INTO push_subscriptions(user_id, endpoint, p256dh, auth, language)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE
     SET user_id = EXCLUDED.user_id,
         p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth,
         language = EXCLUDED.language`,
    [userId, endpoint, keys.p256dh, keys.auth, language]
  );

  return {};
};

// Gašenje obaveštenja ili odjava sa uređaja; briše se samo sopstvena pretplata
const unsubscribe = async ({ userId, body }) => {
  if (typeof body.endpoint === "string") {
    await pool.query(
      "DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2",
      [body.endpoint, userId]
    );
  }

  return {};
};

module.exports = {
  getPublicKey,
  subscribe,
  unsubscribe,
};
