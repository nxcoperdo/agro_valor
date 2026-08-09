const db = require('../db/connection');

function insert({
  price,
  currency = 'USD',
  unit = 'cents_per_lb',
  source,
  provider = null,
  quotedAt = null,
  meta = null,
}) {
  const info = db
    .prepare(
      'INSERT INTO coffee_prices (price, currency, unit, source, provider, quoted_at, meta) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(price, currency, unit, source, provider, quotedAt, meta ? JSON.stringify(meta) : null);
  return db.prepare('SELECT * FROM coffee_prices WHERE id = ?').get(info.lastInsertRowid);
}

function latest() {
  return db.prepare('SELECT * FROM coffee_prices ORDER BY fetched_at DESC, id DESC LIMIT 1').get();
}

/** Refresca la marca de tiempo de consulta sin crear una fila nueva. */
function touch(id) {
  db.prepare("UPDATE coffee_prices SET fetched_at = datetime('now') WHERE id = ?").run(id);
  return db.prepare('SELECT * FROM coffee_prices WHERE id = ?').get(id);
}

function history(days = 30) {
  return db
    .prepare(
      `SELECT * FROM coffee_prices
       WHERE fetched_at >= datetime('now', ?)
       ORDER BY fetched_at ASC`
    )
    .all(`-${days} days`);
}

/** Serie diaria: último precio observado de cada día (para el modelo de proyección). */
function dailySeries(days = 120) {
  return db
    .prepare(
      `SELECT date(fetched_at) AS day, price
       FROM coffee_prices
       WHERE fetched_at >= datetime('now', ?)
       AND id IN (
         SELECT MAX(id) FROM coffee_prices
         WHERE fetched_at >= datetime('now', ?)
         GROUP BY date(fetched_at)
       )
       ORDER BY day ASC`
    )
    .all(`-${days} days`, `-${days} days`);
}

module.exports = { insert, latest, touch, history, dailySeries };
