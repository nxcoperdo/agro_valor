const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agro-test-'));
process.env.SQLITE_DB_PATH = path.join(dir, 'test.sqlite');

const migrate = require('../db/migrate');
const db = require('../db/connection');
const seq = require('../services/sequenceService');
const audit = require('../services/auditService');
const perms = require('../services/permissionService');
const business = require('../services/businessService');

migrate();

function makeUser(name) {
  const info = db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, 'x', 'user')").run(name);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
}

test('la migración es idempotente y crea las tablas del módulo', () => {
  migrate();
  const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
  for (const t of ['businesses', 'purchases', 'purchase_weighings', 'lots', 'inventory_lots', 'trade_sales', 'trade_sale_items', 'audit_log', 'sequences', 'sales']) {
    assert.ok(names.includes(t), `falta ${t}`);
  }
});

test('ensureForUser crea el negocio una sola vez y deja al usuario como admin', () => {
  const u = makeUser('a@x.co');
  const b1 = business.ensureForUser(u);
  const b2 = business.ensureForUser(u);
  assert.equal(b1.businessId, b2.businessId);
  assert.equal(b1.role, 'admin');
});

test('consecutivos: formatos, reinicio por periodo y aislamiento por negocio', () => {
  const b1 = business.ensureForUser(makeUser('b@x.co')).businessId;
  const b2 = business.ensureForUser(makeUser('c@x.co')).businessId;
  const now = new Date('2026-10-02T15:00:00Z');
  assert.equal(seq.nextYearlyCode(b1, 'compra', now), 'COMP-2026-000001');
  assert.equal(seq.nextYearlyCode(b1, 'compra', now), 'COMP-2026-000002');
  assert.equal(seq.nextYearlyCode(b2, 'compra', now), 'COMP-2026-000001');
  assert.equal(seq.nextYearlyCode(b1, 'lote', now), 'AGV-2026-000001');
  assert.equal(seq.nextYearlyCode(b1, 'venta', now), 'VTA-2026-000001');
  assert.equal(seq.nextWorkdayCode(b1, now), 'JOR-2026-10-02-001');
  assert.equal(seq.nextWorkdayCode(b1, now), 'JOR-2026-10-02-002');
  assert.equal(seq.nextWorkdayCode(b1, new Date('2026-10-03T15:00:00Z')), 'JOR-2026-10-03-001');
  assert.equal(seq.nextYearlyCode(b1, 'compra', new Date('2027-01-05T15:00:00Z')), 'COMP-2027-000001');
});

test('consecutivos únicos en 500 llamadas seguidas', () => {
  const b = business.ensureForUser(makeUser('d@x.co')).businessId;
  const codes = new Set(Array.from({ length: 500 }, () => seq.nextYearlyCode(b, 'compra')));
  assert.equal(codes.size, 500);
});

test('auditoría guarda usuario, acción y cambios', () => {
  const u = makeUser('e@x.co');
  const b = business.ensureForUser(u).businessId;
  audit.log({ businessId: b, userId: u.id, action: 'ANULAR', entity: 'purchase', entityId: 7, changes: { motivo: 'error' } });
  const rows = audit.list(b, { entity: 'purchase', entityId: 7 });
  assert.equal(rows.length, 1);
  assert.equal(JSON.parse(rows[0].changes).motivo, 'error');
});

test('permisos: operador registra pero no ve costos ni utilidad', () => {
  assert.ok(perms.can('operador', 'registrar'));
  assert.ok(!perms.can('operador', 'ver_costos'));
  assert.ok(perms.can('admin', 'ver_rentabilidad'));
  assert.throws(() => perms.assert('operador', 'anular'), { status: 403 });
  assert.deepEqual(perms.stripFields('operador', 'ver_costos', { a: 1, costo: 5 }, ['costo']), { a: 1 });
});

test('unicidad de proveedor por identificación', () => {
  const b = business.ensureForUser(makeUser('f@x.co')).businessId;
  const ins = () => db.prepare("INSERT INTO suppliers (business_id, id_type, id_number, name) VALUES (?, 'CC', '123', 'Juan')").run(b);
  ins();
  assert.throws(ins);
});
