const fs = require('fs');
const path = require('path');
const db = require('./connection');

/** Columnas agregadas después de la primera versión del esquema. Se aplican sin borrar datos. */
const ADDED_COLUMNS = [
  ['users', 'phone', 'TEXT'],
  ['users', 'full_name', 'TEXT'],
  ['users', 'municipality', 'TEXT'],
  ['users', 'plan', "TEXT NOT NULL DEFAULT 'free'"],
  ['users', 'plan_expires_at', 'TEXT'],
  ['users', 'default_factor', 'REAL'],
  ['users', 'default_humidity', 'REAL'],
  ['users', 'transport_cost_cop_carga', 'REAL'],
  ['cooperatives', 'municipality', 'TEXT'],
];

function columnExists(table, column) {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((c) => c.name === column);
}

function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  ADDED_COLUMNS.forEach(([table, column, definition]) => {
    if (!columnExists(table, column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  });
}

module.exports = migrate;
