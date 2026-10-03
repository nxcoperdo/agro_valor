const db = require('../db/connection');
const coffeeMath = require('../domain/coffeeMath');
const customerService = require('./customerService');
const inventoryService = require('./inventoryService');
const sequenceService = require('./sequenceService');
const auditService = require('./auditService');
const permissionService = require('./permissionService');
const receiptService = require('./receiptService');
const saleReceiptPdf = require('./pdf/saleReceiptPdf');
const { toIso } = require('../utils/datetime');

const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });
const PAYMENT_METHODS = ['efectivo', 'transferencia', 'credito', 'otro'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const clean = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim());

function itemsOf(saleId) {
  return db.prepare(
    `SELECT it.*, l.code AS lot_code, l.id AS lot_id FROM trade_sale_items it
     JOIN inventory_lots i ON i.id = it.inventory_lot_id JOIN lots l ON l.id = i.lot_id WHERE it.sale_id = ? ORDER BY it.id`
  ).all(saleId);
}

function serialize(row, role) {
  const canCost = permissionService.can(role, 'ver_costos');
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(row.customer_id);
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    soldOn: row.sold_on,
    createdAt: toIso(row.created_at),
    customer: customerService.serialize(customer),
    paymentMethod: row.payment_method,
    paymentReference: row.payment_reference,
    notes: row.notes,
    voidReason: row.void_reason,
    total: row.total,
    items: itemsOf(row.id).map((it) => ({
      id: it.id,
      inventoryLotId: it.inventory_lot_id,
      lotId: it.lot_id,
      lotCode: it.lot_code,
      kg: it.kg,
      factor: it.factor,
      precioKg: it.precio_kg,
      precioCarga: it.precio_carga,
      subtotal: it.subtotal,
      ...(canCost ? { costoKg: it.cost_kg_frozen } : {}),
    })),
  };
}

const findRow = (businessId, id) => db.prepare('SELECT * FROM trade_sales WHERE business_id = ? AND id = ?').get(businessId, Number(id));

function parseItems(input) {
  if (!Array.isArray(input) || !input.length) throw fail('Agrega al menos un lote a la venta');
  const seen = new Set();
  return input.map((it, i) => {
    const inventoryLotId = Number(it.inventoryLotId);
    if (!Number.isInteger(inventoryLotId) || inventoryLotId <= 0) throw fail(`Selecciona el lote de la línea ${i + 1}`);
    if (seen.has(inventoryLotId)) throw fail('Un lote no puede repetirse en la misma venta');
    seen.add(inventoryLotId);
    const kg = parseFloat(it.kg);
    if (!Number.isFinite(kg) || kg <= 0) throw fail(`Los kg de la línea ${i + 1} deben ser mayores a cero`);
    let precioKg = it.precioKg != null && it.precioKg !== '' ? parseFloat(it.precioKg) : NaN;
    if (!Number.isFinite(precioKg)) precioKg = parseFloat(it.precioCarga) / coffeeMath.CARGA_KG;
    if (!Number.isFinite(precioKg) || precioKg <= 0) throw fail(`El precio de la línea ${i + 1} debe ser mayor a cero`);
    const factor = it.factor == null || it.factor === '' ? null : parseFloat(it.factor);
    if (factor != null && !(factor > 0)) throw fail(`El factor de la línea ${i + 1} es inválido`);
    return { inventoryLotId, kg: coffeeMath.roundKg(kg), precioKg, factor };
  });
}

/** Vende uno o varios lotes (completos o en parte). Todo ocurre en una transacción: o se vende todo o nada. */
function create(ctx, input) {
  permissionService.assert(ctx.role, 'vender');
  const items = parseItems(input.items);
  const paymentMethod = input.paymentMethod || 'efectivo';
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw fail('Forma de pago inválida');
  const soldOn = input.soldOn || sequenceService.today();
  if (!DATE_RE.test(soldOn)) throw fail('Fecha inválida (AAAA-MM-DD)');

  const id = db.transaction(() => {
    const customer = customerService.resolveForSale(ctx, input);
    const code = sequenceService.nextYearlyCode(ctx.businessId, 'venta');
    const lines = items.map((it) => {
      const inv = inventoryService.findLotRow(ctx.businessId, it.inventoryLotId);
      if (!inv) throw fail('Inventario no encontrado', 404);
      return { ...it, costKg: inv.cost_kg, subtotal: coffeeMath.roundCop(it.kg * it.precioKg), precioCarga: coffeeMath.roundCop(it.precioKg * coffeeMath.CARGA_KG) };
    });
    const total = lines.reduce((a, l) => a + l.subtotal, 0);
    const info = db
      .prepare('INSERT INTO trade_sales (business_id, code, customer_id, sold_on, payment_method, payment_reference, notes, total, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(ctx.businessId, code, customer.id, soldOn, paymentMethod, clean(input.paymentReference), clean(input.notes), total, ctx.userId);
    const saleId = Number(info.lastInsertRowid);
    lines.forEach((l) => {
      inventoryService.removeStock(ctx, l.inventoryLotId, l.kg, { refType: 'sale', refId: saleId });
      db.prepare(
        'INSERT INTO trade_sale_items (sale_id, inventory_lot_id, kg, factor, precio_kg, precio_carga, subtotal, cost_kg_frozen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(saleId, l.inventoryLotId, l.kg, l.factor, coffeeMath.roundCop(l.precioKg * 100) / 100, l.precioCarga, l.subtotal, l.costKg);
    });
    auditService.log({ businessId: ctx.businessId, userId: ctx.userId, action: 'VENTA', entity: 'sale', entityId: saleId, changes: { code, total, items: lines.map((l) => ({ inv: l.inventoryLotId, kg: l.kg })) } });
    return saleId;
  })();
  return get(ctx, id);
}

function get(ctx, id) {
  const row = findRow(ctx.businessId, id);
  if (!row) throw fail('Venta no encontrada', 404);
  return serialize(row, ctx.role);
}

function list(ctx, { from, to } = {}) {
  const where = ['business_id = ?'];
  const params = [ctx.businessId];
  if (from) { where.push('sold_on >= ?'); params.push(from); }
  if (to) { where.push('sold_on <= ?'); params.push(to); }
  return db.prepare(`SELECT * FROM trade_sales WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT 200`).all(...params).map((r) => serialize(r, ctx.role));
}

/** Anula la venta y devuelve los kg al inventario. Nunca se borra. */
function voidSale(ctx, id, reason) {
  permissionService.assert(ctx.role, 'anular');
  const motivo = clean(reason);
  if (!motivo) throw fail('Indica el motivo de la anulación');
  const row = findRow(ctx.businessId, id);
  if (!row) throw fail('Venta no encontrada', 404);
  if (row.status === 'ANULADA') throw fail('La venta ya está anulada', 409);
  db.transaction(() => {
    db.prepare("UPDATE trade_sales SET status = 'ANULADA', void_reason = ? WHERE id = ?").run(motivo, row.id);
    itemsOf(row.id).forEach((it) => inventoryService.restoreStock(ctx, it.inventory_lot_id, it.kg, { refType: 'sale_void', refId: row.id }));
    auditService.log({ businessId: ctx.businessId, userId: ctx.userId, action: 'ANULAR', entity: 'sale', entityId: row.id, changes: { motivo, code: row.code } });
  })();
  return get(ctx, row.id);
}

/** Comprobante de venta: lista blanca, sin costos ni utilidad. */
function receipt(ctx, id) {
  const s = get(ctx, id);
  return {
    code: s.code, status: s.status, soldOn: s.soldOn,
    business: receiptService.businessInfo(ctx.businessId),
    customer: { name: s.customer.name, idType: s.customer.idType, idNumber: s.customer.idNumber },
    items: s.items.map((i) => ({ lotCode: i.lotCode, kg: i.kg, factor: i.factor, precioKg: i.precioKg, precioCarga: i.precioCarga, subtotal: i.subtotal })),
    total: s.total, paymentMethod: s.paymentMethod, paymentReference: s.paymentReference, notes: s.notes,
  };
}

const receiptPdf = (ctx, id) => saleReceiptPdf.render(receipt(ctx, id));

module.exports = { create, get, list, voidSale, receipt, receiptPdf };
