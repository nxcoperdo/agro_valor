const db = require('../db/connection');

/** Registra (o reasigna) el token de un teléfono. Si otra cuenta inició sesión en ese teléfono, pasa a la nueva. */
function upsert({ userId, token, platform = null }) {
  db.prepare(
    `INSERT INTO push_devices (user_id, token, platform) VALUES (?, ?, ?)
     ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, platform = excluded.platform,
       last_seen_at = datetime('now')`
  ).run(userId, token, platform);
}

function remove(token, userId) {
  return db.prepare('DELETE FROM push_devices WHERE token = ? AND user_id = ?').run(token, userId).changes;
}

function removeTokens(tokens) {
  const stmt = db.prepare('DELETE FROM push_devices WHERE token = ?');
  tokens.forEach((t) => stmt.run(t));
}

function tokensForUser(userId) {
  return db
    .prepare('SELECT token FROM push_devices WHERE user_id = ?')
    .all(userId)
    .map((r) => r.token);
}

function countForUser(userId) {
  return db.prepare('SELECT COUNT(*) AS n FROM push_devices WHERE user_id = ?').get(userId).n;
}

module.exports = { upsert, remove, removeTokens, tokensForUser, countForUser };
