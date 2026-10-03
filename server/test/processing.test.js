const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.SQLITE_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'agro-test-')), 'pr.sqlite');
const migrate = require('../db/migrate');
const db = require('../db/connection');
const business = require('../services/businessService');
const purchases = require('../services/purchaseService');
const costs = require('../services/purchaseCostService');
const projection = require('../services/projectionService');
const lots = require('../services/lotService');
const processing = require('../services/processingService');
migrate();

function ctxFor(name) {
  const u = db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, 'x', 'user')").run(name);
  const b = business.ensureForUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.lastInsertRowid));
  return { businessId: b.businessId, userId: Number(u.lastInsertRowid), role: b.role };
}

/** Lote del caso principal: 1.000 kg, 8%, $900.000 → 920 kg pagables, $6.624.000. */
function mainLot(ctx) {
  const p = purchases.create(ctx, { supplier: { idNumber: '1', name: 'Juan' }, precioCarga: 900000, weighings: [520, 480] });
  costs.add(ctx, p.id, { concepto: 'Transporte', valor: 30000 });
  projection.save(ctx, p.id, { rendimientoSecadoPct: 55, precioVentaCarga: 1000000, costos: [{ concepto: 'Secado', valor: 300, modo: 'por_kg' }] });
  return lots.create(ctx, { purchaseIds: [p.id] });
}

test('PRUEBA DE PROCESAMIENTO: resultado real y proyectado vs real', () => {
  const ctx = ctxFor('a@x.co');
  const lot = mainLot(ctx);
  lots.changeStatus(ctx, lot.id, 'EN_TRANSPORTE');
  processing.saveShipment(ctx, lot.id, { fechaEnvio: '2026-10-03', lugar: 'Trilladora Huila' });
  processing.addCost(ctx, lot.id, { concepto: 'Transporte real', valor: 40000 });
  processing.addCost(ctx, lot.id, { concepto: 'Secado', valor: 160000 });
  lots.changeStatus(ctx, lot.id, 'EN_SECADO');

  assert.equal(processing.get(ctx, lot.id).comparacion.tieneReal, false);
  const r = processing.finish(ctx, lot.id, { kilosSecosReales: 518, destareRealKg: 0 });
  assert.equal(r.status, 'SECADO_FINALIZADO');
  assert.equal(r.resultadoReal.rendimientoReal, 56.3);
  assert.equal(r.resultadoReal.kilosNetosReales, 518);
  assert.equal(r.resultadoReal.costoRealTotal, 6624000 + 30000 + 200000);
  assert.equal(r.resultadoReal.costoRealKg, Math.round(6854000 / 518));
  assert.equal(r.resultadoReal.costoRealCarga, Math.round((6854000 / 518) * 125));

  const row = (k) => r.comparacion.filas.find((f) => f.key === k);
  assert.equal(row('kilosSecos').proyectado, 506);
  assert.equal(row('kilosSecos').real, 518);
  assert.equal(row('kilosSecos').diferencia, 12);
  assert.equal(row('rendimiento').proyectado, 55);
  assert.equal(row('rendimiento').real, 56.3);
  assert.equal(row('costosProcesamiento').proyectado, 151800);
  assert.equal(row('costosProcesamiento').real, 200000);
  assert.equal(row('costoTotal').proyectado, 6624000 + 30000 + 151800);
  assert.equal(row('utilidadFutura').proyectado, 506 * 8000 - (6624000 + 30000 + 151800));
  assert.equal(row('utilidadFutura').real, Math.round(518 * 8000 - 6854000));
});

test('reglas de procesamiento: estado, validaciones y permisos', () => {
  const ctx = ctxFor('b@x.co');
  const lot = mainLot(ctx);
  assert.throws(() => processing.finish(ctx, lot.id, { kilosSecosReales: 500 }), { status: 409 });
  lots.changeStatus(ctx, lot.id, 'EN_TRANSPORTE');
  lots.changeStatus(ctx, lot.id, 'EN_SECADO');
  assert.throws(() => processing.finish(ctx, lot.id, { kilosSecosReales: 0 }), { status: 400 });
  assert.throws(() => processing.finish(ctx, lot.id, { kilosSecosReales: 100, destareRealKg: 100 }), { status: 400 });
  assert.throws(() => processing.addCost(ctx, lot.id, { concepto: '', valor: 5 }), { status: 400 });
  const op = { ...ctx, role: 'operador' };
  assert.throws(() => processing.get(op, lot.id), { status: 403 });
  assert.throws(() => processing.finish(op, lot.id, { kilosSecosReales: 500 }), { status: 403 });
  const f = processing.finish(ctx, lot.id, { kilosSecosReales: 506, destareRealKg: 6 });
  assert.equal(f.resultadoReal.kilosNetosReales, 500);
  assert.throws(() => processing.saveShipment(ctx, lot.id, {}), { status: 409 });
  assert.equal(db.prepare("SELECT COUNT(*) c FROM audit_log WHERE action='SALIDA_REAL'").get().c >= 1, true);
});

test('lote con varias compras: proyectado suma las compras, anuladas no cuentan', () => {
  const ctx = ctxFor('c@x.co');
  const mk = (n) => purchases.create(ctx, { supplier: { idNumber: String(n), name: `P${n}` }, precioCarga: 900000, weighings: [1000] });
  const [a, b, c] = [mk(1), mk(2), mk(3)];
  purchases.voidPurchase(ctx, c.id, 'error');
  const lot = lots.create(ctx, { purchaseIds: [a.id, b.id] });
  const cmp = processing.compareProjectedVsReal(ctx, lot.id);
  assert.equal(cmp.filas.find((f) => f.key === 'kilosSecos').proyectado, 1012);
  assert.equal(cmp.filas.find((f) => f.key === 'costoTotal').proyectado, 2 * 6624000);
  assert.equal(cmp.filas.find((f) => f.key === 'utilidadFutura').proyectado, null);
});
