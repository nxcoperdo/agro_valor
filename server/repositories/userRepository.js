const db = require('../db/connection');

const PUBLIC_FIELDS = `id, username, role, plan, plan_expires_at, phone, full_name, municipality,
  default_factor, default_humidity, transport_cost_cop_carga, created_at`;

function count() {
  return db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
}

function findByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function findById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function findPublicById(id) {
  return db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`).get(id);
}

function create({ username, passwordHash, role = 'user', phone = null, fullName = null, municipality = null, plan = 'free' }) {
  const info = db
    .prepare(
      'INSERT INTO users (username, password_hash, role, phone, full_name, municipality, plan) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(username, passwordHash, role, phone, fullName, municipality, plan);
  return findById(info.lastInsertRowid);
}

function updateProfile(id, { fullName, phone, municipality, defaultFactor, defaultHumidity, transportCostCopCarga }) {
  db.prepare(
    `UPDATE users SET
       full_name = COALESCE(?, full_name),
       phone = COALESCE(?, phone),
       municipality = COALESCE(?, municipality),
       default_factor = COALESCE(?, default_factor),
       default_humidity = COALESCE(?, default_humidity),
       transport_cost_cop_carga = COALESCE(?, transport_cost_cop_carga)
     WHERE id = ?`
  ).run(fullName, phone, municipality, defaultFactor, defaultHumidity, transportCostCopCarga, id);
  return findPublicById(id);
}

function setPlan(id, plan, expiresAt = null) {
  db.prepare('UPDATE users SET plan = ?, plan_expires_at = ? WHERE id = ?').run(plan, expiresAt, id);
  return findPublicById(id);
}

function listAll(limit = 200) {
  return db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users ORDER BY created_at DESC LIMIT ?`).all(limit);
}

module.exports = {
  count,
  findByUsername,
  findById,
  findPublicById,
  create,
  updateProfile,
  setPlan,
  listAll,
};
