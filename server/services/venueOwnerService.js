const pool = require("../database/db");
const { HttpError } = require("../utils/http");
const { adminIds } = require("../utils/admin");
const { notifyUsers } = require("../utils/notify");

const MAX_MESSAGE = 500;

const notify = async (...args) => {
  try {
    await notifyUsers(pool, ...args);
  } catch (error) {
    console.error("Greška pri slanju notifikacija:", error);
  }
};

// Korisnik traži da postane vlasnik odobrenog terena koji još nema vlasnika.
// Poruka (npr. kako da ga admin proveri) nije obavezna.
const claimVenue = async ({ id, userId, body }) => {
  const result = await pool.query(
    "SELECT * FROM venues WHERE id = $1 AND status = 'approved'",
    [Number(id) || 0]
  );
  const venue = result.rows[0];

  if (!venue) {
    throw new HttpError(404, "Teren ne postoji.");
  }

  if (venue.owner_id) {
    throw new HttpError(400, "Teren već ima vlasnika.");
  }

  const raw = body?.message;
  const message = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;

  if (message && message.length > MAX_MESSAGE) {
    throw new HttpError(400, `Poruka može imati najviše ${MAX_MESSAGE} znakova.`);
  }

  const pending = await pool.query(
    "SELECT 1 FROM venue_claims WHERE venue_id = $1 AND user_id = $2 AND status = 'pending'",
    [venue.id, userId]
  );

  if (pending.rows.length > 0) {
    throw new HttpError(400, "Zahtev je već poslat i čeka odobrenje.");
  }

  await pool.query(
    "INSERT INTO venue_claims(venue_id, user_id, message) VALUES ($1, $2, $3)",
    [venue.id, userId, message]
  );

  await notify(
    await adminIds(),
    `🔑 Zahtev za vlasništvo terena "${venue.name}". Čeka odobrenje.`,
    null,
    { venueId: venue.id }
  );

  return {
    message: "Zahtev je poslat. Admin će te kontaktirati ili odobriti zahtev.",
  };
};

// Za admina: zahtevi za vlasništvo na čekanju, sa emailom radi provere
const getClaims = async () => {
  const result = await pool.query(
    `SELECT c.id, c.venue_id, c.user_id, c.message, c.created_at,
            v.name AS venue_name, v.address AS venue_address,
            u.name AS user_name, u.email AS user_email
     FROM venue_claims c
     JOIN venues v ON v.id = c.venue_id
     JOIN users u ON u.id = c.user_id
     WHERE c.status = 'pending'
     ORDER BY c.created_at`
  );

  return {
    claims: result.rows,
  };
};

const findPendingClaim = async (db, id) => {
  const result = await db.query(
    `SELECT c.*, v.name AS venue_name, v.owner_id
     FROM venue_claims c
     JOIN venues v ON v.id = c.venue_id
     WHERE c.id = $1 AND c.status = 'pending'
     FOR UPDATE OF c, v`,
    [Number(id) || 0]
  );

  return result.rows[0] || null;
};

// Odobravanje: korisnik postaje vlasnik, a ostali zahtevi za isti teren se odbijaju
const approveClaim = async ({ claimId }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const claim = await findPendingClaim(client, claimId);

    if (!claim) {
      await client.query("ROLLBACK");
      throw new HttpError(404, "Zahtev ne postoji.");
    }

    if (claim.owner_id) {
      await client.query("ROLLBACK");
      throw new HttpError(400, "Teren već ima vlasnika. Prvo ukloni postojećeg.");
    }

    await client.query("UPDATE venues SET owner_id = $1, updated_at = NOW() WHERE id = $2", [
      claim.user_id,
      claim.venue_id,
    ]);
    await client.query(
      "UPDATE venue_claims SET status = 'approved', decided_at = NOW() WHERE id = $1",
      [claim.id]
    );
    const others = await client.query(
      `UPDATE venue_claims SET status = 'rejected', decided_at = NOW()
       WHERE venue_id = $1 AND status = 'pending'
       RETURNING user_id`,
      [claim.venue_id]
    );

    await notifyUsers(
      client,
      [claim.user_id],
      `🔑 Sada si vlasnik terena "${claim.venue_name}". Možeš da menjaš podatke i primaš rezervacije.`,
      null,
      { venueId: claim.venue_id }
    );
    await notifyUsers(
      client,
      others.rows.map((r) => r.user_id),
      `Zahtev za vlasništvo terena "${claim.venue_name}" nije odobren.`,
      null,
      { venueId: claim.venue_id }
    );

    await client.query("COMMIT");

    return {
      message: "Zahtev je odobren.",
    };

  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

const rejectClaim = async ({ claimId }) => {
  const claim = await findPendingClaim(pool, claimId);

  if (!claim) {
    throw new HttpError(404, "Zahtev ne postoji.");
  }

  await pool.query(
    "UPDATE venue_claims SET status = 'rejected', decided_at = NOW() WHERE id = $1",
    [claim.id]
  );

  await notify(
    [claim.user_id],
    `Zahtev za vlasništvo terena "${claim.venue_name}" nije odobren.`,
    null,
    { venueId: claim.venue_id }
  );

  return {
    message: "Zahtev je odbijen.",
  };
};

// Admin uklanja vlasnika; rezervacije se isključuju dok teren nema novog vlasnika
const removeOwner = async ({ id: venueId }) => {
  const id = Number(venueId) || 0;
  const current = await pool.query("SELECT name, owner_id FROM venues WHERE id = $1", [id]);
  const venue = current.rows[0];

  if (!venue?.owner_id) {
    throw new HttpError(400, "Teren nema vlasnika.");
  }

  await pool.query(
    `UPDATE venues SET owner_id = NULL, accepts_reservations = false, updated_at = NOW()
     WHERE id = $1`,
    [id]
  );

  // Zahteve više niko ne može da potvrdi; potvrđene rezervacije ostaju
  const rejected = await pool.query(
    `UPDATE venue_reservations
     SET status = 'rejected', owner_note = 'Teren trenutno ne prima rezervacije preko SportWeb-a.',
         updated_at = NOW()
     WHERE venue_id = $1 AND status = 'pending'
     RETURNING id, user_id`,
    [id]
  );

  for (const r of rejected.rows) {
    await notify(
      [r.user_id],
      `❌ Zahtev za rezervaciju terena "${venue.name}" je otkazan: teren trenutno ne prima rezervacije.`,
      null,
      { reservationId: r.id }
    );
  }

  await notify(
    [venue.owner_id],
    `Više nisi vlasnik terena "${venue.name}" na SportWeb-u.`,
    null,
    { venueId: id }
  );

  return {
    message: "Vlasnik je uklonjen.",
  };
};

// Tereni prijavljenog korisnika (za stranicu vlasnika)
const getMyVenues = async ({ userId }) => {
  const result = await pool.query(
    `SELECT v.id, v.name, v.address, v.accepts_reservations,
            v.reservation_open_hour, v.reservation_close_hour,
            (SELECT COUNT(*) FROM venue_reservations r
             WHERE r.venue_id = v.id AND r.status = 'pending')::int AS pending_reservations
     FROM venues v
     WHERE v.owner_id = $1
     ORDER BY v.name`,
    [userId]
  );

  return {
    venues: result.rows,
  };
};

module.exports = {
  claimVenue,
  getClaims,
  approveClaim,
  rejectClaim,
  removeOwner,
  getMyVenues,
};
