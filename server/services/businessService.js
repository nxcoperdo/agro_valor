const db = require('../db/connection');

/**
 * Devuelve la membresía del usuario; si no tiene negocio, crea uno donde queda como admin.
 * (Los usuarios existentes obtienen su negocio la primera vez que usan el módulo de café.)
 */
function ensureForUser(user) {
  const find = () =>
    db
      .prepare(
        `SELECT m.business_id AS businessId, m.role, b.name FROM business_members m
         JOIN businesses b ON b.id = m.business_id WHERE m.user_id = ? ORDER BY m.id LIMIT 1`
      )
      .get(user.id);
  const existing = find();
  if (existing) return existing;
  db.transaction(() => {
    const info = db.prepare('INSERT INTO businesses (name, phone) VALUES (?, ?)').run(
      user.full_name || user.username || 'Mi negocio',
      user.phone || null
    );
    db.prepare("INSERT INTO business_members (business_id, user_id, role) VALUES (?, ?, 'admin')").run(
      info.lastInsertRowid,
      user.id
    );
  })();
  return find();
}

module.exports = { ensureForUser };
