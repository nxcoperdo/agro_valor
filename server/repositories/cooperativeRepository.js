const db = require('../db/connection');

/**
 * Siembra cooperativas/compradores de un mercado. En cacao no hay diferencial de referencia
 * (solo cuentan los precios que reporten los usuarios), así que entra con 0 y nunca se muestra.
 */
function seedFromConfig(cooperatives, market = 'coffee') {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO cooperatives (name, region, differential_pct, market) VALUES (?, ?, ?, ?)'
  );
  const tx = db.transaction((coops) => {
    coops.forEach((c) => insert.run(c.name, c.region || null, c.differentialPct || 0, market));
  });
  tx(cooperatives);
}

function findAllActive(market = 'coffee') {
  return db.prepare('SELECT * FROM cooperatives WHERE active = 1 AND market = ? ORDER BY name ASC').all(market);
}

/** Incluye las inactivas: para el panel admin, que necesita verlas y poder reactivarlas. */
function findAll() {
  return db.prepare('SELECT * FROM cooperatives ORDER BY active DESC, name ASC').all();
}

function findById(id) {
  return db.prepare('SELECT * FROM cooperatives WHERE id = ?').get(id);
}

function create({ name, region, municipality, differentialPct, market = 'coffee' }) {
  const info = db
    .prepare('INSERT INTO cooperatives (name, region, municipality, differential_pct, market) VALUES (?, ?, ?, ?, ?)')
    .run(name, region || null, municipality || null, differentialPct || 0, market);
  return findById(info.lastInsertRowid);
}

function update(id, { name, region, municipality, differentialPct, active }) {
  db.prepare(
    `UPDATE cooperatives SET
       name = COALESCE(?, name),
       region = COALESCE(?, region),
       municipality = COALESCE(?, municipality),
       differential_pct = COALESCE(?, differential_pct),
       active = COALESCE(?, active)
     WHERE id = ?`
  ).run(name, region, municipality, differentialPct, active == null ? null : active ? 1 : 0, id);
  return findById(id);
}

module.exports = { seedFromConfig, findAllActive, findAll, findById, create, update };
