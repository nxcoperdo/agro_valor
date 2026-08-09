const db = require('../db/connection');

function insert({ priceCopCarga, sourceUrl, rawLabel = null }) {
  const info = db
    .prepare(
      'INSERT INTO fnc_reference_prices (price_cop_carga, source_url, raw_label) VALUES (?, ?, ?)'
    )
    .run(priceCopCarga, sourceUrl, rawLabel);
  return db.prepare('SELECT * FROM fnc_reference_prices WHERE id = ?').get(info.lastInsertRowid);
}

function latest() {
  return db
    .prepare('SELECT * FROM fnc_reference_prices ORDER BY scraped_at DESC, id DESC LIMIT 1')
    .get();
}

module.exports = { insert, latest };
