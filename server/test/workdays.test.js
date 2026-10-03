const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.SQLITE_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'agro-test-')), 'w.sqlite');
const migrate = require('../db/migrate');
const db = require('../db/connection');
const business = require('../services/businessService');
const purchases = require('../services/purchaseService');
const workdays = require('../services/workdayService');
migrate();

function ctxFor(name) {
  const u = db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, 'x', 'user')").run(name);
  const b = business.ensureForUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.lastInsertRowid));
  return { businessId: b.businessId, userId: Number(u.lastInsertRowid), role: b.role };
}
const buy = (ctx, id, kg, extra = {}) =>
  purchases.create(ctx, { supplier: { idNumber: String(id), name: `P${id}` }, precioCarga: 900000, weighings: [kg], ...extra });

test('la primera compra abre la jornada del día y las siguientes la reutilizan', () => {
  const ctx = ctxFor('a@x.co');
  const a = buy(ctx, 1, 520);
  const b = buy(ctx, 2, 480);
  assert.equal(a.workdayId, b.workdayId);
  const w = workdays.current(ctx);
  assert.match(w.code, /^JOR-\d{4}-\d{2}-\d{2}-001$/);
  assert.equal(w.status, 'ABIERTA');
  assert.equal(w.summary.compras, 2);
  assert.equal(w.summary.proveedores, 2);
  assert.equal(w.summary.kgRecibidos, 1000);
  assert.equal(w.summary.kgPagables, 920);
  assert.equal(w.summary.kgDescontados, 80);
  assert.equal(w.summary.totalPagado, 6624000);
  assert.equal(w.summary.kgSecosProyectados, 506);
  assert.equal(w.summary.precioCargaPromedio, 900000);
  assert.equal(w.summary.mermaPromedio, 8);
  assert.equal(w.summary.costosInternos, 0);
});

test('cerrar la jornada: exige permiso, bloquea compras en ella y abre la siguiente', () => {
  const ctx = ctxFor('b@x.co');
  const p = buy(ctx, 1, 100);
  assert.throws(() => workdays.closeWorkday({ ...ctx, role: 'operador' }, p.workdayId), { status: 403 });
  const closed = workdays.closeWorkday(ctx, p.workdayId);
  assert.equal(closed.status, 'CERRADA');
  assert.throws(() => workdays.closeWorkday(ctx, p.workdayId), { status: 409 });
  assert.throws(() => buy(ctx, 2, 100, { workdayId: p.workdayId }), { status: 409 });
  const next = buy(ctx, 3, 100);
  assert.notEqual(next.workdayId, p.workdayId);
  assert.match(workdays.get(ctx, next.workdayId).code, /-002$/);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM audit_log WHERE action='CERRAR_JORNADA'").get().c >= 1, true);
});

test('las compras anuladas salen del consolidado y el operador no ve costos internos', () => {
  const ctx = ctxFor('c@x.co');
  const a = buy(ctx, 1, 1000);
  buy(ctx, 2, 500);
  purchases.voidPurchase(ctx, a.id, 'error');
  const s = workdays.daySummary(ctx);
  assert.equal(s.compras, 1);
  assert.equal(s.kgRecibidos, 500);
  assert.equal('costosInternos' in workdays.daySummary({ ...ctx, role: 'operador' }), false);
});

test('aislamiento entre negocios y fecha inválida', () => {
  const a = ctxFor('d@x.co');
  const b = ctxFor('e@x.co');
  const p = buy(a, 1, 100);
  assert.throws(() => workdays.get(b, p.workdayId), { status: 404 });
  assert.throws(() => workdays.daySummary(a, 'ayer'), { status: 400 });
  assert.equal(workdays.daySummary(b).compras, 0);
});
