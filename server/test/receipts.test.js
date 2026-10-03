const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.SQLITE_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'agro-test-')), 'r.sqlite');
const migrate = require('../db/migrate');
const db = require('../db/connection');
const business = require('../services/businessService');
const purchases = require('../services/purchaseService');
const receipts = require('../services/receiptService');
migrate();

function ctxFor(name) {
  const u = db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, 'x', 'user')").run(name);
  const b = business.ensureForUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.lastInsertRowid));
  return { businessId: b.businessId, userId: Number(u.lastInsertRowid), role: b.role };
}

test('el comprobante trae solo datos del proveedor, nunca costos ni utilidad', () => {
  const ctx = ctxFor('a@x.co');
  receipts.updateBusiness(ctx, { name: 'Café del Huila', nit: '900.123.456-7', address: 'Cra 5 # 4-3', phone: '3001234567' });
  const p = purchases.create(ctx, { supplier: { idNumber: '1', name: 'Juan' }, precioCarga: 900000, weighings: [520, 480] });
  const r = receipts.build(ctx, p.id);
  assert.equal(r.code, p.receiptCode);
  assert.equal(r.business.nit, '900.123.456-7');
  assert.equal(r.totalCompra, 6624000);
  assert.equal(r.weighings.length, 2);
  const keys = JSON.stringify(Object.keys(r)).toLowerCase();
  for (const forbidden of ['costo', 'cost', 'secado', 'utilidad', 'margen', 'minimo', 'proyec', 'transporte']) {
    assert.ok(!keys.includes(forbidden), `no debe incluir ${forbidden}`);
  }
});

test('genera un PDF válido', async () => {
  const ctx = ctxFor('b@x.co');
  const p = purchases.create(ctx, { supplier: { idNumber: '2', name: 'María' }, precioCarga: 900000, weighings: [1000] });
  const buf = await receipts.pdf(ctx, p.id);
  assert.equal(buf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(buf.length > 1500);
});

test('otro negocio no puede ver el comprobante', () => {
  const a = ctxFor('c@x.co');
  const b = ctxFor('d@x.co');
  const p = purchases.create(a, { supplier: { idNumber: '3', name: 'Luis' }, precioCarga: 900000, weighings: [10] });
  assert.throws(() => receipts.build(b, p.id), { status: 404 });
});
