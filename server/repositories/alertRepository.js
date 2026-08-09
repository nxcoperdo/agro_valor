const db = require('../db/connection');

function create({ userId, type, thresholdCopCarga = null }) {
  const info = db
    .prepare('INSERT INTO alerts (user_id, type, threshold_cop_carga) VALUES (?, ?, ?)')
    .run(userId, type, thresholdCopCarga);
  return findById(info.lastInsertRowid);
}

function findById(id) {
  return db.prepare('SELECT * FROM alerts WHERE id = ?').get(id);
}

function findByUser(userId) {
  return db.prepare('SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC').all(userId);
}

function remove(id, userId) {
  return db.prepare('DELETE FROM alerts WHERE id = ? AND user_id = ?').run(id, userId).changes;
}

function setActive(id, userId, active) {
  return db
    .prepare('UPDATE alerts SET active = ? WHERE id = ? AND user_id = ?')
    .run(active ? 1 : 0, id, userId).changes;
}

/** Alertas activas de un tipo, junto con el teléfono y plan del dueño. */
function findActiveByTypes(types) {
  const placeholders = types.map(() => '?').join(',');
  return db
    .prepare(
      `SELECT a.*, u.phone, u.username, u.plan, u.plan_expires_at
       FROM alerts a
       JOIN users u ON u.id = a.user_id
       WHERE a.active = 1
         AND a.type IN (${placeholders})
         AND u.phone IS NOT NULL AND u.phone <> ''`
    )
    .all(...types);
}

function markTriggered(id) {
  db.prepare("UPDATE alerts SET last_triggered_at = datetime('now') WHERE id = ?").run(id);
}

function logDelivery({ alertId = null, userId, phone, message, status, error = null }) {
  db.prepare(
    'INSERT INTO alert_deliveries (alert_id, user_id, phone, message, status, error) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(alertId, userId, phone, message, status, error);
}

function recentDeliveries(userId, limit = 20) {
  return db
    .prepare('SELECT * FROM alert_deliveries WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, limit);
}

module.exports = {
  create,
  findById,
  findByUser,
  remove,
  setActive,
  findActiveByTypes,
  markTriggered,
  logDelivery,
  recentDeliveries,
};
