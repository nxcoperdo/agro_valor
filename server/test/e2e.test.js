const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.SQLITE_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'agro-test-')), 'e2e.sqlite');
const bcrypt = require('bcryptjs');
const bootstrap = require('../db/bootstrap');
const db = require('../db/connection');
const createApp = require('../app');

let server;
let base;

test.before(async () => {
  bootstrap();
  const app = createApp();
  server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

async function login(username, password) {
  const res = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) });
  assert.equal(res.status, 200, `login ${username}`);
  return res.headers.get('set-cookie').split(';')[0];
}
const call = (cookie) => async (method, url, body) => {
  const res = await fetch(`${base}/api/coffee${url}`, { method, headers: { 'content-type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, body: ct.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
};

test('FLUJO COMPLETO por HTTP: compra → jornada → lote → procesamiento → inventario → venta → rentabilidad', async () => {
  const admin = call(await login('admin', 'changeme123'));

  // Cinco compras de cinco proveedores, cada una con su comprobante.
  const ids = [];
  for (let n = 1; n <= 5; n += 1) {
    const r = await admin('POST', '/purchases', { supplier: { idNumber: `1000${n}`, name: `Proveedor ${n}` }, coffeeType: 'cafe_verde', precioCarga: 900000, weighings: [{ pesoKg: 520 }, { pesoKg: 480 }] });
    assert.equal(r.status, 201);
    assert.equal(r.body.pesoPagable, 920);
    assert.equal(r.body.totalCompra, 6624000);
    ids.push(r.body.id);
    const pdf = await admin('GET', `/purchases/${r.body.id}/receipt.pdf`);
    assert.equal(pdf.body.subarray(0, 5).toString(), '%PDF-');
  }
  const day = (await admin('GET', '/day-summary')).body;
  assert.equal(day.compras, 5);
  assert.equal(day.proveedores, 5);
  assert.equal(day.kgPagables, 4600);
  assert.equal(day.totalPagado, 33120000);

  // Costos y proyección de la primera compra.
  assert.equal((await admin('POST', `/purchases/${ids[0]}/costs`, { concepto: 'Transporte', valor: 30000 })).status, 201);
  const proj = await admin('PUT', `/purchases/${ids[0]}/projection`, { rendimientoSecadoPct: 55, precioVentaCarga: 1000000, costos: [{ concepto: 'Secado', valor: 300, modo: 'por_kg' }] });
  assert.equal(proj.body.kilosSecosProyectados, 506);

  // Lote con las cinco compras.
  const lot = await admin('POST', '/lots', { purchaseIds: ids });
  assert.equal(lot.status, 201);
  assert.equal(lot.body.compras, 5);
  assert.equal(lot.body.proveedores, 5);
  const lotId = lot.body.id;
  assert.equal((await admin('POST', `/lots/${lotId}/status`, { status: 'EN_TRANSPORTE' })).status, 200);
  assert.equal((await admin('PUT', `/lots/${lotId}/processing`, { fechaEnvio: '2026-10-03', lugar: 'Trilladora' })).status, 200);
  assert.equal((await admin('POST', `/lots/${lotId}/processing/costs`, { concepto: 'Secado', valor: 690000 })).status, 201);
  assert.equal((await admin('POST', `/lots/${lotId}/status`, { status: 'EN_SECADO' })).status, 200);
  const fin = await admin('POST', `/lots/${lotId}/processing/finish`, { kilosSecosReales: 2590, destareRealKg: 0 });
  assert.equal(fin.status, 200);
  assert.equal(fin.body.resultadoReal.rendimientoReal, 56.3);
  assert.equal(fin.body.resultadoReal.costoRealTotal, 33120000 + 30000 + 690000);

  // Inventario y venta parcial.
  const inv = await admin('POST', `/lots/${lotId}/inventory`, { ubicacion: 'Bodega 1' });
  assert.equal(inv.status, 201);
  assert.equal(inv.body.kgDisponibles, 2590);
  const sale = await admin('POST', '/sales', { customer: { idNumber: '900', name: 'Exportadora' }, items: [{ inventoryLotId: inv.body.id, kg: 500, factor: 88, precioCarga: 1250000 }] });
  assert.equal(sale.status, 201);
  assert.equal(sale.body.total, 5000000);
  assert.equal((await admin('GET', '/inventory')).body.items[0].kgDisponibles, 2090);
  assert.equal((await admin('GET', `/sales/${sale.body.id}/receipt.pdf`)).body.subarray(0, 5).toString(), '%PDF-');

  // Rentabilidad y panel.
  const costoKg = Math.round((33120000 + 30000 + 690000) / 2590);
  const rent = (await admin('GET', '/profitability')).body.overall;
  assert.equal(rent.ingresoVenta, 5000000);
  assert.equal(rent.utilidadReal, 5000000 - 500 * costoKg);
  const dash = (await admin('GET', '/dashboard')).body;
  assert.equal(dash.kgInventario, 2090);
  assert.equal(dash.lotesActivos, 1);
  assert.equal((await admin('GET', '/reports/proveedor')).body.rows.length, 5);

  // Trazabilidad: ¿qué compras forman el lote? ¿qué proveedor originó el café?
  const trace = (await admin('GET', `/lots/${lotId}`)).body;
  assert.equal(trace.purchases.length, 5);
  assert.deepEqual(trace.purchases.map((p) => p.supplier.name).sort(), [1, 2, 3, 4, 5].map((n) => `Proveedor ${n}`));
  assert.equal((await admin('GET', '/sales')).body.sales[0].items[0].lotCode, trace.code);
});

test('operador: registra compras pero no ve costos, utilidad ni reportes de rentabilidad', async () => {
  const adminUser = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  const m = db.prepare('SELECT business_id FROM business_members WHERE user_id = ?').get(adminUser.id);
  const info = db.prepare("INSERT INTO users (username, password_hash, role, plan, plan_expires_at) VALUES ('op@x.co', ?, 'user', 'pro', '2999-01-01')").run(bcrypt.hashSync('operador123', 4));
  db.prepare("INSERT INTO business_members (business_id, user_id, role) VALUES (?, ?, 'operador')").run(m.business_id, info.lastInsertRowid);
  const op = call(await login('op@x.co', 'operador123'));

  const p = await op('POST', '/purchases', { supplier: { idNumber: '777', name: 'Nuevo' }, precioCarga: 900000, weighings: [100] });
  assert.equal(p.status, 201);
  assert.equal((await op('GET', `/purchases/${p.body.id}/costs`)).status, 403);
  assert.equal((await op('GET', `/purchases/${p.body.id}/projection`)).status, 403);
  assert.equal((await op('GET', '/profitability')).status, 403);
  assert.equal((await op('POST', `/purchases/${p.body.id}/void`, { reason: 'x' })).status, 403);
  assert.equal((await op('POST', '/lots', { purchaseIds: [p.body.id] })).status, 403);
  const dash = (await op('GET', '/dashboard')).body;
  assert.equal('utilidad' in dash, false);
  assert.equal('costoPromedioKg' in dash, false);
  assert.equal('costosInternos' in (await op('GET', '/day-summary')).body, false);
});

test('seguridad: sin sesión 401 y usuario gratis 402', async () => {
  assert.equal((await fetch(`${base}/api/coffee/purchases`)).status, 401);
  db.prepare("INSERT INTO users (username, password_hash, role) VALUES ('free@x.co', ?, 'user')").run(bcrypt.hashSync('gratis1234', 4));
  const free = call(await login('free@x.co', 'gratis1234'));
  assert.equal((await free('GET', '/purchases')).status, 402);
});
