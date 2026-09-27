const db = require('../db/connection');

function create({ userId, codeHash, expiresAt }) {
  const info = db
    .prepare('INSERT INTO password_resets (user_id, code_hash, expires_at) VALUES (?, ?, ?)')
    .run(userId, codeHash, expiresAt);
  return db.prepare('SELECT * FROM password_resets WHERE id = ?').get(info.lastInsertRowid);
}

/** El más reciente que todavía sirve: no usado y no vencido. */
function findActiveByUser(userId) {
  return db
    .prepare(
      `SELECT * FROM password_resets
       WHERE user_id = ? AND used_at IS NULL AND expires_at > datetime('now')
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(userId);
}

function markUsed(id) {
  db.prepare("UPDATE password_resets SET used_at = datetime('now') WHERE id = ?").run(id);
}

/** Se llama antes de crear uno nuevo, para que solo el último código pedido sirva. */
function deleteActiveByUser(userId) {
  db.prepare('DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL').run(userId);
}

module.exports = { create, findActiveByUser, markUsed, deleteActiveByUser };
