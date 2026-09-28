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

/**
 * Último precio publicado de cada día (fecha en hora de Colombia, UTC-5), del más
 * reciente al más viejo. Lo usan las páginas públicas para el histórico y la variación.
 */
function dailyHistory(limit = 10) {
  return db
    .prepare(
      `SELECT day, price_cop_carga, scraped_at FROM (
         SELECT date(scraped_at, '-5 hours') AS day, price_cop_carga, scraped_at,
                ROW_NUMBER() OVER (PARTITION BY date(scraped_at, '-5 hours') ORDER BY scraped_at DESC, id DESC) AS rn
         FROM fnc_reference_prices
       ) WHERE rn = 1 ORDER BY day DESC LIMIT ?`
    )
    .all(limit);
}

module.exports = { insert, latest, dailyHistory };
