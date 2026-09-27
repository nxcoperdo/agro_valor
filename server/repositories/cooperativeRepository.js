const db = require('../db/connection');

function seedFromConfig(cooperatives) {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO cooperatives (name, region, differential_pct) VALUES (?, ?, ?)'
  );
  const tx = db.transaction((coops) => {
    coops.forEach((c) => insert.run(c.name, c.region, c.differentialPct));
  });
  tx(cooperatives);
}

function findAllActive() {
  return db.prepare('SELECT * FROM cooperatives WHERE active = 1 ORDER BY name ASC').all();
}

/** Incluye las inactivas: para el panel admin, que necesita verlas y poder reactivarlas. */
function findAll() {
  return db.prepare('SELECT * FROM cooperatives ORDER BY active DESC, name ASC').all();
}

function findById(id) {
  return db.prepare('SELECT * FROM cooperatives WHERE id = ?').get(id);
}

function create({ name, region, municipality, differentialPct }) {
  const info = db
    .prepare('INSERT INTO cooperatives (name, region, municipality, differential_pct) VALUES (?, ?, ?, ?)')
    .run(name, region || null, municipality || null, differentialPct || 0);
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
