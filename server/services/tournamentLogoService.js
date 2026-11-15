const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const pool = require("../database/db");
const { msg } = require("../utils/i18n");
const { HttpError } = require("../utils/http");
const { isAdmin } = require("../utils/admin");

// Logo turnira (npr. škole domaćina). Server ga smanji na najviše LOGO_SIDE px
// i sačuva kao PNG, da providna pozadina loga ostane providna.

const LOGO_SIDE = 400;

const ROOT = path.join(__dirname, "..");
const LOGO_DIR = path.join(ROOT, "uploads", "logos");

fs.mkdirSync(LOGO_DIR, { recursive: true });

const removeFile = (relative) => {
  if (relative) fs.unlink(path.join(ROOT, relative), () => {});
};

const findManagedTournament = async (id, userId) => {
  const result = await pool.query("SELECT * FROM tournaments WHERE id = $1", [Number(id) || 0]);
  const tournament = result.rows[0];

  if (!tournament) throw new HttpError(404, msg("tournament.thisTournamentDoesntExist"));

  const manager =
    Number(tournament.organizer_id) === Number(userId) || (await isAdmin(userId));

  if (!manager) throw new HttpError(403, msg("tournament.onlyTheOrganizerCanDo"));

  return tournament;
};

const setLogo = async ({ id, userId, file }) => {
  try {
    const tournament = await findManagedTournament(id, userId);

    if (!file) throw new HttpError(400, msg("photo.noneSelected"));

    const logo = `/uploads/logos/${path.parse(file.filename).name}.png`;

    try {
      await sharp(file.path, { failOn: "error" })
        .rotate()
        .resize(LOGO_SIDE, LOGO_SIDE, { fit: "inside", withoutEnlargement: true })
        .png({ compressionLevel: 9 })
        .toFile(path.join(ROOT, logo));
    } catch {
      removeFile(logo);
      throw new HttpError(400, msg("photo.invalidImage"));
    }

    await pool.query("UPDATE tournaments SET logo_path = $2 WHERE id = $1", [tournament.id, logo]);
    removeFile(tournament.logo_path);

    return { message: msg("tournament.logoSaved"), logo_path: logo };

  } finally {
    // Original sa telefona ne čuvamo, samo smanjeni PNG
    if (file) fs.unlink(file.path, () => {});
  }
};

const removeLogo = async ({ id, userId }) => {
  const tournament = await findManagedTournament(id, userId);

  await pool.query("UPDATE tournaments SET logo_path = NULL WHERE id = $1", [tournament.id]);
  removeFile(tournament.logo_path);

  return { message: msg("tournament.logoRemoved") };
};

module.exports = { setLogo, removeLogo };
