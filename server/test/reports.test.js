const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.SQLITE_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'agro-test-')), 'rp.sqlite');
const migrate = require('../db/migrate');
const db = require('../db/connection');
const business = require('../services/businessService');
const purchases = require('../services/purchaseService');
const lots = require('../services/lotService');
const processing = require('../services/processingService');
const inventory = require('../services/inventoryService');
const sales = require('../services/tradeSaleService');
const reports = require('../services/reportService');
migrate();

function ctxFor(name) {
  const u = db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, 'x', 'user')").run(name);
  const b = business.ensureForUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.lastInsertRowid));
  return { businessId: b.businessId, userId: Number(u.lastInsertRowid), role: b.role };
}

function scenario() {
  const ctx = ctxFor(`s${Math.random()}@x.co`);
  const mk = (n, type, kg) => purchases.create(ctx, { supplier: { idNumber: String(n), name: `Prov ${n}` }, coffeeType: type, precioCarga: 900000, weighings: [kg] });
  const a = mk(1, 'cafe_verde', 1000);
  const b = mk(2, 'cafe_verde', 500);
  const c = mk(3, 'cafe_sin_merma', 2500);
  const lot = lots.create(ctx, { purchaseIds: [c.id] });
  lots.changeStatus(ctx, lot.id, 'EN_TRANSPORTE');
  lots.changeStatus(ctx, lot.id, 'EN_SECADO');
  processing.finish(ctx, lot.id, { kilosSecosReales: 2000 });
  const inv = inventory.enter(ctx, lot.id);
  sales.create(ctx, { customer: { idNumber: '9', name: 'Cliente' }, items: [{ inventoryLotId: inv.id, kg: 500, factor: 88, precioKg: 10000 }] });
  sales.create(ctx, { customer: { idNumber: '9', name: 'Cliente' }, items: [{ inventoryLotId: inv.id, kg: 300, factor: 90, precioKg: 9500 }] });
  return { ctx, a, b, c, lot };
}

test('reportes por periodo, proveedor, tipo de café y jornada', () => {
  const { ctx } = scenario();
  const d = reports.build(ctx, 'diario');
  assert.equal(d.rows.length, 1);
  assert.equal(d.rows[0].compras, 3);
  assert.equal(d.rows[0].kgRecibidos, 4000);
  assert.equal(reports.build(ctx, 'semanal').rows[0].compras, 3);
  assert.equal(reports.build(ctx, 'mensual').rows[0].compras, 3);

  const prov = reports.build(ctx, 'proveedor');
  assert.equal(prov.rows.length, 3);
  const p3 = prov.rows.find((r) => r.label === 'Prov 3');
  assert.equal(p3.kgPagables, 2500);
  assert.equal(p3.rendimientoLotes, 80);
  assert.equal(prov.rows.find((r) => r.label === 'Prov 1').rendimientoLotes, null);

  const tipo = reports.build(ctx, 'tipo-cafe');
  assert.equal(tipo.rows.find((r) => r.label === 'Café verde').compras, 2);
  assert.equal(tipo.rows.find((r) => r.label === 'Café sin merma').mermaPromedio, 0);
  assert.equal(reports.build(ctx, 'jornada').rows[0].compras, 3);
  assert.equal(reports.build(ctx, 'comprador').rows[0].compras, 3);
});

test('reportes de lote, factor, ventas y rentabilidad', () => {
  const { ctx, lot } = scenario();
  const l = reports.build(ctx, 'lote').rows.find((r) => r.label === lot.code);
  assert.equal(l.compraOriginal, 18000000);
  assert.equal(l.proyeccionKgSecos, 1375);
  assert.equal(l.realKgSecos, 2000);
  assert.equal(l.vendidosKg, 800);
  assert.equal(l.inventarioKg, 1200);
  assert.equal(l.costoRealTotal, 18000000);
  assert.equal(l.utilidadRealizada, 500 * 10000 + 300 * 9500 - 800 * 9000);

  const f = reports.build(ctx, 'factor').rows;
  assert.deepEqual(f.map((r) => r.label), ['Factor 88', 'Factor 90']);
  assert.equal(f[0].precioPromedioKg, 10000);
  assert.equal(reports.build(ctx, 'ventas').rows.length, 2);
  const rent = reports.build(ctx, 'rentabilidad').rows[0];
  assert.equal(rent.ventas, 7850000);
});

test('rango explícito, validaciones, permisos y PDF', async () => {
  const { ctx } = scenario();
  assert.equal(reports.build(ctx, 'proveedor', { from: '2020-01-01', to: '2020-12-31' }).rows.length, 0);
  assert.throws(() => reports.build(ctx, 'proveedor', { from: 'hoy' }), { status: 400 });
  assert.throws(() => reports.build(ctx, 'inventado'), { status: 404 });
  const op = { ...ctx, role: 'operador' };
  assert.throws(() => reports.build(op, 'rentabilidad'), { status: 403 });
  assert.equal('costoRealTotal' in reports.build(op, 'lote').rows[0], false);
  assert.equal('utilidadRealizada' in reports.build(op, 'lote').rows[0], false);
  const buf = await reports.pdf(ctx, 'proveedor', {});
  assert.equal(buf.subarray(0, 5).toString(), '%PDF-');
  assert.equal(reports.build(ctxFor('z@x.co'), 'proveedor').rows.length, 0);
});

test('precio por carga promedio ponderado por kg pagables, no promedio simple', () => {
  const ctx = ctxFor(`w${Math.random()}@x.co`);
  const mk = (n, kg, precioCarga) => purchases.create(ctx, { supplier: { idNumber: String(n), name: `P ${n}` }, coffeeType: 'cafe_verde', precioCarga, weighings: [kg] });
  mk(1, 1000, 800000); // 920 kg pagables
  mk(2, 500, 1000000); // 460 kg pagables
  const row = reports.build(ctx, 'diario').rows[0];
  // (800.000 × 920 + 1.000.000 × 460) / 1.380 = 866.667; el promedio simple daría 900.000
  assert.equal(row.precioCargaPromedio, 866667);
});
