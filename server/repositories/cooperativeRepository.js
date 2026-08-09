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

module.exports = { seedFromConfig, findAllActive };
