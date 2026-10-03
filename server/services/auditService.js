const db = require('../db/connection');

/** Registra quién hizo qué. `changes` es cualquier objeto serializable (antes/después, motivo...). */
function log({ businessId = null, userId = null, action, entity, entityId = null, changes = null }) {
  db.prepare(
    'INSERT INTO audit_log (business_id, user_id, action, entity, entity_id, changes) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(businessId, userId, action, entity, entityId, changes == null ? null : JSON.stringify(changes));
}

function list(businessId, { entity, entityId, limit = 100 } = {}) {
  const params = [businessId];
  let sql = 'SELECT * FROM audit_log WHERE business_id = ?';
  if (entity) { sql += ' AND entity = ?'; params.push(entity); }
  if (entityId != null) { sql += ' AND entity_id = ?'; params.push(entityId); }
  sql += ' ORDER BY id DESC LIMIT ?';
  params.push(limit);
  return db.prepare(sql).all(...params);
}

module.exports = { log, list };
