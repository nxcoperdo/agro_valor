const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.SQLITE_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'agro-test-')), 's.sqlite');
const migrate = require('../db/migrate');
const db = require('../db/connection');
const business = require('../services/businessService');
const purchases = require('../services/purchaseService');
const lots = require('../services/lotService');
const processing = require('../services/processingService');
const inventory = require('../services/inventoryService');
const sales = require('../services/tradeSaleService');
migrate();

function ctxFor(name) {
  const u = db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, 'x', 'user')").run(name);
  const b = business.ensureForUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.lastInsertRowid));
  return { businessId: b.businessId, userId: Number(u.lastInsertRowid), role: b.role };
}
function stocked(ctx, n, secos = 2000) {
  const p = purchases.create(ctx, { supplier: { idNumber: String(n), name: `P${n}` }, coffeeType: 'cafe_sin_merma', precioCarga: 900000, weighings: [2500] });
  const lot = lots.create(ctx, { purchaseIds: [p.id] });
  lots.changeStatus(ctx, lot.id, 'EN_TRANSPORTE');
  lots.changeStatus(ctx, lot.id, 'EN_SECADO');
  processing.finish(ctx, lot.id, { kilosSecosReales: secos });
  return inventory.enter(ctx, lot.id);
}
const CLIENTE = { idType: 'NIT', idNumber: '900.555', name: 'Exportadora S.A.' };

test('venta parcial: 500 kg de 2.000, saldo 1.500, VTA-AAAA-000001', () => {
  const ctx = ctxFor('a@x.co');
  const inv = stocked(ctx, 1);
  const s = sales.create(ctx, { customer: CLIENTE, paymentMethod: 'transferencia', items: [{ inventoryLotId: inv.id, kg: 500, factor: 88, precioCarga: 1100000 }] });
  assert.match(s.code, /^VTA-\d{4}-000001$/);
  assert.equal(s.items[0].precioKg, 8800);
  assert.equal(s.items[0].subtotal, 4400000);
  assert.equal(s.total, 4400000);
  assert.equal(s.items[0].factor, 88);
  assert.equal(s.items[0].costoKg, 9000);
  assert.equal(inventory.get(ctx, inv.id).kgDisponibles, 1500);
  assert.equal(inventory.get(ctx, inv.id).status, 'PARCIALMENTE_VENDIDO');
});

test('venta de varios lotes en una sola venta, con trazabilidad por línea', () => {
  const ctx = ctxFor('b@x.co');
  const [a, b] = [stocked(ctx, 1), stocked(ctx, 2, 1000)];
  const s = sales.create(ctx, { customer: CLIENTE, items: [{ inventoryLotId: a.id, kg: 2000, precioKg: 9000 }, { inventoryLotId: b.id, kg: 400, precioKg: 9500 }] });
  assert.equal(s.items.length, 2);
  assert.equal(s.total, 2000 * 9000 + 400 * 9500);
  assert.equal(s.items[0].lotCode, a.lot.code);
  assert.equal(inventory.get(ctx, a.id).status, 'VENDIDO');
  assert.equal(inventory.get(ctx, b.id).kgDisponibles, 600);
});

test('la venta es atómica: si una línea falla no se descuenta nada ni se consume consecutivo visible', () => {
  const ctx = ctxFor('c@x.co');
  const [a, b] = [stocked(ctx, 1), stocked(ctx, 2, 1000)];
  assert.throws(() => sales.create(ctx, { customer: CLIENTE, items: [{ inventoryLotId: a.id, kg: 100, precioKg: 9000 }, { inventoryLotId: b.id, kg: 5000, precioKg: 9000 }] }), { status: 409 });
  assert.equal(inventory.get(ctx, a.id).kgDisponibles, 2000);
  assert.equal(sales.list(ctx).length, 0);
});

test('validaciones, permisos y aislamiento', () => {
  const ctx = ctxFor('d@x.co');
  const inv = stocked(ctx, 1);
  const base = { customer: CLIENTE, items: [{ inventoryLotId: inv.id, kg: 10, precioKg: 9000 }] };
  assert.throws(() => sales.create({ ...ctx, role: 'operador' }, base), { status: 403 });
  assert.throws(() => sales.create(ctx, { ...base, items: [] }), { status: 400 });
  assert.throws(() => sales.create(ctx, { ...base, items: [{ inventoryLotId: inv.id, kg: 0, precioKg: 1 }] }), { status: 400 });
  assert.throws(() => sales.create(ctx, { ...base, items: [{ inventoryLotId: inv.id, kg: 1 }] }), { status: 400 });
  assert.throws(() => sales.create(ctx, { ...base, paymentMethod: 'cheque' }), { status: 400 });
  assert.throws(() => sales.create(ctx, { ...base, customer: null }), { status: 400 });
  const other = ctxFor('e@x.co');
  assert.throws(() => sales.create(other, base), { status: 404 });
  const s = sales.create(ctx, base);
  assert.throws(() => sales.get(other, s.id), { status: 404 });
  assert.equal('costoKg' in sales.get({ ...ctx, role: 'operador' }, s.id).items[0], false);
});

test('anular venta devuelve el inventario y no se puede anular dos veces', () => {
  const ctx = ctxFor('f@x.co');
  const inv = stocked(ctx, 1);
  const s = sales.create(ctx, { customer: CLIENTE, items: [{ inventoryLotId: inv.id, kg: 2000, precioKg: 9000 }] });
  assert.equal(inventory.get(ctx, inv.id).status, 'VENDIDO');
  assert.throws(() => sales.voidSale({ ...ctx, role: 'operador' }, s.id, 'x'), { status: 403 });
  assert.throws(() => sales.voidSale(ctx, s.id, ''), { status: 400 });
  const v = sales.voidSale(ctx, s.id, 'Cliente canceló');
  assert.equal(v.status, 'ANULADA');
  assert.equal(inventory.get(ctx, inv.id).kgDisponibles, 2000);
  assert.equal(inventory.get(ctx, inv.id).status, 'DISPONIBLE_PARA_VENTA');
  assert.throws(() => sales.voidSale(ctx, s.id, 'otra'), { status: 409 });
});

test('comprobante de venta: sin costos ni utilidad, y PDF válido', async () => {
  const ctx = ctxFor('g@x.co');
  const inv = stocked(ctx, 1);
  const s = sales.create(ctx, { customer: CLIENTE, items: [{ inventoryLotId: inv.id, kg: 100, factor: 90, precioKg: 9000 }] });
  const r = sales.receipt(ctx, s.id);
  assert.equal(r.total, 900000);
  assert.ok(!JSON.stringify(r).toLowerCase().includes('costo'));
  const buf = await sales.receiptPdf(ctx, s.id);
  assert.equal(buf.subarray(0, 5).toString(), '%PDF-');
});
