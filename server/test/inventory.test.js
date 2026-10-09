const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.SQLITE_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'agro-test-')), 'i.sqlite');
const migrate = require('../db/migrate');
const db = require('../db/connection');
const business = require('../services/businessService');
const purchases = require('../services/purchaseService');
const lots = require('../services/lotService');
const processing = require('../services/processingService');
const inventory = require('../services/inventoryService');
migrate();

function ctxFor(name) {
  const u = db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, 'x', 'user')").run(name);
  const b = business.ensureForUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.lastInsertRowid));
  return { businessId: b.businessId, userId: Number(u.lastInsertRowid), role: b.role };
}

/** Lote terminado: 2.000 kg netos. Compra de 2.500 kg pagables a $900.000/carga = $18.000.000. */
function finishedLot(ctx, secos = 2000) {
  const p = purchases.create(ctx, { supplier: { idNumber: '1', name: 'Juan' }, coffeeType: 'cafe_sin_merma', precioCarga: 900000, weighings: [2500] });
  const lot = lots.create(ctx, { purchaseIds: [p.id] });
  lots.changeStatus(ctx, lot.id, 'EN_TRANSPORTE');
  lots.changeStatus(ctx, lot.id, 'EN_SECADO');
  processing.finish(ctx, lot.id, { kilosSecosReales: secos });
  return lot;
}

test('PRUEBA DE INVENTARIO: entrada, venta parcial de 500 kg y saldo 1.500 kg', () => {
  const ctx = ctxFor('a@x.co');
  const lot = finishedLot(ctx);
  assert.throws(() => inventory.enter({ ...ctx, role: 'operador' }, lot.id), { status: 403 });
  const inv = inventory.enter(ctx, lot.id, { ubicacion: 'Bodega 1' });
  assert.equal(inv.kgIniciales, 2000);
  assert.equal(inv.kgDisponibles, 2000);
  assert.equal(inv.costoKg, 9000);
  assert.equal(inv.costoCarga, 1125000);
  assert.equal(inv.status, 'DISPONIBLE_PARA_VENTA');
  assert.throws(() => inventory.enter(ctx, lot.id), { status: 409 });

  inventory.removeStock(ctx, inv.id, 500);
  const after = inventory.get(ctx, inv.id);
  assert.equal(after.kgVendidos, 500);
  assert.equal(after.kgDisponibles, 1500);
  assert.equal(after.status, 'PARCIALMENTE_VENDIDO');

  assert.throws(() => inventory.removeStock(ctx, inv.id, 1500.01), { status: 409 });
  inventory.removeStock(ctx, inv.id, 1500);
  assert.equal(inventory.get(ctx, inv.id).status, 'VENDIDO');
  assert.throws(() => inventory.removeStock(ctx, inv.id, 1), { status: 409 });

  inventory.restoreStock(ctx, inv.id, 500);
  const restored = inventory.get(ctx, inv.id);
  assert.equal(restored.kgDisponibles, 500);
  assert.equal(restored.status, 'PARCIALMENTE_VENDIDO');
  const mv = inventory.movements(ctx, inv.id).map((m) => m.type);
  assert.deepEqual(mv, ['ENTRADA', 'SALIDA_VENTA', 'SALIDA_VENTA', 'AJUSTE']);
});

test('el lote debe estar SECADO_FINALIZADO y el costo queda congelado', () => {
  const ctx = ctxFor('b@x.co');
  const p = purchases.create(ctx, { supplier: { idNumber: '1', name: 'Juan' }, precioCarga: 900000, weighings: [100] });
  const lot = lots.create(ctx, { purchaseIds: [p.id] });
  assert.throws(() => inventory.enter(ctx, lot.id), { status: 409 });
  const done = finishedLot(ctx);
  inventory.enter(ctx, done.id);
  assert.throws(() => processing.addCost(ctx, done.id, { concepto: 'X', valor: 1000 }), { status: 409 });
});

test('listado: totales, solo disponibles y costos ocultos al operador; aislamiento', () => {
  const ctx = ctxFor('c@x.co');
  const inv1 = inventory.enter(ctx, finishedLot(ctx, 1000).id);
  inventory.enter(ctx, finishedLot(ctx, 2000).id);
  inventory.removeStock(ctx, inv1.id, 1000);
  const all = inventory.list(ctx);
  assert.equal(all.items.length, 2);
  assert.equal(all.totalKgDisponibles, 2000);
  assert.equal(inventory.list(ctx, { onlyAvailable: true }).items.length, 1);
  assert.equal('costoKg' in inventory.list({ ...ctx, role: 'operador' }).items[0], false);
  assert.equal(inventory.list(ctxFor('d@x.co')).items.length, 0);
  assert.throws(() => inventory.get(ctxFor('e@x.co'), inv1.id), { status: 404 });
});

test('ENVIAR FACTURA A INVENTARIO: sin secado entra directo; con secado crea el procesamiento', () => {
  const ctx = ctxFor('fact@x.co');
  const invoices = require('../services/invoiceService');
  const supplier = { idNumber: '77', name: 'Mixto', idType: 'CC' };

  const directa = invoices.create(ctx, { supplier, items: [{ productType: 'cacao', precioKg: 15000, weighings: [500] }] });
  const r1 = inventory.enterFromInvoice(ctx, directa.id);
  assert.equal(r1.needsDrying, false);
  assert.equal(r1.inventory.kgIniciales, 500);
  assert.throws(() => inventory.enterFromInvoice(ctx, directa.id), { status: 409 });

  const mixta = invoices.create(ctx, {
    supplier,
    items: [
      { productType: 'cafe', porcentajeMermaInicial: 0, precioKg: 7200, weighings: [600, 400] },
      { productType: 'cacao', precioKg: 15000, weighings: [500] },
    ],
  });
  const r2 = inventory.enterFromInvoice(ctx, mixta.id);
  assert.equal(r2.needsDrying, true);
  assert.equal(r2.inventory, null);
  assert.ok(r2.lotId);
  assert.throws(() => inventory.enterFromInvoice({ ...ctx, role: 'operador' }, mixta.id), { status: 403 });
});
