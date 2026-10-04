const db = require('../db/connection');

/**
 * threshold_cop_carga guarda el umbral en la unidad del mercado: COP por carga en café y
 * COP por kilo en cacao (el nombre de la columna es histórico).
 */
function create({ userId, type, thresholdCopCarga = null, market = 'coffee' }) {
  const info = db
    .prepare('INSERT INTO alerts (user_id, type, threshold_cop_carga, market) VALUES (?, ?, ?, ?)')
    .run(userId, type, thresholdCopCarga, market);
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

/**
 * Alertas activas de un tipo, con los datos del dueño necesarios para entregarlas.
 * Solo trae las que tienen al menos un canal por donde llegar: WhatsApp con número
 * guardado o la app con un teléfono registrado.
 */
function findActiveByTypes(types, market = 'coffee') {
  const placeholders = types.map(() => '?').join(',');
  return db
    .prepare(
      `SELECT a.*, u.phone, u.username, u.role, u.plan, u.plan_expires_at, u.notify_whatsapp, u.notify_push,
              (SELECT COUNT(*) FROM push_devices d WHERE d.user_id = u.id) AS device_count
       FROM alerts a
       JOIN users u ON u.id = a.user_id
       WHERE a.active = 1
         AND a.market = ?
         AND a.type IN (${placeholders})
         AND (
           (u.notify_whatsapp = 1 AND u.phone IS NOT NULL AND u.phone <> '')
           OR (u.notify_push = 1 AND EXISTS (SELECT 1 FROM push_devices d WHERE d.user_id = u.id))
         )`
    )
    .all(market, ...types);
}

function markTriggered(id) {
  db.prepare("UPDATE alerts SET last_triggered_at = datetime('now') WHERE id = ?").run(id);
}

function logDelivery({ alertId = null, userId, phone, message, status, error = null, channel = 'whatsapp' }) {
  db.prepare(
    'INSERT INTO alert_deliveries (alert_id, user_id, phone, message, status, error, channel) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(alertId, userId, phone, message, status, error, channel);
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
