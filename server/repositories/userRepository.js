const db = require('../db/connection');

function count() {
  return db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
}

function findByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function create({ username, passwordHash, role = 'admin' }) {
  const info = db
    .prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .run(username, passwordHash, role);
  return findById(info.lastInsertRowid);
}

function findById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

module.exports = { count, findByUsername, create, findById };
