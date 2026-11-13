const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const pool = require("../database/db");
const { msg } = require("../utils/i18n");
const { HttpError } = require("../utils/http");
const { isAdmin, adminIds } = require("../utils/admin");
const { canViewMatch } = require("../utils/privacy");
const { describeMatch, notifyUsers } = require("../utils/notify");
const { parsePage, pageInfo } = require("../utils/pagination");

// Fotografije sa turnira i termina. Server svaku sliku okrene kako treba,
// smanji (najviše MAX_SIDE px) i napravi sličicu za mrežu. sharp pri tome
// izbacuje EXIF podatke, pa sa slike nestaje i lokacija telefona.

const MAX_UPLOAD = 10;
const MAX_PER_TOURNAMENT = 200;
const MAX_PER_MATCH = 50;
const MAX_CAPTION = 200;
const MAX_SIDE = 1600;
const THUMB_SIDE = 400;
const REASONS = ["inappropriate", "me"];

const ROOT = path.join(__dirname, "..");
const PHOTO_DIR = path.join(ROOT, "uploads", "photos");

fs.mkdirSync(PHOTO_DIR, { recursive: true });

const removeFiles = (paths) =>
  paths.filter(Boolean).forEach((p) => fs.unlink(path.join(ROOT, p), () => {}));

const removeUploads = (files = []) => files.forEach((f) => fs.unlink(f.path, () => {}));

// ---------- Gde je slika: turnir ili termin ----------

const findTournament = async (id) => {
  const result = await pool.query("SELECT * FROM tournaments WHERE id = $1", [Number(id) || 0]);

  if (!result.rows[0]) throw new HttpError(404, msg("tournament.thisTournamentDoesntExist"));

  return result.rows[0];
};

const findMatch = async (id, userId, key) => {
  const result = await pool.query("SELECT * FROM matches WHERE id = $1", [Number(id) || 0]);
  const match = result.rows[0];

  // Privatan termin bez prava pristupa izgleda kao da ne postoji
  if (!match || !(await canViewMatch(match.id, userId, key))) {
    throw new HttpError(404, msg("common.thisGameDoesntExist"));
  }

  return match;
};

// Turnir: organizator, admin i igrači odobrenih ekipa; tek kad turnir počne
const tournamentAccess = async (tournament, userId) => {
  if (!userId) return { canUpload: false, canModerate: false };

  const admin = await isAdmin(userId);
  const organizer = Number(tournament.organizer_id) === Number(userId);
  const player = await pool.query(
    `SELECT 1
     FROM tournament_teams t
     WHERE t.tournament_id = $1 AND t.status = 'approved'
       AND (t.captain_id = $2 OR EXISTS (
         SELECT 1 FROM tournament_team_players p WHERE p.team_id = t.id AND p.user_id = $2
       ))
     LIMIT 1`,
    [tournament.id, userId]
  );
  const started = ["in_progress", "finished"].includes(tournament.status);

  return {
    canUpload: started && (admin || organizer || player.rows.length > 0),
    canModerate: admin || organizer,
    started,
  };
};

// Termin: kreator, admin i igrači; tek kad termin počne
const matchAccess = async (match, userId) => {
  if (!userId) return { canUpload: false, canModerate: false };

  const admin = await isAdmin(userId);
  const creator = Number(match.user_id) === Number(userId);
  const player = await pool.query(
    "SELECT 1 FROM match_players WHERE match_id = $1 AND user_id = $2",
    [match.id, userId]
  );
  const time = await pool.query(
    "SELECT ($1::date + $2::time) <= NOW() AS started",
    [match.match_date, match.match_time]
  );
  const started = time.rows[0].started;

  return {
    canUpload: started && (admin || creator || player.rows.length > 0),
    canModerate: admin || creator,
    started,
  };
};

// "tournament" ili "match" sa svim što treba za proveru prava
const loadPlace = async (kind, id, userId, key) => {
  if (kind === "tournament") {
    const tournament = await findTournament(id);

    return {
      column: "tournament_id",
      id: tournament.id,
      limit: MAX_PER_TOURNAMENT,
      ownerId: tournament.organizer_id,
      label: tournament.name,
      links: { tournamentId: tournament.id },
      matchId: null,
      ...(await tournamentAccess(tournament, userId)),
    };
  }

  const match = await findMatch(id, userId, key);

  return {
    column: "match_id",
    id: match.id,
    limit: MAX_PER_MATCH,
    ownerId: match.user_id,
    label: describeMatch(match),
    links: {},
    matchId: match.id,
    ...(await matchAccess(match, userId)),
  };
};

// ---------- Lista ----------

const PHOTO_FIELDS = `
  p.id, p.path, p.thumb_path, p.width, p.height, p.caption, p.created_at,
  p.user_id, u.name AS user_name`;

const listPhotos = (kind) => async ({ id, userId, query = {} }) => {
  const place = await loadPlace(kind, id, userId, query.key);
  const admin = userId ? await isAdmin(userId) : false;

  const result = await pool.query(
    `SELECT ${PHOTO_FIELDS},
       (SELECT COUNT(*) FROM photo_reports r WHERE r.photo_id = p.id)::int AS reports
     FROM photos p
     LEFT JOIN users u ON u.id = p.user_id
     WHERE p.${place.column} = $1
     ORDER BY p.id DESC`,
    [place.id]
  );

  return {
    photos: result.rows.map(({ reports, ...photo }) => ({
      ...photo,
      can_delete: place.canModerate || (userId && Number(photo.user_id) === Number(userId)),
      // Broj prijava vidi samo admin
      ...(admin ? { reports } : {}),
    })),
    can_upload: place.canUpload,
    max_upload: MAX_UPLOAD,
  };
};

// ---------- Dodavanje ----------

// Jedna slika: okrenuta, smanjena, bez EXIF-a, i sličica za mrežu
const processImage = async (file) => {
  const base = path.parse(file.filename).name;
  const full = `/uploads/photos/${base}.jpg`;
  const thumb = `/uploads/photos/${base}-t.jpg`;

  try {
    const image = sharp(file.path, { failOn: "error" }).rotate();

    const info = await image
      .clone()
      .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(path.join(ROOT, full));

    await image
      .clone()
      .resize(THUMB_SIDE, THUMB_SIDE, { fit: "cover", position: "attention" })
      .jpeg({ quality: 75 })
      .toFile(path.join(ROOT, thumb));

    return { path: full, thumb_path: thumb, width: info.width, height: info.height };

  } catch {
    removeFiles([full, thumb]);
    throw new HttpError(400, msg("photo.invalidImage"));
  }
};

const addPhotos = (kind) => async ({ id, userId, body = {}, files = [], query = {} }) => {
  const saved = [];

  try {
    const place = await loadPlace(kind, id, userId, query.key);

    if (!place.canUpload) {
      throw new HttpError(403, place.started ? msg("photo.cantUpload") : msg("photo.notStarted"));
    }

    if (files.length === 0) throw new HttpError(400, msg("photo.noneSelected"));

    const caption = typeof body.caption === "string" ? body.caption.trim() : "";

    if (caption.length > MAX_CAPTION) {
      throw new HttpError(400, msg("photo.captionTooLong", { n: MAX_CAPTION }));
    }

    const count = await pool.query(
      `SELECT COUNT(*)::int AS count FROM photos WHERE ${place.column} = $1`,
      [place.id]
    );

    if (count.rows[0].count + files.length > place.limit) {
      throw new HttpError(400, msg("photo.tooMany", { n: place.limit }));
    }

    for (const file of files) {
      const image = await processImage(file);
      saved.push(image.path, image.thumb_path);
      Object.assign(file, { image });
    }

    const result = await pool.query(
      `INSERT INTO photos(${place.column}, user_id, path, thumb_path, width, height, caption)
       SELECT $1, $2, x.path, x.thumb_path, x.width, x.height, $7
       FROM unnest($3::text[], $4::text[], $5::int[], $6::int[]) AS x(path, thumb_path, width, height)
       RETURNING id, path, thumb_path, width, height, caption, created_at, user_id`,
      [
        place.id,
        userId,
        files.map((f) => f.image.path),
        files.map((f) => f.image.thumb_path),
        files.map((f) => f.image.width),
        files.map((f) => f.image.height),
        caption || null,
      ]
    );

    return {
      httpStatus: 201,
      message: msg("photo.added"),
      photos: result.rows,
    };

  } catch (error) {
    removeFiles(saved);
    throw error;

  } finally {
    // Original sa telefona (sa EXIF-om) ne ostaje na disku
    removeUploads(files);
  }
};

// ---------- Brisanje i prijava ----------

const findPhoto = async (photoId) => {
  const result = await pool.query(
    `SELECT p.*, t.organizer_id, t.name AS tournament_name, m.user_id AS match_creator
     FROM photos p
     LEFT JOIN tournaments t ON t.id = p.tournament_id
     LEFT JOIN matches m ON m.id = p.match_id
     WHERE p.id = $1`,
    [Number(photoId) || 0]
  );

  if (!result.rows[0]) throw new HttpError(404, msg("photo.notFound"));

  return result.rows[0];
};

const deletePhoto = async ({ photoId, userId }) => {
  const photo = await findPhoto(photoId);
  const allowed =
    Number(photo.user_id) === Number(userId) ||
    Number(photo.organizer_id) === Number(userId) ||
    Number(photo.match_creator) === Number(userId) ||
    (await isAdmin(userId));

  if (!allowed) throw new HttpError(403, msg("photo.cantDelete"));

  await pool.query("DELETE FROM photos WHERE id = $1", [photo.id]);
  removeFiles([photo.path, photo.thumb_path]);

  return { message: msg("photo.deleted") };
};

// Prijava ide adminima, organizatoru (ili kreatoru termina) i onome ko je dodao sliku
const reportPhoto = async ({ photoId, userId, body = {} }) => {
  const photo = await findPhoto(photoId);

  if (!REASONS.includes(body.reason)) throw new HttpError(400, msg("photo.invalidReason"));

  if (photo.match_id && !(await canViewMatch(photo.match_id, userId))) {
    throw new HttpError(404, msg("photo.notFound"));
  }

  const inserted = await pool.query(
    `INSERT INTO photo_reports(photo_id, user_id, reason) VALUES($1, $2, $3)
     ON CONFLICT DO NOTHING RETURNING photo_id`,
    [photo.id, userId, body.reason]
  );

  if (inserted.rows.length === 0) throw new HttpError(400, msg("photo.alreadyReported"));

  let place = photo.tournament_name;

  if (photo.match_id) {
    const match = await pool.query("SELECT * FROM matches WHERE id = $1", [photo.match_id]);
    place = describeMatch(match.rows[0]);
  }

  const audience = [
    ...(await adminIds()),
    photo.organizer_id,
    photo.match_creator,
    photo.user_id,
  ].filter((id) => id && Number(id) !== Number(userId));

  try {
    await notifyUsers(
      pool,
      audience,
      msg("photo.reportNotification", {
        reason: msg(body.reason === "me" ? "photo.reasonMe" : "photo.reasonInappropriate"),
        place,
      }),
      photo.match_id,
      { tournamentId: photo.tournament_id }
    );
  } catch (notifyError) {
    console.error(notifyError);
  }

  return { message: msg("photo.reported") };
};

// ---------- Galerija: najnovije slike sa javnih turnira i termina ----------

const getGallery = async ({ query = {} }) => {
  const paging = parsePage(query, 24);

  const result = await pool.query(
    `SELECT ${PHOTO_FIELDS},
       p.tournament_id, t.name AS tournament_name, t.sport AS tournament_sport,
       p.match_id, m.sport AS match_sport, m.location AS match_location,
       m.match_date, m.match_time,
       COUNT(*) OVER() AS total_count
     FROM photos p
     LEFT JOIN users u ON u.id = p.user_id
     LEFT JOIN tournaments t ON t.id = p.tournament_id
     LEFT JOIN matches m ON m.id = p.match_id
     WHERE p.tournament_id IS NOT NULL OR NOT m.is_private
     ORDER BY p.id DESC
     LIMIT $1 OFFSET $2`,
    [paging.limit, paging.offset]
  );

  return {
    photos: result.rows.map(({ total_count, ...photo }) => photo),
    ...pageInfo(paging, Number(result.rows[0]?.total_count ?? 0)),
  };
};

module.exports = {
  MAX_UPLOAD,
  getTournamentPhotos: listPhotos("tournament"),
  addTournamentPhotos: addPhotos("tournament"),
  getMatchPhotos: listPhotos("match"),
  addMatchPhotos: addPhotos("match"),
  deletePhoto,
  reportPhoto,
  getGallery,
};
