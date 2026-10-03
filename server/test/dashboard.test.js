const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.SQLITE_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'agro-test-')), 'd.sqlite');
const migrate = require('../db/migrate');
const db = require('../db/connection');
const business = require('../services/businessService');
const purchases = require('../services/purchaseService');
const lots = require('../services/lotService');
const processing = require('../services/processingService');
const inventory = require('../services/inventoryService');
const sales = require('../services/tradeSaleService');
const dashboard = require('../services/dashboardService');
migrate();

function ctxFor(name) {
  const u = db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, 'x', 'user')").run(name);
  const b = business.ensureForUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.lastInsertRowid));
  return { businessId: b.businessId, userId: Number(u.lastInsertRowid), role: b.role };
}

test('dashboard: indicadores de punta a punta', () => {
  const ctx = ctxFor('a@x.co');
  assert.equal(dashboard.get(ctx).comprasHoy, 0);
  assert.equal(dashboard.get(ctx).costoPromedioKg, null);
  const p = purchases.create(ctx, { supplier: { idNumber: '1', name: 'Juan' }, coffeeType: 'cafe_sin_merma', precioCarga: 900000, weighings: [2500] });
  purchases.create(ctx, { supplier: { idNumber: '2', name: 'Ana' }, precioCarga: 900000, weighings: [1000] });
  let d = dashboard.get(ctx);
  assert.equal(d.comprasHoy, 2);
  assert.equal(d.kgComprados, 3500);
  assert.equal(d.totalInvertido, 18000000 + 6624000);
  const lot = lots.create(ctx, { purchaseIds: [p.id] });
  lots.changeStatus(ctx, lot.id, 'EN_TRANSPORTE');
  lots.changeStatus(ctx, lot.id, 'EN_SECADO');
  processing.finish(ctx, lot.id, { kilosSecosReales: 2000 });
  const inv = inventory.enter(ctx, lot.id);
  sales.create(ctx, { customer: { idNumber: '9', name: 'C' }, items: [{ inventoryLotId: inv.id, kg: 500, precioKg: 10000 }] });
  d = dashboard.get(ctx);
  assert.equal(d.lotesActivos, 1);
  assert.equal(d.kgInventario, 1500);
  assert.equal(d.ventas, 5000000);
  assert.equal(d.costoPromedioKg, 9000);
  assert.equal(d.costoPromedioCarga, 1125000);
  assert.equal(d.utilidad, 5000000 - 500 * 9000);
  assert.equal(d.margen, 10);
});

test('el operador no recibe costos, utilidad ni margen', () => {
  const ctx = ctxFor('b@x.co');
  const d = dashboard.get({ ...ctx, role: 'operador' });
  for (const k of ['costoPromedioKg', 'costoPromedioCarga', 'utilidad', 'margen']) assert.equal(k in d, false, k);
  assert.ok('totalInvertido' in d);
});
