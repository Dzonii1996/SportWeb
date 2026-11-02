const pool = require("../database/db");
const { describeMatch, notifyUsers, matchAudience } = require("./notify");

// Podsetnici pred termin. "until" je donja granica: podsetnik za dan ranije
// ne šaljemo ako je do termina ostalo manje od sat, jer tada ide onaj za 1h.
const REMINDERS = [
  {
    kind: "24h",
    before: "24 hours",
    until: "1 hour",
    message: (m) => `⏰ Podsetnik: sutra igraš! ${describeMatch(m)}.`,
  },
  {
    kind: "1h",
    before: "1 hour",
    until: "0 seconds",
    message: (m) => `⏰ Za manje od sat vremena počinje termin: ${describeMatch(m)}.`,
  },
];

// Šalje sve podsetnike kojima je došlo vreme. Bezbedno je zvati često:
// match_reminders pamti poslate, pa svaki ide samo jednom.
const sendDueReminders = async () => {
  let sent = 0;

  for (const reminder of REMINDERS) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Termin je u periodu za ovaj podsetnik i postojao je pre tog perioda
      // (termin napravljen pre 5 sati ne dobija "sutra igraš")
      const due = await client.query(
        `INSERT INTO match_reminders(match_id, kind)
         SELECT id, $1
         FROM matches
         WHERE (match_date + match_time) > NOW() + $3::interval
         AND (match_date + match_time) <= NOW() + $2::interval
         AND created_at < (match_date + match_time) - $2::interval
         ON CONFLICT DO NOTHING
         RETURNING match_id`,
        [reminder.kind, reminder.before, reminder.until]
      );

      for (const { match_id } of due.rows) {
        const match = await client.query(
          "SELECT * FROM matches WHERE id = $1",
          [match_id]
        );

        const audience = await matchAudience(match_id);

        await notifyUsers(
          client,
          audience,
          reminder.message(match.rows[0]),
          match_id
        );

        sent += 1;
      }

      await client.query("COMMIT");

    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  return sent;
};

// Posle pomeranja termina podsetnici treba da stignu ponovo, za novo vreme
const resetReminders = (matchId) =>
  pool.query("DELETE FROM match_reminders WHERE match_id = $1", [matchId]);

module.exports = {
  sendDueReminders,
  resetReminders,
};
