const fs = require("fs");
const path = require("path");
const pool = require("../database/db");
const { HttpError } = require("../utils/http");
const { isAdmin, adminIds } = require("../utils/admin");
const { notifyUsers } = require("../utils/notify");
const { SPORTS, MAX_PRICE, parseCoords } = require("../utils/fields");

const SURFACES = [
  "Veštačka trava",
  "Prirodna trava",
  "Parket",
  "Beton",
  "Asfalt",
  "Tartan",
  "Guma",
  "Šljaka",
  "Pesak",
  "Ostalo",
];
const STATUSES = ["approved", "pending", "rejected"];
const MAX_IMAGES = 6;

// Kolone za listu i stranicu terena: prva slika je naslovna,
// uz broj predstojećih javnih termina na terenu i prosečnu ocenu
const VENUE_COLUMNS = `
  v.*,
  (SELECT ROUND(AVG(rating)::numeric, 1)::float FROM venue_reviews WHERE venue_id = v.id) AS rating_avg,
  (SELECT COUNT(*) FROM venue_reviews WHERE venue_id = v.id)::int AS rating_count,
  (SELECT path FROM venue_images WHERE venue_id = v.id ORDER BY id LIMIT 1) AS cover_image,
  (SELECT COUNT(*) FROM matches m
   WHERE m.venue_id = v.id AND NOT m.is_private
     AND (m.match_date + m.match_time) >= NOW())::int AS upcoming_matches
`;

const notFound = () => new HttpError(404, "Teren ne postoji.");

// Opcioni tekst: prazno je null, inače skraćen razmacima i najviše max znakova
const optionalText = (value, max, label) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return { value: null };
  }

  if (typeof value !== "string" || value.trim().length > max) {
    return { error: `${label} može imati najviše ${max} znakova.` };
  }

  return { value: value.trim() };
};

// Proverava podatke terena; vraća { error } ili { values } spremne za upis
const validateVenue = (body) => {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";

  if (name.length < 2 || name.length > 100) {
    return { error: "Naziv mora imati između 2 i 100 znakova." };
  }

  if (address.length < 2 || address.length > 200) {
    return { error: "Adresa mora imati između 2 i 200 znakova." };
  }

  const coords = parseCoords(body);

  if (coords.error) return { error: coords.error };

  if (coords.latitude === null) {
    return { error: "Označi teren na mapi." };
  }

  const sports = Array.isArray(body.sports) ? [...new Set(body.sports)] : [];

  if (sports.length === 0 || !sports.every((s) => SPORTS.includes(s))) {
    return { error: "Izaberi bar jedan sport." };
  }

  const surface = body.surface ? String(body.surface) : null;

  if (surface !== null && !SURFACES.includes(surface)) {
    return { error: "Nepoznata podloga." };
  }

  let price = null;

  if (body.price_per_hour !== undefined && body.price_per_hour !== null && body.price_per_hour !== "") {
    price = Number(body.price_per_hour);

    if (!Number.isInteger(price) || price < 0 || price > MAX_PRICE) {
      return { error: "Cena po satu mora biti ceo broj dinara (do 1.000.000)." };
    }
  }

  const hours = optionalText(body.working_hours, 200, "Radno vreme");
  const phone = optionalText(body.phone, 30, "Telefon");
  const description = optionalText(body.description, 2000, "Opis");
  const textError = hours.error || phone.error || description.error;

  if (textError) return { error: textError };

  if (phone.value && !/^[0-9+\-/() ]+$/.test(phone.value)) {
    return { error: "Telefon može sadržati samo cifre, razmake i znakove + - / ( )." };
  }

  return {
    values: {
      name,
      address,
      latitude: coords.latitude,
      longitude: coords.longitude,
      sports,
      surface,
      indoor: body.indoor === true,
      price_per_hour: price,
      working_hours: hours.value,
      phone: phone.value,
      description: description.value,
    },
  };
};

const findVenue = async (id) => {
  if (!Number.isInteger(Number(id))) return null;

  const result = await pool.query("SELECT * FROM venues WHERE id = $1", [id]);

  return result.rows[0] || null;
};

const isOwner = (venue, userId) =>
  Boolean(userId) && Number(venue.owner_id) === Number(userId);

// Admin i vlasnik mogu sve sa slikama; predlagač dok predlog čeka
const canEditImages = async (venue, userId) =>
  (venue.status === "pending" && Number(venue.suggested_by) === Number(userId)) ||
  isOwner(venue, userId) ||
  isAdmin(userId);

// Teren kojim korisnik upravlja: postoji, a korisnik je admin ili vlasnik
const findManagedVenue = async (id, userId) => {
  const venue = await findVenue(id);

  if (!venue) throw notFound();

  if (!isOwner(venue, userId) && !(await isAdmin(userId))) {
    throw new HttpError(403, "Samo admin ili vlasnik terena može ovo da uradi.");
  }

  return venue;
};

// Provera pre prijema fajla: ko nema pravo, ne sme ni da pošalje sliku na disk
const requireImageAccess = async (id, userId) => {
  const venue = await findVenue(id);

  if (!venue) throw notFound();

  if (!(await canEditImages(venue, userId))) {
    throw new HttpError(403, "Nemate dozvolu.");
  }
};

const removeFiles = (paths) => {
  paths.forEach((p) => {
    fs.unlink(path.join(__dirname, "..", p), () => {});
  });
};

// Javna lista odobrenih terena, uz filtere ?sport=Fudbal, ?indoor=true|false
// i ?min_rating=4 (prosečna ocena bar toliko; tereni bez ocena ne prolaze)
const getVenues = async ({ query }) => {
  const { sport, indoor, min_rating: minRating } = query;
  const where = ["v.status = 'approved'"];
  const params = [];

  if (sport !== undefined && sport !== "") {
    if (!SPORTS.includes(sport)) {
      throw new HttpError(400, "Nepoznat sport.");
    }

    params.push(sport);
    where.push(`$${params.length} = ANY(v.sports)`);
  }

  if (indoor === "true" || indoor === "false") {
    params.push(indoor === "true");
    where.push(`v.indoor = $${params.length}`);
  }

  if (minRating !== undefined && minRating !== "") {
    const min = Number(minRating);

    if (!Number.isFinite(min) || min < 1 || min > 5) {
      throw new HttpError(400, "Ocena mora biti između 1 i 5.");
    }

    params.push(min);
    where.push(
      `(SELECT ROUND(AVG(rating)::numeric, 1) FROM venue_reviews WHERE venue_id = v.id) >= $${params.length}`
    );
  }

  const result = await pool.query(
    `SELECT ${VENUE_COLUMNS}
     FROM venues v
     WHERE ${where.join(" AND ")}
     ORDER BY v.name`,
    params
  );

  return {
    venues: result.rows,
  };
};

// Da li je prijavljeni korisnik admin (i koliko predloga i zahteva za vlasništvo čeka)
// i koliko terena poseduje
const getAdminStatus = async ({ userId }) => {
  const admin = await isAdmin(userId);
  let pending = 0;
  let claims = 0;

  if (admin) {
    const count = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM venues WHERE status = 'pending')::int AS venues,
         (SELECT COUNT(*) FROM venue_claims WHERE status = 'pending')::int AS claims`
    );
    pending = count.rows[0].venues;
    claims = count.rows[0].claims;
  }

  // Vlasnik vidi stranicu za svoje terene
  const owned = await pool.query(
    "SELECT COUNT(*)::int AS count FROM venues WHERE owner_id = $1",
    [userId]
  );

  return {
    is_admin: admin,
    pending_count: pending,
    pending_claims: claims,
    owned_venues: owned.rows[0].count,
  };
};

// Za admina: tereni po statusu (podrazumevano predlozi na čekanju)
const getAdminList = async ({ query }) => {
  const status = query.status || "pending";

  if (!STATUSES.includes(status)) {
    throw new HttpError(400, "Nepoznat status.");
  }

  const result = await pool.query(
    `SELECT ${VENUE_COLUMNS}, u.name AS suggested_by_name
     FROM venues v
     LEFT JOIN users u ON u.id = v.suggested_by
     WHERE v.status = $1
     ORDER BY v.created_at`,
    [status]
  );

  return {
    venues: result.rows,
  };
};

// Jedan teren sa slikama i predstojećim javnim terminima.
// Neodobren teren vide samo admin i onaj ko ga je predložio.
const getVenue = async ({ id, userId }) => {
  if (!Number.isInteger(Number(id))) throw notFound();

  const result = await pool.query(
    `SELECT ${VENUE_COLUMNS}, u.name AS suggested_by_name, o.name AS owner_name
     FROM venues v
     LEFT JOIN users u ON u.id = v.suggested_by
     LEFT JOIN users o ON o.id = v.owner_id
     WHERE v.id = $1`,
    [id]
  );
  const venue = result.rows[0];

  if (!venue) throw notFound();
  const admin = await isAdmin(userId);
  const isSuggester = userId && Number(venue.suggested_by) === Number(userId);

  if (venue.status !== "approved" && !admin && !isSuggester) {
    throw notFound();
  }

  const images = await pool.query(
    "SELECT id, path FROM venue_images WHERE venue_id = $1 ORDER BY id",
    [id]
  );

  const matches = await pool.query(
    `SELECT
       matches.*,
       users.name AS creator_name,
       users.avatar AS creator_avatar,
       COUNT(match_players.user_id) AS players,
       COALESCE(match_series.active, false) AS repeat_weekly
     FROM matches
     JOIN users ON users.id = matches.user_id
     LEFT JOIN match_players ON match_players.match_id = matches.id
     LEFT JOIN match_series ON match_series.id = matches.series_id
     WHERE matches.venue_id = $1
       AND NOT matches.is_private
       AND (matches.match_date + matches.match_time) >= NOW()
     GROUP BY matches.id, users.name, users.avatar, match_series.active
     ORDER BY matches.match_date, matches.match_time`,
    [id]
  );

  // Ko je predložio teren i ko je vlasnik vidi samo admin
  if (!admin) {
    delete venue.suggested_by_name;
    delete venue.owner_name;
  }

  const owner = isOwner(venue, userId);

  // Poslednji zahtev prijavljenog korisnika da postane vlasnik
  const claim = userId
    ? await pool.query(
        `SELECT status FROM venue_claims
         WHERE venue_id = $1 AND user_id = $2
         ORDER BY id DESC LIMIT 1`,
        [id, userId]
      )
    : { rows: [] };

  return {
    venue,
    images: images.rows,
    matches: matches.rows.map(({ share_token, ...m }) => m),
    can_edit: admin || owner,
    can_edit_images: admin || owner || (isSuggester && venue.status === "pending"),
    is_admin: admin,
    is_owner: owner,
    my_claim: claim.rows[0]?.status || null,
  };
};

// Admin dodaje odobren teren; korisnik šalje predlog koji čeka odobrenje
const createVenue = async ({ userId, body }) => {
  const { error, values } = validateVenue(body);

  if (error) throw new HttpError(400, error);

  const admin = await isAdmin(userId);

  const result = await pool.query(
    `INSERT INTO venues
       (name, address, latitude, longitude, sports, surface, indoor,
        price_per_hour, working_hours, phone, description, status, suggested_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      values.name,
      values.address,
      values.latitude,
      values.longitude,
      values.sports,
      values.surface,
      values.indoor,
      values.price_per_hour,
      values.working_hours,
      values.phone,
      values.description,
      admin ? "approved" : "pending",
      userId,
    ]
  );
  const venue = result.rows[0];

  if (!admin) {
    try {
      await notifyUsers(
        pool,
        await adminIds(),
        `🏟️ Nov predlog terena: ${venue.name} (${venue.address}). Čeka odobrenje.`,
        null,
        { venueId: venue.id }
      );
    } catch (notifyError) {
      console.error("Greška pri slanju notifikacija:", notifyError);
    }
  }

  return {
    message: admin
      ? "Teren je dodat."
      : "Hvala! Predlog je poslat i čeka odobrenje admina.",
    venue,
  };
};

const updateVenue = async ({ id, body }) => {
  const venue = await findVenue(id);

  if (!venue) throw notFound();

  const { error, values } = validateVenue(body);

  if (error) throw new HttpError(400, error);

  const result = await pool.query(
    `UPDATE venues
     SET name = $2, address = $3, latitude = $4, longitude = $5, sports = $6,
         surface = $7, indoor = $8, price_per_hour = $9, working_hours = $10,
         phone = $11, description = $12, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      venue.id,
      values.name,
      values.address,
      values.latitude,
      values.longitude,
      values.sports,
      values.surface,
      values.indoor,
      values.price_per_hour,
      values.working_hours,
      values.phone,
      values.description,
    ]
  );

  return {
    message: "Teren je izmenjen.",
    venue: result.rows[0],
  };
};

// Brisanje terena: termini na njemu ostaju, samo više nisu vezani za teren
const deleteVenue = async ({ id }) => {
  const venue = await findVenue(id);

  if (!venue) throw notFound();

  const images = await pool.query(
    "SELECT path FROM venue_images WHERE venue_id = $1",
    [venue.id]
  );

  await pool.query("DELETE FROM venues WHERE id = $1", [venue.id]);

  removeFiles(images.rows.map((r) => r.path));

  return {
    message: "Teren je obrisan.",
  };
};

// Odobravanje ili odbijanje predloga; predlagač dobija obaveštenje
const setStatus = (status) => async ({ id, userId, body }) => {
  const venue = await findVenue(id);

  if (!venue) throw notFound();

  const reason =
    status === "rejected" ? optionalText(body?.reason, 300, "Razlog") : { value: null };

  if (reason.error) throw new HttpError(400, reason.error);

  const result = await pool.query(
    `UPDATE venues
     SET status = $2, rejection_reason = $3, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [venue.id, status, reason.value]
  );

  const suggester = venue.suggested_by;

  if (suggester && Number(suggester) !== Number(userId) && venue.status !== status) {
    const message =
      status === "approved"
        ? `✅ Tvoj predlog terena "${venue.name}" je odobren i sada je na listi terena. Hvala!`
        : `❌ Tvoj predlog terena "${venue.name}" nije odobren.${
            reason.value ? ` Razlog: ${reason.value}` : ""
          }`;

    try {
      await notifyUsers(pool, [suggester], message, null, { venueId: venue.id });
    } catch (notifyError) {
      console.error("Greška pri slanju notifikacija:", notifyError);
    }
  }

  return {
    message: status === "approved" ? "Teren je odobren." : "Predlog je odbijen.",
    venue: result.rows[0],
  };
};

// Dodavanje slika (polje "images", više fajlova); ukupno najviše MAX_IMAGES
const addImages = async ({ id, userId, files }) => {
  const uploaded = (files || []).map((f) => `/uploads/${f.filename}`);

  try {
    const venue = await findVenue(id);

    if (!venue) {
      removeFiles(uploaded);
      throw notFound();
    }

    if (!(await canEditImages(venue, userId))) {
      removeFiles(uploaded);

      throw new HttpError(403, "Nemate dozvolu.");
    }

    if (uploaded.length === 0) {
      throw new HttpError(400, "Nije izabrana nijedna slika.");
    }

    const count = await pool.query(
      "SELECT COUNT(*)::int AS count FROM venue_images WHERE venue_id = $1",
      [venue.id]
    );

    if (count.rows[0].count + uploaded.length > MAX_IMAGES) {
      removeFiles(uploaded);
      throw new HttpError(400, `Teren može imati najviše ${MAX_IMAGES} slika.`);
    }

    const result = await pool.query(
      `INSERT INTO venue_images(venue_id, path)
       SELECT $1, unnest($2::text[])
       RETURNING id, path`,
      [venue.id, uploaded]
    );

    return {
      message: "Slike su dodate.",
      images: result.rows,
    };

  } catch (error) {
    removeFiles(uploaded);
    throw error;
  }
};

const deleteImage = async ({ id, imageId, userId }) => {
  const venue = await findVenue(id);

  if (!venue) throw notFound();

  if (!(await canEditImages(venue, userId))) {
    throw new HttpError(403, "Nemate dozvolu.");
  }

  const result = await pool.query(
    "DELETE FROM venue_images WHERE id = $1 AND venue_id = $2 RETURNING path",
    [Number(imageId) || 0, venue.id]
  );

  if (result.rows.length === 0) {
    throw new HttpError(404, "Slika ne postoji.");
  }

  removeFiles(result.rows.map((r) => r.path));

  return {
    message: "Slika je obrisana.",
  };
};

module.exports = {
  SURFACES,
  isOwner,
  findManagedVenue,
  requireImageAccess,
  MAX_IMAGES,
  getVenues,
  getAdminStatus,
  getAdminList,
  getVenue,
  createVenue,
  updateVenue,
  deleteVenue,
  approveVenue: setStatus("approved"),
  rejectVenue: setStatus("rejected"),
  addImages,
  deleteImage,
};
