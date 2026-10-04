const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.SQLITE_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'agro-test-')), 'mp.sqlite');
const migrate = require('../db/migrate');
const db = require('../db/connection');
const business = require('../services/businessService');
const purchases = require('../services/purchaseService');
const suppliers = require('../services/supplierService');
const projection = require('../services/projectionService');
const lots = require('../services/lotService');
const processing = require('../services/processingService');
const inventory = require('../services/inventoryService');
const reports = require('../services/reportService');
const productTypes = require('../domain/productTypes');
const coffeeMath = require('../domain/coffeeMath');
migrate();

function ctxFor(name) {
  const u = db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, 'x', 'user')").run(name);
  const b = business.ensureForUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.lastInsertRowid));
  return { businessId: b.businessId, userId: Number(u.lastInsertRowid), role: b.role };
}

const buy = (ctx, extra) =>
  purchases.create(ctx, { supplier: { idNumber: String(Math.random()).slice(2, 9), name: 'Cliente' }, weighings: [1000], ...extra });

test('tipos de producto: los nuevos arrancan en merma 0 y las claves viejas siguen válidas', () => {
  const ctx = ctxFor('t1@x.co');
  for (const key of ['cacao', 'pasilla_cafe', 'maiz', 'frijol']) {
    const p = buy(ctx, { productType: key, precioCarga: 900000 });
    assert.equal(p.porcentajeMermaInicial, 0, key);
    assert.equal(p.pesoPagable, 1000);
    assert.equal(p.requiresDrying, false, key);
    assert.equal(p.coffeeType, key);
  }
  assert.equal(buy(ctx, { productType: 'cafe', precioCarga: 900000 }).porcentajeMermaInicial, 8);
  assert.equal(buy(ctx, { productType: 'cafe', precioCarga: 900000 }).requiresDrying, true);
  // La app móvil instalada manda coffeeType y no conoce requiresDrying.
  const legacy = buy(ctx, { coffeeType: 'cafe_verde', precioCarga: 900000 });
  assert.equal(legacy.porcentajeMermaInicial, 8);
  assert.equal(legacy.requiresDrying, true);
  assert.throws(() => buy(ctx, { productType: 'oro', precioCarga: 900000 }), { status: 400 });
  assert.equal(productTypes.label('maiz'), 'Maíz');
  assert.deepEqual(productTypes.selectable().map((t) => t.key), ['cafe', 'cacao', 'pasilla_cafe', 'maiz', 'frijol']);
});

test('la merma de un producto nuevo se puede editar', () => {
  const ctx = ctxFor('t2@x.co');
  const p = buy(ctx, { productType: 'frijol', precioCarga: 900000, porcentajeMermaInicial: 3 });
  assert.equal(p.porcentajeMermaInicial, 3);
  assert.equal(p.pesoPagable, 970);
});

test('precio por kilo: total exacto, manda sobre la carga y sin precio sigue dando 400', () => {
  const ctx = ctxFor('t3@x.co');
  const byKg = buy(ctx, { productType: 'maiz', precioKg: 2500 });
  assert.equal(byKg.precioKg, 2500);
  assert.equal(byKg.precioCarga, 312500);
  assert.equal(byKg.totalCompra, 2500000);

  // 7,3 $/kg × 125 = 912,5 por carga: el total sale del precio por kilo, no de la carga redondeada.
  const odd = buy(ctx, { productType: 'maiz', precioKg: 7.3, weighings: [1000] });
  assert.equal(odd.totalCompra, 7300);

  const both = buy(ctx, { productType: 'maiz', precioKg: 2000, precioCarga: 900000 });
  assert.equal(both.totalCompra, 2000000);

  assert.throws(() => buy(ctx, { productType: 'maiz' }), { status: 400 });
  assert.throws(() => buy(ctx, { productType: 'maiz', precioKg: 0 }), { status: 400 });
  assert.equal(coffeeMath.calcularCompra({ pesadasKg: [100], porcentajeMermaInicial: 0, precioCarga: 125000 }).totalCompra, 100000);
});

test('proveedores: la lista completa sale en orden alfabético sin distinguir mayúsculas', () => {
  const ctx = ctxFor('t4@x.co');
  ['zapata', 'Ángel', 'bernal', 'Carlos', 'andrés'].forEach((n, i) =>
    suppliers.create(ctx, { idNumber: String(1000 + i), name: n })
  );
  // "Ángel" y "andrés" van primero (la Á cuenta como A), no al final.
  assert.deepEqual(suppliers.search(ctx, '').map((s) => s.name), ['andrés', 'Ángel', 'bernal', 'Carlos', 'zapata']);
  assert.equal(suppliers.search(ctx, 'carl').length, 1);
});

test('proyección: 100 % por defecto si no requiere secado, 55 % si requiere, y el interruptor se puede cambiar', () => {
  const ctx = ctxFor('t5@x.co');
  const maiz = buy(ctx, { productType: 'maiz', precioKg: 2000 });
  const g1 = projection.get(ctx, maiz.id);
  assert.equal(g1.entradas.rendimientoSecadoPct, 100);
  assert.equal(g1.kilosSecosProyectados, 1000);
  assert.equal(g1.requiresDrying, false);

  const cafe = buy(ctx, { productType: 'cafe', precioCarga: 900000, porcentajeMermaInicial: 0 });
  assert.equal(projection.get(ctx, cafe.id).kilosSecosProyectados, 550);

  // Guardar con requiereSecado=false fuerza 100 % aunque llegue otro rendimiento.
  const saved = projection.save(ctx, cafe.id, { requiereSecado: false, rendimientoSecadoPct: 55 });
  assert.equal(saved.kilosSecosProyectados, 1000);
  assert.equal(purchases.get(ctx, cafe.id).requiresDrying, false);

  // Y se puede volver a activar el secado con su rendimiento editable.
  const back = projection.save(ctx, cafe.id, { requiereSecado: true, rendimientoSecadoPct: 60 });
  assert.equal(back.kilosSecosProyectados, 600);
  assert.equal(purchases.get(ctx, cafe.id).requiresDrying, true);
});

test('lote sin secado: va directo a inventario sin pasar por EN_SECADO, al 100 %', () => {
  const ctx = ctxFor('t6@x.co');
  const p = buy(ctx, { productType: 'frijol', precioKg: 5000, weighings: [2000] }); // $10.000.000
  const lot = lots.create(ctx, { purchaseIds: [p.id] });
  assert.equal(lots.detail(ctx, lot.id).status, 'CREADO');

  const inv = inventory.enter(ctx, lot.id, { ubicacion: 'Bodega' });
  assert.equal(inv.kgIniciales, 2000);
  assert.equal(inv.costoKg, 5000);
  assert.equal(inv.status, 'DISPONIBLE_PARA_VENTA');
  const real = processing.get(ctx, lot.id).resultadoReal;
  assert.equal(real.rendimientoReal, 100);
});

test('lote con algo que requiere secado NO puede saltarse el secado', () => {
  const ctx = ctxFor('t7@x.co');
  const p = buy(ctx, { productType: 'cafe', precioCarga: 900000 });
  const lot = lots.create(ctx, { purchaseIds: [p.id] });
  assert.throws(() => inventory.enter(ctx, lot.id), { status: 409 });
  assert.throws(() => processing.finishWithoutDrying(ctx, lot.id), { status: 409 });
});

test('lote MIXTO: café verde se seca y café seco entra directo; todo termina junto en inventario', () => {
  const ctx = ctxFor('t8@x.co');
  const supplier = { idNumber: '555', name: 'Mismo cliente' };
  // Verde: 1.000 kg × $7.200/kg = $7.200.000 (se seca). Seco: 500 kg × $8.000/kg = $4.000.000 (directo).
  const verde = purchases.create(ctx, { supplier, productType: 'cafe', porcentajeMermaInicial: 0, precioKg: 7200, weighings: [1000] });
  const seco = purchases.create(ctx, { supplier, productType: 'cafe', requiresDrying: false, porcentajeMermaInicial: 0, precioKg: 8000, weighings: [500] });
  assert.equal(verde.requiresDrying, true);
  assert.equal(seco.requiresDrying, false);

  const lot = lots.create(ctx, { purchaseIds: [verde.id, seco.id] });
  const base = processing.purchaseBase(ctx, lot.id);
  assert.equal(base.pesoPagableSecar, 1000);
  assert.equal(base.pesoPagableDirecto, 500);

  // Hay secado pendiente: no hay atajo.
  assert.throws(() => inventory.enter(ctx, lot.id), { status: 409 });

  lots.changeStatus(ctx, lot.id, 'EN_TRANSPORTE');
  lots.changeStatus(ctx, lot.id, 'EN_SECADO');
  processing.finish(ctx, lot.id, { kilosSecosReales: 550 }); // del secado de los 1.000 kg verdes

  const real = processing.get(ctx, lot.id).resultadoReal;
  assert.equal(real.kilosSecosReales, 1050); // 550 secados + 500 que no se secan
  assert.equal(real.rendimientoReal, 70); // referencia sobre el peso total del lote
  const stored = db.prepare('SELECT rendimiento_real_pct FROM lot_processing WHERE lot_id = ?').get(lot.id);
  assert.equal(stored.rendimiento_real_pct, 55); // el rendimiento del secado es solo de lo que se secó

  const inv = inventory.enter(ctx, lot.id, {});
  assert.equal(inv.kgIniciales, 1050);
  assert.equal(inv.costoKg, Math.round(11200000 / 1050));
});

test('el reporte por tipo agrupa claves nuevas y viejas con su etiqueta', () => {
  const ctx = ctxFor('t9@x.co');
  buy(ctx, { productType: 'maiz', precioKg: 2000 });
  buy(ctx, { coffeeType: 'cafe_verde', precioCarga: 900000 });
  const rep = reports.build(ctx, 'tipo-cafe', {});
  assert.equal(rep.columns[0], 'Tipo de producto');
  const labels = rep.rows.map((r) => r.label);
  assert.ok(labels.includes('Maíz'));
  assert.ok(labels.includes('Café verde'));
});

test('una compra de un lote que ya terminó el secado no puede cambiar si requiere secado', () => {
  const ctx = ctxFor('t10@x.co');
  const p = buy(ctx, { productType: 'cafe', precioCarga: 900000 });
  const lot = lots.create(ctx, { purchaseIds: [p.id] });
  lots.changeStatus(ctx, lot.id, 'EN_TRANSPORTE');
  lots.changeStatus(ctx, lot.id, 'EN_SECADO');
  processing.finish(ctx, lot.id, { kilosSecosReales: 500 });
  assert.throws(() => projection.save(ctx, p.id, { requiereSecado: false }), { status: 409 });
});
