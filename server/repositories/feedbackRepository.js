const db = require('../db/connection');

function create({ userId, type, message, platform, appVersion }) {
  const info = db
    .prepare('INSERT INTO feedback (user_id, type, message, platform, app_version) VALUES (?, ?, ?, ?, ?)')
    .run(userId, type, message, platform, appVersion);
  return db.prepare('SELECT * FROM feedback WHERE id = ?').get(info.lastInsertRowid);
}

function countToday(userId) {
  return db
    .prepare("SELECT COUNT(*) AS n FROM feedback WHERE user_id = ? AND date(created_at) = date('now')")
    .get(userId).n;
}

function findByUser(userId, limit = 30) {
  return db.prepare('SELECT * FROM feedback WHERE user_id = ? ORDER BY id DESC LIMIT ?').all(userId, limit);
}

/** Lista para el panel de administración, con el correo de quien escribió. */
function findRecent(limit = 100) {
  return db
    .prepare(
      `SELECT f.*, u.username
       FROM feedback f
       LEFT JOIN users u ON u.id = f.user_id
       ORDER BY f.id DESC
       LIMIT ?`
    )
    .all(limit);
}

function updateStatus(id, status) {
  const info = db.prepare('UPDATE feedback SET status = ? WHERE id = ?').run(status, id);
  return info.changes > 0 ? db.prepare('SELECT * FROM feedback WHERE id = ?').get(id) : null;
}

function countPending() {
  return db.prepare("SELECT COUNT(*) AS n FROM feedback WHERE status = 'nuevo'").get().n;
}

module.exports = { create, countToday, findByUser, findRecent, updateStatus, countPending };
