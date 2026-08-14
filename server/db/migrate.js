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
  // Hora del dato en la bolsa, distinta de cuándo lo consultamos nosotros.
  ['coffee_prices', 'quoted_at', 'TEXT'],
  ['coffee_prices', 'meta', 'TEXT'],
];

function columnExists(table, column) {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((c) => c.name === column);
}

function tableExists(table) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function migrate() {
  // forecast_cache es pura caché (se vacía y reescribe completa en cada recálculo), así que
  // si viene del esquema viejo (columna "horizon" en vez de "granularity"/"step") se puede
  // tirar sin perder nada real: el próximo refresh la vuelve a poblar con el formato nuevo.
  if (tableExists('forecast_cache') && !columnExists('forecast_cache', 'granularity')) {
    db.exec('DROP TABLE forecast_cache');
  }

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  ADDED_COLUMNS.forEach(([table, column, definition]) => {
    if (!columnExists(table, column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  });
}

module.exports = migrate;
