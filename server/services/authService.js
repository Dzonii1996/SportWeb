const crypto = require("crypto");
const pool = require("../database/db");
const { HttpError } = require("../utils/http");
const bcrypt = require("bcrypt");
const { validatePassword, signToken } = require("../utils/password");
const { sendMail } = require("../utils/mailer");
const { translate } = require("../utils/i18n");

const RESET_MINUTES = 60;

// U bazi čuvamo samo hash tokena: ako baza procuri, linkovi ne rade
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const frontendUrl = () =>
  (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");

const register = async ({ body }) => {
  const { name, email, password } = body;


  // Provera podataka
  if (!name || !email || !password) {

    throw new HttpError(400, "Sva polja su obavezna.");

  }

  const passwordError = validatePassword(password);

  if (passwordError) {
    throw new HttpError(400, passwordError);
  }


  // Provera da li email postoji

  const existingUser = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );


  if (existingUser.rows.length > 0) {

    throw new HttpError(400, "Email već postoji.");

  }


  // Enkripcija lozinke

  const hashedPassword = await bcrypt.hash(password, 10);



  // Upis u bazu

  const newUser = await pool.query(

    `INSERT INTO users (name, email, password)
     VALUES ($1, $2, $3)
     RETURNING id, name, email`,

    [
      name,
      email,
      hashedPassword
    ]

  );



  return {

    message: "Korisnik uspešno registrovan.",

    user: newUser.rows[0]

  };
};


const login = async ({ body }) => {
  const { email, password } = body;

  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );

  if (result.rows.length === 0) {

    throw new HttpError(400, "Korisnik ne postoji.");

  }

  const user = result.rows[0];

  const passwordMatch = await bcrypt.compare(
    password,
    user.password
  );

  if (!passwordMatch) {

    throw new HttpError(400, "Pogrešna lozinka.");

  }

  const token = signToken(user);

  return {
    message: "Uspešna prijava.",
    token,
    user:{
      id:user.id,
      name:user.name,
      email:user.email
    }
  };
};



const FORGOT_MESSAGE =
  "Ako nalog sa tim emailom postoji, poslali smo link za novu lozinku.";

// Šalje link za novu lozinku. Odgovor je uvek isti, da se ne bi moglo
// proveriti koji emailovi imaju nalog.
const forgotPassword = async ({ body, language }) => {
  const email = typeof body.email === "string" ? body.email.trim() : "";

  const result = await pool.query(
    "SELECT id, name, email FROM users WHERE LOWER(email) = LOWER($1)",
    [email]
  );
  const user = result.rows[0];

  if (user) {
    // Najviše jedan mejl u 2 minuta, da neko ne zatrpa tuđe sanduče
    const recent = await pool.query(
      `SELECT 1 FROM password_resets
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '2 minutes'`,
      [user.id]
    );

    if (recent.rows.length === 0) {
      const token = crypto.randomBytes(32).toString("hex");

      await pool.query(
        `INSERT INTO password_resets(token_hash, user_id, expires_at)
         VALUES($1, $2, NOW() + make_interval(mins => $3))`,
        [hashToken(token), user.id, RESET_MINUTES]
      );

      await sendMail({
        to: user.email,
        subject: translate("SportWeb – nova lozinka", language),
        text: translate(
          `Zdravo ${user.name},\n\n` +
          `neko je zatražio novu lozinku za tvoj SportWeb nalog. ` +
          `Ako si to bio ti, otvori ovaj link u narednih ${RESET_MINUTES} minuta:\n\n` +
          `${frontendUrl()}/reset-password?token=${token}\n\n` +
          `Ako nisi ti tražio, slobodno ignoriši ovaj mejl. Lozinka ostaje ista.`,
          language
        ),
      });
    }
  }

  return {
    message: FORGOT_MESSAGE,
  };
};

// Postavlja novu lozinku pomoću linka iz mejla; link radi samo jednom
const resetPassword = async ({ body }) => {
  const client = await pool.connect();

  try {
    const { token, password } = body;

    const passwordError = validatePassword(password);

    if (passwordError) {
      throw new HttpError(400, passwordError);
    }

    await client.query("BEGIN");

    const reset = await client.query(
      `SELECT user_id FROM password_resets
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       FOR UPDATE`,
      [hashToken(String(token || ""))]
    );

    if (reset.rows.length === 0) {
      await client.query("ROLLBACK");
      throw new HttpError(400, "Link je istekao ili je već iskorišćen.", { expired: true });
    }

    const { user_id } = reset.rows[0];

    await client.query(
      `UPDATE users
       SET password = $1, password_changed_at = NOW()
       WHERE id = $2`,
      [await bcrypt.hash(password, 10), user_id]
    );

    // Ovaj i svi ostali linkovi tog korisnika više ne važe
    await client.query(
      `UPDATE password_resets SET used_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL`,
      [user_id]
    );

    await client.query("COMMIT");

    return {
      message: "Lozinka je promenjena. Prijavi se novom lozinkom.",
    };

  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
};