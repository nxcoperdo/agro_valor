const db = require('../db/connection');

function insert({ rate, pair = 'USD/COP', source, provider = null }) {
  const info = db
    .prepare('INSERT INTO exchange_rates (rate, pair, source, provider) VALUES (?, ?, ?, ?)')
    .run(rate, pair, source, provider);
  return db.prepare('SELECT * FROM exchange_rates WHERE id = ?').get(info.lastInsertRowid);
}

function latest() {
  return db.prepare('SELECT * FROM exchange_rates ORDER BY fetched_at DESC, id DESC LIMIT 1').get();
}

/** Serie diaria: última tasa observada de cada día (para estimar la volatilidad del dólar). */
function dailySeries(days = 180) {
  return db
    .prepare(
      `SELECT date(fetched_at) AS day, rate
       FROM exchange_rates
       WHERE fetched_at >= datetime('now', ?)
       AND id IN (
         SELECT MAX(id) FROM exchange_rates
         WHERE fetched_at >= datetime('now', ?)
         GROUP BY date(fetched_at)
       )
       ORDER BY day ASC`
    )
    .all(`-${days} days`, `-${days} days`);
}

module.exports = { insert, latest, dailySeries };
