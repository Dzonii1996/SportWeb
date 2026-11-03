const pool = require("../database/db");
const { adminIds } = require("../utils/admin");
const { notifyUsers } = require("../utils/notify");

const MAX_MESSAGE = 500;

const serverError = (res, error) => {
  console.error(error);

  res.status(500).json({
    success: false,
    message: "Greška servera.",
  });
};

const badRequest = (res, message) =>
  res.status(400).json({ success: false, message });

const notify = async (...args) => {
  try {
    await notifyUsers(pool, ...args);
  } catch (error) {
    console.error("Greška pri slanju notifikacija:", error);
  }
};

// Korisnik traži da postane vlasnik odobrenog terena koji još nema vlasnika.
// Poruka (npr. kako da ga admin proveri) nije obavezna.
const claimVenue = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM venues WHERE id = $1 AND status = 'approved'",
      [Number(req.params.id) || 0]
    );
    const venue = result.rows[0];

    if (!venue) {
      return res.status(404).json({ success: false, message: "Teren ne postoji." });
    }

    if (venue.owner_id) {
      return badRequest(res, "Teren već ima vlasnika.");
    }

    const raw = req.body?.message;
    const message = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;

    if (message && message.length > MAX_MESSAGE) {
      return badRequest(res, `Poruka može imati najviše ${MAX_MESSAGE} znakova.`);
    }

    const pending = await pool.query(
      "SELECT 1 FROM venue_claims WHERE venue_id = $1 AND user_id = $2 AND status = 'pending'",
      [venue.id, req.user.id]
    );

    if (pending.rows.length > 0) {
      return badRequest(res, "Zahtev je već poslat i čeka odobrenje.");
    }

    await pool.query(
      "INSERT INTO venue_claims(venue_id, user_id, message) VALUES ($1, $2, $3)",
      [venue.id, req.user.id, message]
    );

    await notify(
      await adminIds(),
      `🔑 Zahtev za vlasništvo terena "${venue.name}". Čeka odobrenje.`,
      null,
      { venueId: venue.id }
    );

    res.status(201).json({
      success: true,
      message: "Zahtev je poslat. Admin će te kontaktirati ili odobriti zahtev.",
    });

  } catch (error) {
    serverError(res, error);
  }
};

// Za admina: zahtevi za vlasništvo na čekanju, sa emailom radi provere
const getClaims = async (req, res) => {
  try {
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

    res.json({
      success: true,
      claims: result.rows,
    });

  } catch (error) {
    serverError(res, error);
  }
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
const approveClaim = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const claim = await findPendingClaim(client, req.params.claimId);

    if (!claim) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Zahtev ne postoji." });
    }

    if (claim.owner_id) {
      await client.query("ROLLBACK");
      return badRequest(res, "Teren već ima vlasnika. Prvo ukloni postojećeg.");
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

    res.json({
      success: true,
      message: "Zahtev je odobren.",
    });

  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    serverError(res, error);
  } finally {
    client.release();
  }
};

const rejectClaim = async (req, res) => {
  try {
    const claim = await findPendingClaim(pool, req.params.claimId);

    if (!claim) {
      return res.status(404).json({ success: false, message: "Zahtev ne postoji." });
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

    res.json({
      success: true,
      message: "Zahtev je odbijen.",
    });

  } catch (error) {
    serverError(res, error);
  }
};

// Admin uklanja vlasnika; rezervacije se isključuju dok teren nema novog vlasnika
const removeOwner = async (req, res) => {
  try {
    const id = Number(req.params.id) || 0;
    const current = await pool.query("SELECT name, owner_id FROM venues WHERE id = $1", [id]);
    const venue = current.rows[0];

    if (!venue?.owner_id) {
      return badRequest(res, "Teren nema vlasnika.");
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

    res.json({
      success: true,
      message: "Vlasnik je uklonjen.",
    });

  } catch (error) {
    serverError(res, error);
  }
};

// Tereni prijavljenog korisnika (za stranicu vlasnika)
const getMyVenues = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT v.id, v.name, v.address, v.accepts_reservations,
              v.reservation_open_hour, v.reservation_close_hour,
              (SELECT COUNT(*) FROM venue_reservations r
               WHERE r.venue_id = v.id AND r.status = 'pending')::int AS pending_reservations
       FROM venues v
       WHERE v.owner_id = $1
       ORDER BY v.name`,
      [req.user.id]
    );

    res.json({
      success: true,
      venues: result.rows,
    });

  } catch (error) {
    serverError(res, error);
  }
};

module.exports = {
  claimVenue,
  getClaims,
  approveClaim,
  rejectClaim,
  removeOwner,
  getMyVenues,
};
