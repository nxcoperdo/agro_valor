const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const env = require('../config/env');

fs.mkdirSync(path.dirname(env.sqliteDbPath), { recursive: true });

const db = new DatabaseSync(env.sqliteDbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

/** Polyfill al estilo better-sqlite3: envuelve fn en BEGIN/COMMIT con rollback en caso de error. */
db.transaction = (fn) => (...args) => {
  db.exec('BEGIN');
  try {
    const result = fn(...args);
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
};

module.exports = db;
