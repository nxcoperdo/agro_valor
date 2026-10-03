const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.SQLITE_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'agro-test-')), 'c.sqlite');
const migrate = require('../db/migrate');
const db = require('../db/connection');
const business = require('../services/businessService');
const purchases = require('../services/purchaseService');
const costs = require('../services/purchaseCostService');
const projection = require('../services/projectionService');
const workdays = require('../services/workdayService');
migrate();

function ctxFor(name) {
  const u = db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, 'x', 'user')").run(name);
  const b = business.ensureForUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.lastInsertRowid));
  return { businessId: b.businessId, userId: Number(u.lastInsertRowid), role: b.role };
}
const main = (ctx) => purchases.create(ctx, { supplier: { idNumber: '1', name: 'Juan' }, precioCarga: 900000, weighings: [520, 480] });

test('costos internos: costoAdquisicion = compra + costos, y entran al consolidado', () => {
  const ctx = ctxFor('a@x.co');
  const p = main(ctx);
  costs.add(ctx, p.id, { concepto: 'Transporte', valor: 20000 });
  const r = costs.add(ctx, p.id, { concepto: 'Báscula', valor: 10000, observacion: 'pesaje' });
  assert.equal(r.totalCostos, 30000);
  assert.equal(r.costoAdquisicion, 6654000);
  assert.equal(workdays.current(ctx).summary.costosInternos, 30000);
  const after = costs.remove(ctx, p.id, r.costos[0].id);
  assert.equal(after.costoAdquisicion, 6634000);
});

test('costos: validaciones y permisos', () => {
  const ctx = ctxFor('b@x.co');
  const p = main(ctx);
  assert.throws(() => costs.add(ctx, p.id, { concepto: '', valor: 5 }), { status: 400 });
  assert.throws(() => costs.add(ctx, p.id, { concepto: 'X', valor: -5 }), { status: 400 });
  const op = { ...ctx, role: 'operador' };
  assert.throws(() => costs.list(op, p.id), { status: 403 });
  assert.throws(() => costs.add(op, p.id, { concepto: 'X', valor: 5 }), { status: 403 });
  assert.throws(() => projection.get(op, p.id), { status: 403 });
  purchases.voidPurchase(ctx, p.id, 'x');
  assert.throws(() => costs.add(ctx, p.id, { concepto: 'X', valor: 5 }), { status: 409 });
});

test('proyección por defecto: 55% → 506 kg secos', () => {
  const ctx = ctxFor('c@x.co');
  const p = main(ctx);
  const r = projection.get(ctx, p.id);
  assert.equal(r.guardada, false);
  assert.equal(r.kilosSecosProyectados, 506);
  assert.equal(r.costoTotalProyectado, 6624000);
  assert.equal(r.costoMinimoKg, Math.round(6624000 / 506));
});

test('proyección guardada: costos por kg y total, destare, precio de venta y margen', () => {
  const ctx = ctxFor('d@x.co');
  const p = main(ctx);
  costs.add(ctx, p.id, { concepto: 'Transporte', valor: 30000 });
  const r = projection.save(ctx, p.id, {
    rendimientoSecadoPct: 55, destareKg: 6, precioVentaCarga: 1000000,
    costos: [{ concepto: 'Secado', valor: 300, modo: 'por_kg' }, { concepto: 'Bodegaje', valor: 50000, modo: 'total' }],
  });
  assert.equal(r.guardada, true);
  assert.equal(r.kilosNetosProyectados, 500);
  assert.equal(r.costosProcesamientoProyectados, 201800);
  assert.equal(r.costoTotalProyectado, 6624000 + 30000 + 201800);
  assert.equal(r.costoAdquisicion, 6654000);
  assert.equal(r.ingresoProyectado, 4000000);
  assert.equal(r.utilidadProyectada, 4000000 - r.costoTotalProyectado);
  assert.equal(r.costoMinimoCarga, Math.round((r.costoTotalProyectado / 500) * 125));
  assert.equal(db.prepare('SELECT kilos_secos FROM purchase_projections WHERE purchase_id = ?').get(p.id).kilos_secos, 506);
});

test('proyección: el contador no gestiona; sin ver_margenes se ocultan utilidad y margen', () => {
  const ctx = ctxFor('e@x.co');
  const p = main(ctx);
  projection.save(ctx, p.id, { precioVentaCarga: 1000000 });
  const cont = { ...ctx, role: 'contador' };
  assert.throws(() => projection.save(cont, p.id, {}), { status: 403 });
  assert.ok('utilidadProyectada' in projection.get(cont, p.id));
  assert.throws(() => projection.save(ctx, p.id, { rendimientoSecadoPct: 0 }), { status: 400 });
  assert.throws(() => projection.save(ctx, p.id, { costos: [{ concepto: 'a', valor: 1, modo: 'xx' }] }), { status: 400 });
});
