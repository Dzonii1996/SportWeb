const pool = require("../database/db");
const { describeMatch, notifyUsers } = require("./notify");

// Pravi seriju iz termina i vezuje termin za nju. "db" je pool ili client.
const createSeriesForMatch = async (db, match) => {
  const series = await db.query(
    `INSERT INTO match_series
       (user_id, sport, location, match_time, max_players, latitude, longitude, last_date, field_price)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      match.user_id,
      match.sport,
      match.location,
      match.match_time,
      match.max_players,
      match.latitude,
      match.longitude,
      match.match_date,
      match.field_price ?? null,
    ]
  );

  await db.query(
    "UPDATE matches SET series_id = $1 WHERE id = $2",
    [series.rows[0].id, match.id]
  );

  return series.rows[0].id;
};

// Pri izmeni termina: izmene važe i za sledeće termine u seriji.
// Poziva se PRE nego što se termin izmeni, jer poredi stari datum.
// repeatWeekly: true pokreće/nastavlja seriju, false je zaustavlja,
// undefined ostavlja kako jeste.
const updateSeriesFromEdit = async (matchId, fields, repeatWeekly) => {
  const current = await pool.query(
    "SELECT * FROM matches WHERE id = $1",
    [matchId]
  );
  const match = current.rows[0];

  if (!match.series_id) {
    if (repeatWeekly === true) {
      await createSeriesForMatch(pool, { ...match, ...fields });
    }
    return;
  }

  // Ako je ovo poslednji termin u seriji, sledeći se računa od njegovog novog datuma
  await pool.query(
    `UPDATE match_series
     SET location = $2,
         match_time = $3,
         max_players = $4,
         latitude = $5,
         longitude = $6,
         last_date = CASE WHEN last_date = $7::date THEN $8::date ELSE last_date END,
         active = COALESCE($9, active),
         field_price = $10
     WHERE id = $1`,
    [
      match.series_id,
      fields.location,
      fields.match_time,
      fields.max_players,
      fields.latitude,
      fields.longitude,
      match.match_date,
      fields.match_date,
      repeatWeekly === undefined ? null : repeatWeekly,
      fields.field_price ?? null,
    ]
  );
};

// Za svaku aktivnu seriju čiji je poslednji termin počeo pravi sledeći,
// nedelju dana kasnije, i prijavljuje stalne igrače. Bezbedno je zvati često.
const generateNextOccurrences = async () => {
  const due = await pool.query(
    `SELECT id FROM match_series
     WHERE active AND (last_date + match_time) <= NOW()`
  );

  let created = 0;

  for (const { id } of due.rows) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // SKIP LOCKED: ako druga instanca već obrađuje seriju, preskačemo je
      const locked = await client.query(
        `SELECT * FROM match_series
         WHERE id = $1 AND active AND (last_date + match_time) <= NOW()
         FOR UPDATE SKIP LOCKED`,
        [id]
      );

      if (locked.rows.length === 0) {
        await client.query("ROLLBACK");
        continue;
      }

      const series = locked.rows[0];

      // Sledeći datum u budućnosti (ako server nije radio par nedelja, preskačemo propuštene)
      const next = await client.query(
        `SELECT (last_date + 7 * CEIL(
                  GREATEST(1, EXTRACT(EPOCH FROM (NOW() - (last_date + match_time))) / 604800 + 0.000001)
                )::int)::date AS next_date
         FROM match_series WHERE id = $1`,
        [id]
      );
      const nextDate = next.rows[0].next_date;

      const inserted = await client.query(
        `INSERT INTO matches
           (user_id, sport, location, match_date, match_time, max_players,
            latitude, longitude, series_id, field_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          series.user_id,
          series.sport,
          series.location,
          nextDate,
          series.match_time,
          series.max_players,
          series.latitude,
          series.longitude,
          series.id,
          series.field_price,
        ]
      );
      const match = inserted.rows[0];

      await client.query(
        "UPDATE match_series SET last_date = $2 WHERE id = $1",
        [id, nextDate]
      );

      // Stalni igrači: prvi po redu dobijaju mesta, ostali idu na listu čekanja
      const regulars = await client.query(
        `SELECT user_id FROM series_regulars
         WHERE series_id = $1
         ORDER BY created_at, user_id`,
        [id]
      );
      const ids = regulars.rows.map((r) => r.user_id);
      const playing = ids.slice(0, series.max_players);
      const waiting = ids.slice(series.max_players);

      for (const userId of playing) {
        await client.query(
          "INSERT INTO match_players(match_id, user_id) VALUES($1, $2)",
          [match.id, userId]
        );
      }

      for (const userId of waiting) {
        await client.query(
          "INSERT INTO match_waitlist(match_id, user_id) VALUES($1, $2)",
          [match.id, userId]
        );
      }

      const description = describeMatch(match);

      await notifyUsers(
        client,
        [series.user_id],
        `🔁 Otvoren je sledeći termin u tvojoj seriji: ${description}.`,
        match.id
      );
      await notifyUsers(
        client,
        playing,
        `🔁 Novi termin: ${description}. Prijavljen si automatski (stalno mesto).`,
        match.id
      );
      await notifyUsers(
        client,
        waiting,
        `🔁 Novi termin: ${description}. Termin je pun, upisan si na listu čekanja.`,
        match.id
      );

      await client.query("COMMIT");
      created += 1;

    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  return created;
};

module.exports = {
  createSeriesForMatch,
  updateSeriesFromEdit,
  generateNextOccurrences,
};
