const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.SQLITE_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'agro-test-')), 'p.sqlite');
const migrate = require('../db/migrate');
const db = require('../db/connection');
const business = require('../services/businessService');
const purchases = require('../services/purchaseService');
const suppliers = require('../services/supplierService');
migrate();

function ctxFor(name, role) {
  const u = db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, 'x', 'user')").run(name);
  const b = business.ensureForUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.lastInsertRowid));
  return { businessId: b.businessId, userId: Number(u.lastInsertRowid), role: role || b.role };
}
const JUAN = { idType: 'CC', idNumber: '123.456', name: 'Juan Pérez' };

test('compra principal: 2 pesadas 520+480, merma 8%, $900.000/carga', () => {
  const ctx = ctxFor('a@x.co');
  const p = purchases.create(ctx, {
    supplier: JUAN, coffeeType: 'cafe_verde', precioCarga: 900000, paymentMethod: 'transferencia',
    weighings: [{ pesoKg: 520 }, { pesoKg: 480, notes: 'segunda' }],
  });
  assert.match(p.code, /^COMP-\d{4}-000001$/);
  assert.equal(p.receiptCode, p.code);
  assert.equal(p.pesoTotalCompra, 1000);
  assert.equal(p.porcentajeMermaInicial, 8);
  assert.equal(p.kgDescontados, 80);
  assert.equal(p.pesoPagable, 920);
  assert.equal(p.precioKg, 7200);
  assert.equal(p.totalCompra, 6624000);
  assert.equal(p.weighings.length, 2);
  assert.equal(p.supplier.idNumber, '123456');
});

test('merma editable y por defecto según tipo', () => {
  const ctx = ctxFor('b@x.co');
  const base = { supplier: JUAN, precioCarga: 900000, weighings: [1000] };
  assert.equal(purchases.create(ctx, { ...base, coffeeType: 'cafe_sin_merma' }).pesoPagable, 1000);
  assert.equal(purchases.create(ctx, { ...base, coffeeType: 'cafe_merma_5' }).pesoPagable, 950);
  assert.equal(purchases.create(ctx, { ...base, coffeeType: 'otro', porcentajeMermaInicial: 10 }).pesoPagable, 900);
});

test('el proveedor creado en la compra se reutiliza por identificación', () => {
  const ctx = ctxFor('c@x.co');
  const a = purchases.create(ctx, { supplier: JUAN, precioCarga: 900000, weighings: [100] });
  const b = purchases.create(ctx, { supplier: { ...JUAN, name: 'Otro nombre' }, precioCarga: 900000, weighings: [100] });
  assert.equal(a.supplier.id, b.supplier.id);
  assert.throws(() => suppliers.create(ctx, JUAN), { status: 409 });
});

test('validaciones', () => {
  const ctx = ctxFor('d@x.co');
  const ok = { supplier: JUAN, precioCarga: 900000, weighings: [100] };
  assert.throws(() => purchases.create(ctx, { ...ok, weighings: [] }), { status: 400 });
  assert.throws(() => purchases.create(ctx, { ...ok, weighings: [0] }), { status: 400 });
  assert.throws(() => purchases.create(ctx, { ...ok, precioCarga: 0 }), { status: 400 });
  assert.throws(() => purchases.create(ctx, { ...ok, paymentMethod: 'cheque' }), { status: 400 });
  assert.throws(() => purchases.create(ctx, { ...ok, supplier: null }), { status: 400 });
  assert.equal(purchases.list(ctx).length, 0, 'las compras inválidas no dejan filas');
});

test('anular: exige permiso y motivo, no borra, queda en auditoría', () => {
  const admin = ctxFor('e@x.co');
  const p = purchases.create(admin, { supplier: JUAN, precioCarga: 900000, weighings: [100] });
  const operador = { ...admin, role: 'operador' };
  assert.throws(() => purchases.voidPurchase(operador, p.id, 'x'), { status: 403 });
  assert.throws(() => purchases.voidPurchase(admin, p.id, ' '), { status: 400 });
  const v = purchases.voidPurchase(admin, p.id, 'Error de digitación');
  assert.equal(v.status, 'ANULADA');
  assert.equal(v.voidReason, 'Error de digitación');
  assert.throws(() => purchases.voidPurchase(admin, p.id, 'otra vez'), { status: 409 });
  assert.equal(purchases.list(admin, { status: 'ANULADA' }).length, 1);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM audit_log WHERE action='ANULAR' AND entity_id=?").get(p.id).c, 1);
});

test('aislamiento entre negocios', () => {
  const a = ctxFor('f@x.co');
  const b = ctxFor('g@x.co');
  const p = purchases.create(a, { supplier: JUAN, precioCarga: 900000, weighings: [100] });
  assert.throws(() => purchases.get(b, p.id), { status: 404 });
  assert.equal(purchases.list(b).length, 0);
  assert.equal(suppliers.search(b, 'Juan').length, 0);
});
