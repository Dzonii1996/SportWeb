const nodemailer = require("nodemailer");

// SMTP iz .env (npr. Gmail sa app lozinkom, Brevo, Mailgun...):
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
let transport = null;

const getTransport = () => {
  if (!process.env.SMTP_HOST) return null;

  if (!transport) {
    const port = Number(process.env.SMTP_PORT) || 587;

    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }

  return transport;
};

// Šalje mejl. Bez SMTP podešavanja (lokalni razvoj) samo ispisuje mejl u konzolu.
const sendMail = async ({ to, subject, text }) => {
  const smtp = getTransport();

  if (!smtp) {
    console.log(`\n[mejl nije poslat, SMTP nije podešen]\nZa: ${to}\nNaslov: ${subject}\n${text}\n`);
    return;
  }

  await smtp.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
  });
};

module.exports = {
  sendMail,
};
