const db = require('../db/connection');

const PUBLIC_FIELDS = `id, username, role, plan, plan_expires_at, phone, full_name, municipality,
  default_factor, default_humidity, transport_cost_cop_carga, notify_whatsapp, notify_push, created_at`;

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

function create({ username, passwordHash, role = 'user', phone = null, fullName = null, municipality = null, plan = 'free', ageVerified = false }) {
  const info = db
    .prepare(
      "INSERT INTO users (username, password_hash, role, phone, full_name, municipality, plan, age_verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(username, passwordHash, role, phone, fullName, municipality, plan, ageVerified ? new Date().toISOString().replace('T', ' ').slice(0, 19) : null);
  return findById(info.lastInsertRowid);
}

function updateProfile(
  id,
  { fullName, phone, municipality, defaultFactor, defaultHumidity, transportCostCopCarga, notifyWhatsapp, notifyPush }
) {
  const flag = (value) => (value == null ? null : value ? 1 : 0);
  db.prepare(
    `UPDATE users SET
       full_name = COALESCE(?, full_name),
       phone = COALESCE(?, phone),
       municipality = COALESCE(?, municipality),
       default_factor = COALESCE(?, default_factor),
       default_humidity = COALESCE(?, default_humidity),
       transport_cost_cop_carga = COALESCE(?, transport_cost_cop_carga),
       notify_whatsapp = COALESCE(?, notify_whatsapp),
       notify_push = COALESCE(?, notify_push)
     WHERE id = ?`
  ).run(
    fullName,
    phone,
    municipality,
    defaultFactor,
    defaultHumidity,
    transportCostCopCarga,
    flag(notifyWhatsapp),
    flag(notifyPush),
    id
  );
  return findPublicById(id);
}

function setPlan(id, plan, expiresAt = null) {
  db.prepare('UPDATE users SET plan = ?, plan_expires_at = ? WHERE id = ?').run(plan, expiresAt, id);
  return findPublicById(id);
}

function setPasswordHash(id, passwordHash) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
  return findPublicById(id);
}

/** Prueba gratis de Pro al registrarse (ver subscriptionService.startTrial). */
function startTrial(id, { expiresAt, grantedAt }) {
  db.prepare('UPDATE users SET plan = ?, plan_expires_at = ?, trial_granted_at = ? WHERE id = ?').run(
    'pro',
    expiresAt,
    grantedAt,
    id
  );
  return findById(id);
}

function setMpPayment(id, { paymentId, status }) {
  db.prepare('UPDATE users SET mp_payment_id = ?, mp_payment_status = ? WHERE id = ?').run(paymentId, status, id);
  return findPublicById(id);
}

function findAllWithMpPaymentStatus(status) {
  return db.prepare('SELECT * FROM users WHERE mp_payment_status = ?').all(status);
}

function listAll(limit = 200) {
  return db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users ORDER BY created_at DESC LIMIT ?`).all(limit);
}

/**
 * Borra la cuenta. Las tablas relacionadas ya están pensadas para esto en el esquema
 * (server/db/schema.sql): alertas, ventas y dispositivos push se borran en cascada;
 * los reportes de precio se quedan pero pierden el vínculo con el usuario (ON DELETE
 * SET NULL), porque ya son el dato colectivo que usan otros caficultores.
 */
function deleteById(id) {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

module.exports = {
  count,
  findByUsername,
  findById,
  findPublicById,
  create,
  updateProfile,
  setPlan,
  setPasswordHash,
  startTrial,
  setMpPayment,
  findAllWithMpPaymentStatus,
  listAll,
  deleteById,
};
