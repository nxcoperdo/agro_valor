const db = require('../db/connection');

function create({ userId, cooperativeId, municipality, priceCopCarga, factor, humidity, reportedForDate }) {
  const info = db
    .prepare(
      `INSERT INTO price_reports (user_id, cooperative_id, municipality, price_cop_carga, factor, humidity, reported_for_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(userId, cooperativeId, municipality, priceCopCarga, factor, humidity, reportedForDate);
  return db.prepare('SELECT * FROM price_reports WHERE id = ?').get(info.lastInsertRowid);
}

/**
 * Promedio de lo reportado por cooperativa en los últimos días. Se exige un mínimo de
 * reportes distintos para considerarlo confiable y no dejar que un solo dato mande.
 */
function aggregateRecent(days = 3) {
  return db
    .prepare(
      `SELECT cooperative_id,
              COUNT(*) AS report_count,
              COUNT(DISTINCT user_id) AS reporter_count,
              AVG(price_cop_carga) AS avg_price,
              MAX(reported_for_date) AS latest_date
       FROM price_reports
       WHERE cooperative_id IS NOT NULL
         AND reported_for_date >= date('now', ?)
       GROUP BY cooperative_id`
    )
    .all(`-${days} days`);
}

function findByUser(userId, limit = 30) {
  return db
    .prepare(
      `SELECT r.*, c.name AS cooperative_name
       FROM price_reports r
       LEFT JOIN cooperatives c ON c.id = r.cooperative_id
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC
       LIMIT ?`
    )
    .all(userId, limit);
}

function countToday(userId) {
  return db
    .prepare("SELECT COUNT(*) AS n FROM price_reports WHERE user_id = ? AND date(created_at) = date('now')")
    .get(userId).n;
}

module.exports = { create, aggregateRecent, findByUser, countToday };
