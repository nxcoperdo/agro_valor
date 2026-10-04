const db = require('../db/connection');

/** Guarda cada semana una sola vez (week_end es único); si Agronet corrige un precio, se actualiza. */
function upsertMany(weeks, sourceUrl) {
  const upsert = db.prepare(
    `INSERT INTO cocoa_reference_prices (week_end, week_label, price_cop_kg, source_url)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(week_end) DO UPDATE SET
       week_label = excluded.week_label,
       scraped_at = CASE WHEN price_cop_kg <> excluded.price_cop_kg THEN datetime('now') ELSE scraped_at END,
       price_cop_kg = excluded.price_cop_kg,
       source_url = excluded.source_url`
  );
  const tx = db.transaction((items) => {
    items.forEach((w) => upsert.run(w.weekEnd, w.weekLabel, w.priceCopKg, sourceUrl));
  });
  tx(weeks);
}

function latest() {
  return db.prepare('SELECT * FROM cocoa_reference_prices ORDER BY week_end DESC LIMIT 1').get();
}

function history(weeks = 52) {
  return db
    .prepare('SELECT * FROM (SELECT * FROM cocoa_reference_prices ORDER BY week_end DESC LIMIT ?) ORDER BY week_end ASC')
    .all(weeks);
}

module.exports = { upsertMany, latest, history };
