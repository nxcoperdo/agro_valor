const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const env = require('../config/env');

fs.mkdirSync(path.dirname(env.sqliteDbPath), { recursive: true });

const db = new DatabaseSync(env.sqliteDbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

/**
 * Polyfill al estilo better-sqlite3: envuelve fn en BEGIN/COMMIT con rollback en caso de error.
 * Es reentrante: una transacción dentro de otra usa SAVEPOINT, así un servicio puede llamar a otro
 * que también abre transacción sin romperse.
 */
let txDepth = 0;
db.transaction = (fn) => (...args) => {
  const nested = txDepth > 0;
  const savepoint = `sp_${txDepth}`;
  db.exec(nested ? `SAVEPOINT ${savepoint}` : 'BEGIN IMMEDIATE');
  txDepth += 1;
  try {
    const result = fn(...args);
    txDepth -= 1;
    db.exec(nested ? `RELEASE ${savepoint}` : 'COMMIT');
    return result;
  } catch (err) {
    txDepth -= 1;
    db.exec(nested ? `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}` : 'ROLLBACK');
    throw err;
  }
};

module.exports = db;
