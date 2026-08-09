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

module.exports = { insert, latest };
