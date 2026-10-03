const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.SQLITE_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'agro-test-')), 'pf.sqlite');
const migrate = require('../db/migrate');
const db = require('../db/connection');
const business = require('../services/businessService');
const purchases = require('../services/purchaseService');
const costs = require('../services/purchaseCostService');
const lots = require('../services/lotService');
const processing = require('../services/processingService');
const inventory = require('../services/inventoryService');
const sales = require('../services/tradeSaleService');
const profit = require('../services/profitabilityService');
migrate();

function ctxFor(name) {
  const u = db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, 'x', 'user')").run(name);
  const b = business.ensureForUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.lastInsertRowid));
  return { businessId: b.businessId, userId: Number(u.lastInsertRowid), role: b.role };
}

/** Compra $18.000.000 + transporte $30.000 + procesamiento $150.000 = $18.180.000 / 2.000 kg = $9.090/kg. */
function stocked(ctx) {
  const p = purchases.create(ctx, { supplier: { idNumber: '1', name: 'Juan' }, coffeeType: 'cafe_sin_merma', precioCarga: 900000, weighings: [2500] });
  costs.add(ctx, p.id, { concepto: 'Transporte', valor: 30000 });
  const lot = lots.create(ctx, { purchaseIds: [p.id] });
  lots.changeStatus(ctx, lot.id, 'EN_TRANSPORTE');
  processing.addCost(ctx, lot.id, { concepto: 'Secado', valor: 150000 });
  lots.changeStatus(ctx, lot.id, 'EN_SECADO');
  processing.finish(ctx, lot.id, { kilosSecosReales: 2000 });
  return { lot, inv: inventory.enter(ctx, lot.id) };
}
const CLIENTE = { idType: 'NIT', idNumber: '9', name: 'Cliente' };

test('PRUEBA DE RENTABILIDAD: ingreso − costo real = utilidad real', () => {
  const ctx = ctxFor('a@x.co');
  const { lot, inv } = stocked(ctx);
  assert.equal(inv.costoKg, 9090);
  sales.create(ctx, { customer: CLIENTE, items: [{ inventoryLotId: inv.id, kg: 500, precioKg: 10000 }] });

  const o = profit.overall(ctx);
  assert.equal(o.ingresoVenta, 5000000);
  assert.equal(o.costoMercanciaVendida, 500 * 9090);
  assert.equal(o.utilidadReal, 5000000 - 4545000);
  assert.equal(o.margenReal, 9.1);

  const l = profit.byLot(ctx, lot.id);
  assert.equal(l.inversion, 18000000);
  assert.equal(l.costos, 180000);
  assert.equal(l.costoRealTotal, 18180000);
  assert.equal(l.ventas, 5000000);
  assert.equal(l.kgInventarioPendiente, 1500);
  assert.equal(l.inventarioPendienteACosto, 1500 * 9090);
  assert.equal(l.utilidadRealizada, 455000);
  assert.equal(l.utilidadPendiente, 1500 * 10000 - 1500 * 9090);
  assert.equal(l.margen, 9.1);
});

test('ventas anuladas no cuentan; lote sin ventas tiene utilidad pendiente nula', () => {
  const ctx = ctxFor('b@x.co');
  const { lot, inv } = stocked(ctx);
  const s = sales.create(ctx, { customer: CLIENTE, items: [{ inventoryLotId: inv.id, kg: 100, precioKg: 12000 }] });
  sales.voidSale(ctx, s.id, 'error');
  assert.equal(profit.overall(ctx).ingresoVenta, 0);
  const l = profit.byLot(ctx, lot.id);
  assert.equal(l.ventas, 0);
  assert.equal(l.utilidadPendiente, null);
  assert.equal(l.margen, null);
});

test('periodo, varios lotes y permisos', () => {
  const ctx = ctxFor('c@x.co');
  const a = stocked(ctx);
  const b = stocked(ctx);
  sales.create(ctx, { customer: CLIENTE, soldOn: '2026-01-10', items: [{ inventoryLotId: a.inv.id, kg: 100, precioKg: 10000 }] });
  sales.create(ctx, { customer: CLIENTE, soldOn: '2026-02-10', items: [{ inventoryLotId: b.inv.id, kg: 200, precioKg: 10000 }] });
  assert.equal(profit.overall(ctx).ingresoVenta, 3000000);
  assert.equal(profit.overall(ctx, { from: '2026-02-01' }).ingresoVenta, 2000000);
  assert.equal(profit.lots(ctx).length, 2);
  assert.throws(() => profit.overall({ ...ctx, role: 'operador' }), { status: 403 });
  assert.throws(() => profit.byLot(ctxFor('d@x.co'), a.lot.id), { status: 404 });
});
