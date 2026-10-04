const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.SQLITE_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'agro-test-')), 'inv.sqlite');
const migrate = require('../db/migrate');
const db = require('../db/connection');
const business = require('../services/businessService');
const purchases = require('../services/purchaseService');
const invoices = require('../services/invoiceService');
const projection = require('../services/projectionService');
const lots = require('../services/lotService');
const workdays = require('../services/workdayService');
const receipts = require('../services/receiptService');
const reports = require('../services/reportService');
migrate();

function ctxFor(name) {
  const u = db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, 'x', 'user')").run(name);
  const b = business.ensureForUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.lastInsertRowid));
  return { businessId: b.businessId, userId: Number(u.lastInsertRowid), role: b.role };
}

const supplier = { idNumber: '900', name: 'Cliente Mixto', idType: 'CC', legalName: 'Finca Mixta SAS', phone: '3001234567', municipality: 'Pitalito', address: 'Vereda 1', notes: 'Paga de contado' };
// Café verde 1.000 kg a $7.200/kg (se seca) + cacao 500 kg a $15.000/kg (sin secado).
const twoItems = () => [
  { productType: 'cafe', porcentajeMermaInicial: 0, precioKg: 7200, weighings: [600, 400] },
  { productType: 'cacao', precioKg: 15000, weighings: [500] },
];

test('una factura con dos productos suma los totales y numera las líneas', () => {
  const ctx = ctxFor('a@x.co');
  const inv = invoices.create(ctx, { supplier, paymentMethod: 'transferencia', paymentReference: 'T-1', items: twoItems() });

  assert.match(inv.code, /^COMP-\d{4}-000001$/);
  assert.deepEqual(inv.lines.map((l) => l.code), [`${inv.code}-01`, `${inv.code}-02`]);
  assert.deepEqual(inv.lines.map((l) => l.productLabel), ['Café', 'Cacao']);
  assert.deepEqual(inv.lines.map((l) => l.totalCompra), [7200000, 7500000]);
  assert.equal(inv.totals.totalCompra, 14700000);
  assert.equal(inv.totals.pesoPagable, 1500);
  assert.equal(inv.totals.productos, 2);
  assert.equal(inv.paymentMethod, 'transferencia');
  // Proveedor y jornada únicos, y el proveedor llega completo.
  assert.equal(new Set(inv.lines.map((l) => l.supplier.id)).size, 1);
  assert.equal(new Set(inv.lines.map((l) => l.workdayId)).size, 1);
  assert.equal(inv.supplier.legalName, 'Finca Mixta SAS');
  assert.equal(inv.supplier.municipality, 'Pitalito');
  assert.equal(inv.lines[0].supplier.address, 'Vereda 1');
  assert.deepEqual(inv.lines.map((l) => l.requiresDrying), [true, false]);
  assert.ok(inv.lines.every((l) => l.invoiceId === inv.id));
});

test('creación atómica: un producto inválido no deja nada guardado', () => {
  const ctx = ctxFor('b@x.co');
  const bad = [...twoItems(), { productType: 'maiz', weighings: [100] }]; // sin precio
  assert.throws(() => invoices.create(ctx, { supplier, items: bad }), (e) => e.status === 400 && /Producto 3/.test(e.message));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM purchases WHERE business_id = ?').get(ctx.businessId).n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM purchase_invoices WHERE business_id = ?').get(ctx.businessId).n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM suppliers WHERE business_id = ?').get(ctx.businessId).n, 0);
  assert.throws(() => invoices.create(ctx, { supplier, items: [] }), { status: 400 });
});

test('purchases.create sigue funcionando: una factura de una línea con el mismo código', () => {
  const ctx = ctxFor('c@x.co');
  const p = purchases.create(ctx, { supplier, coffeeType: 'cafe_verde', precioCarga: 900000, weighings: [1000] });
  assert.ok(p.invoiceId);
  const inv = invoices.get(ctx, p.invoiceId);
  assert.equal(inv.code, p.code);
  assert.equal(inv.lines.length, 1);
  assert.equal(inv.totals.totalCompra, p.totalCompra);
});

test('anular la factura anula todos sus productos; una línea suelta de una factura múltiple no', () => {
  const ctx = ctxFor('d@x.co');
  const inv = invoices.create(ctx, { supplier, items: twoItems() });

  assert.throws(() => purchases.voidPurchase(ctx, inv.lines[0].id, 'x'), (e) => e.status === 409 && /factura completa/.test(e.message));
  assert.throws(() => invoices.voidInvoice(ctx, inv.id, ''), { status: 400 });
  assert.throws(() => invoices.voidInvoice({ ...ctx, role: 'operador' }, inv.id, 'motivo'), { status: 403 });

  const voided = invoices.voidInvoice(ctx, inv.id, 'Error de digitación');
  assert.equal(voided.status, 'ANULADA');
  assert.ok(voided.lines.every((l) => l.status === 'ANULADA'));
  assert.equal(voided.totals.totalCompra, 0); // las anuladas no suman
  assert.throws(() => invoices.voidInvoice(ctx, inv.id, 'otra vez'), { status: 409 });
});

test('no se anula una factura si un producto ya está en un lote (dice cuál)', () => {
  const ctx = ctxFor('e@x.co');
  const inv = invoices.create(ctx, { supplier, items: twoItems() });
  const lot = lots.create(ctx, { purchaseIds: [inv.lines[1].id] });
  assert.throws(() => invoices.voidInvoice(ctx, inv.id, 'x1'), (e) => e.status === 409 && e.message.includes(inv.lines[1].code) && e.message.includes(lot.code));
  // Nada quedó anulado a medias.
  assert.ok(invoices.get(ctx, inv.id).lines.every((l) => l.status === 'ACTIVA'));
});

test('anular una factura de una sola línea también marca el encabezado', () => {
  const ctx = ctxFor('f@x.co');
  const p = purchases.create(ctx, { supplier, productType: 'maiz', precioKg: 2000, weighings: [100] });
  purchases.voidPurchase(ctx, p.id, 'prueba');
  assert.equal(invoices.get(ctx, p.invoiceId).status, 'ANULADA');
});

test('jornada y reportes cuentan facturas, no productos', () => {
  const ctx = ctxFor('g@x.co');
  invoices.create(ctx, { supplier, items: twoItems() });
  invoices.create(ctx, { supplier, items: [{ productType: 'frijol', precioKg: 5000, weighings: [200] }] });

  const day = workdays.current(ctx).summary;
  assert.equal(day.compras, 2);
  assert.equal(day.productos, 3);
  assert.equal(day.proveedores, 1);
  assert.equal(day.totalPagado, 14700000 + 1000000);

  const today = new Date().toISOString().slice(0, 10);
  const rep = reports.build(ctx, 'proveedor', { from: today, to: today });
  assert.equal(rep.rows.reduce((a, r) => a + r.compras, 0), 2);
  const byType = reports.build(ctx, 'tipo-cafe', { from: today, to: today });
  assert.deepEqual(byType.rows.map((r) => r.label).sort(), ['Cacao', 'Café', 'Frijol']);
});

test('comprobante de la factura: lista blanca, un bloque por producto y PDF válido', async () => {
  const ctx = ctxFor('h@x.co');
  const inv = invoices.create(ctx, { supplier, notes: 'Entrega en bodega', items: twoItems() });
  const r = receipts.buildInvoice(ctx, inv.id);

  assert.equal(r.code, inv.code);
  assert.equal(r.lines.length, 2);
  assert.equal(r.totals.totalCompra, 14700000);
  assert.deepEqual(r.lines.map((l) => l.productLabel), ['Café', 'Cacao']);
  const keys = JSON.stringify([Object.keys(r), r.lines.flatMap((l) => Object.keys(l))]).toLowerCase();
  for (const forbidden of ['cost', 'costo', 'secado', 'drying', 'utilidad', 'margen', 'minimo', 'proyec', 'transporte']) {
    assert.ok(!keys.includes(forbidden), `el comprobante expone "${forbidden}"`);
  }
  const pdf = await receipts.invoicePdf(ctx, inv.id);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
});

test('cada producto de la misma factura tiene su proyección por separado', () => {
  const ctx = ctxFor('i@x.co');
  const inv = invoices.create(ctx, { supplier, items: twoItems() });
  const [cafe, cacao] = inv.lines;

  const pCafe = projection.get(ctx, cafe.id);
  const pCacao = projection.get(ctx, cacao.id);
  assert.equal(pCafe.kilosSecosProyectados, 550); // café: 55 %
  assert.equal(pCacao.kilosSecosProyectados, 500); // cacao: sin secado, 100 %

  projection.save(ctx, cafe.id, { rendimientoSecadoPct: 60, precioVentaCarga: 1500000 });
  assert.equal(projection.get(ctx, cafe.id).kilosSecosProyectados, 600);
  assert.equal(projection.get(ctx, cacao.id).kilosSecosProyectados, 500); // la otra no cambió
});

test('compras anteriores a las facturas se convierten en facturas de una línea al migrar', () => {
  const ctx = ctxFor('j@x.co');
  const p = purchases.create(ctx, { supplier, productType: 'maiz', precioKg: 2000, weighings: [100] });
  // Simula una compra de antes de que existieran las facturas.
  db.prepare('UPDATE purchases SET invoice_id = NULL WHERE id = ?').run(p.id);
  db.prepare('DELETE FROM purchase_invoices WHERE id = ?').run(p.invoiceId);

  migrate();
  migrate(); // idempotente

  const after = purchases.get(ctx, p.id);
  assert.ok(after.invoiceId);
  const inv = invoices.get(ctx, after.invoiceId);
  assert.equal(inv.code, p.code);
  assert.equal(inv.lines.length, 1);
  assert.equal(inv.totals.totalCompra, p.totalCompra);
});
