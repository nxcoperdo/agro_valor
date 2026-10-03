const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.SQLITE_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'agro-test-')), 'l.sqlite');
const migrate = require('../db/migrate');
const db = require('../db/connection');
const business = require('../services/businessService');
const purchases = require('../services/purchaseService');
const lots = require('../services/lotService');
const receipts = require('../services/receiptService');
migrate();

function ctxFor(name) {
  const u = db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, 'x', 'user')").run(name);
  const b = business.ensureForUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.lastInsertRowid));
  return { businessId: b.businessId, userId: Number(u.lastInsertRowid), role: b.role };
}
const buy = (ctx, n, kg = 1000) => purchases.create(ctx, { supplier: { idNumber: String(n), name: `Proveedor ${n}` }, precioCarga: 900000, weighings: [kg / 2, kg / 2] });

test('PRUEBA DE LOTE MÚLTIPLE: 5 compras de 5 proveedores, 5 comprobantes, 1 lote sin perder trazabilidad', () => {
  const ctx = ctxFor('a@x.co');
  const compras = [1, 2, 3, 4, 5].map((n) => buy(ctx, n));
  const comprobantes = compras.map((p) => receipts.build(ctx, p.id));
  assert.equal(new Set(comprobantes.map((c) => c.code)).size, 5);

  const lot = lots.create(ctx, { purchaseIds: compras.map((p) => p.id) });
  assert.match(lot.code, /^AGV-\d{4}-000001$/);
  assert.equal(lot.status, 'CREADO');
  assert.equal(lot.compras, 5);
  assert.equal(lot.proveedores, 5);
  assert.equal(lot.kgRecibidos, 5000);
  assert.equal(lot.pesoPagable, 4600);
  assert.equal(lot.totalCompra, 5 * 6624000);
  assert.equal(lot.pesoProyectado, 2530);

  assert.equal(lot.purchases.length, 5);
  for (const p of compras) {
    const t = lot.purchases.find((x) => x.id === p.id);
    assert.ok(t, 'la compra sigue en el lote');
    assert.equal(t.lot.code, lot.code);
    assert.equal(t.supplier.name, p.supplier.name);
    assert.equal(t.weighings.length, 2);
    assert.match(t.workdayCode, /^JOR-/);
    // el comprobante original no cambió
    assert.deepEqual(receipts.build(ctx, p.id), comprobantes.find((c) => c.code === p.receiptCode));
  }
});

test('una compra no puede estar en dos lotes ni anulada, y una compra con lote no se anula', () => {
  const ctx = ctxFor('b@x.co');
  const [a, b] = [buy(ctx, 1), buy(ctx, 2)];
  const lot = lots.create(ctx, { purchaseIds: [a.id] });
  assert.throws(() => lots.create(ctx, { purchaseIds: [a.id, b.id] }), { status: 409 });
  assert.equal(purchases.get(ctx, b.id).lot, null, 'la transacción no dejó la segunda compra asignada');
  assert.throws(() => purchases.voidPurchase(ctx, a.id, 'x'), { status: 409 });
  purchases.voidPurchase(ctx, b.id, 'error');
  assert.throws(() => lots.create(ctx, { purchaseIds: [b.id] }), { status: 409 });
  assert.throws(() => lots.create(ctx, { purchaseIds: [] }), { status: 400 });
  assert.equal(purchases.list(ctx, { noLot: '1', status: 'ACTIVA' }).length, 0);
  assert.equal(lots.list(ctx)[0].code, lot.code);
});

test('quitar compra: solo en CREADO y nunca la última', () => {
  const ctx = ctxFor('c@x.co');
  const [a, b] = [buy(ctx, 1), buy(ctx, 2)];
  const lot = lots.create(ctx, { purchaseIds: [a.id, b.id] });
  const after = lots.removePurchase(ctx, lot.id, a.id);
  assert.equal(after.compras, 1);
  assert.equal(purchases.get(ctx, a.id).lot, null);
  assert.throws(() => lots.removePurchase(ctx, lot.id, b.id), { status: 409 });
});

test('estados: flujo manual permitido, auditoría y permisos', () => {
  const ctx = ctxFor('d@x.co');
  const lot = lots.create(ctx, { purchaseIds: [buy(ctx, 1).id] });
  assert.throws(() => lots.changeStatus(ctx, lot.id, 'EN_SECADO'), { status: 409 });
  assert.throws(() => lots.changeStatus(ctx, lot.id, 'VENDIDO'), { status: 409 });
  assert.equal(lots.changeStatus(ctx, lot.id, 'EN_TRANSPORTE').status, 'EN_TRANSPORTE');
  assert.equal(lots.changeStatus(ctx, lot.id, 'EN_SECADO').status, 'EN_SECADO');
  assert.throws(() => lots.changeStatus({ ...ctx, role: 'operador' }, lot.id, 'EN_TRANSPORTE'), { status: 403 });
  assert.throws(() => lots.create({ ...ctx, role: 'operador' }, { purchaseIds: [1] }), { status: 403 });
  assert.equal(db.prepare("SELECT COUNT(*) c FROM audit_log WHERE action='CAMBIO_ESTADO_LOTE' AND entity_id=?").get(lot.id).c, 2);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM audit_log WHERE action='CREAR_LOTE' AND entity_id=?").get(lot.id).c, 1);
});

test('el operador no ve costos del lote y otro negocio no ve el lote', () => {
  const ctx = ctxFor('e@x.co');
  const lot = lots.create(ctx, { purchaseIds: [buy(ctx, 1).id] });
  assert.equal(lots.detail(ctx, lot.id).costosCompra, 0);
  assert.equal('costosCompra' in lots.detail({ ...ctx, role: 'operador' }, lot.id), false);
  assert.throws(() => lots.detail(ctxFor('f@x.co'), lot.id), { status: 404 });
});
