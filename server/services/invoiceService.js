const db = require('../db/connection');
const coffeeMath = require('../domain/coffeeMath');
const invoiceRepository = require('../repositories/invoiceRepository');
const purchaseRepository = require('../repositories/purchaseRepository');
const purchaseService = require('./purchaseService');
const supplierService = require('./supplierService');
const workdayService = require('./workdayService');
const sequenceService = require('./sequenceService');
const auditService = require('./auditService');
const permissionService = require('./permissionService');
const { toIso } = require('../utils/datetime');

const { PAYMENT_METHODS, clean, fail } = purchaseService;
const MAX_LINES = 20;

const pad2 = (n) => String(n).padStart(2, '0');

/** Totales de la factura: se calculan siempre sobre las líneas ACTIVAS (nunca se guardan). */
function totalsOf(lines) {
  const active = lines.filter((l) => l.status === 'ACTIVA');
  return {
    productos: active.length,
    pesoTotalCompra: coffeeMath.roundKg(active.reduce((a, l) => a + l.pesoTotalCompra, 0)),
    kgDescontados: coffeeMath.roundKg(active.reduce((a, l) => a + l.kgDescontados, 0)),
    pesoPagable: coffeeMath.roundKg(active.reduce((a, l) => a + l.pesoPagable, 0)),
    totalCompra: active.reduce((a, l) => a + l.totalCompra, 0),
  };
}

function serialize(row, ctx) {
  const lines = invoiceRepository.lineIds(row.id).map((id) => purchaseService.get(ctx, id));
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    purchasedAt: toIso(row.purchased_at),
    supplier: {
      id: row.supplier_id,
      name: row.supplier_name,
      idType: row.supplier_id_type,
      idNumber: row.supplier_id_number,
      phone: row.supplier_phone,
      legalName: row.supplier_legal_name,
      address: row.supplier_address,
      municipality: row.supplier_municipality,
      notes: row.supplier_notes,
    },
    workdayId: row.workday_id,
    workdayCode: row.workday_code,
    paymentMethod: row.payment_method,
    paymentReference: row.payment_reference,
    notes: row.notes,
    voidReason: row.void_reason,
    voidedAt: row.voided_at ? toIso(row.voided_at) : null,
    totals: totalsOf(lines),
    lines,
  };
}

/**
 * Crea la factura con todos sus productos en una sola transacción: proveedor y jornada se resuelven
 * una vez, y si cualquier producto es inválido no queda nada guardado.
 * body: { supplierId | supplier, workdayId?, paymentMethod, paymentReference, notes, items: [producto…] }
 */
function create(ctx, body) {
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) throw fail('Agrega al menos un producto a la factura');
  if (items.length > MAX_LINES) throw fail(`Una factura admite hasta ${MAX_LINES} productos`);
  const paymentMethod = body.paymentMethod || 'efectivo';
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw fail('Forma de pago inválida');

  // Se valida todo antes de escribir: un producto mal armado no deja una factura a medias.
  const lines = items.map((item, i) => {
    try {
      return purchaseService.buildLine(item);
    } catch (err) {
      err.message = items.length > 1 ? `Producto ${i + 1}: ${err.message}` : err.message;
      throw err;
    }
  });

  const id = db.transaction(() => {
    const supplier = supplierService.resolveForPurchase(ctx, body);
    const workdayId = workdayService.resolveForPurchase(ctx, body.workdayId);
    const code = sequenceService.nextYearlyCode(ctx.businessId, 'compra');
    const shared = {
      supplierId: supplier.id,
      workdayId,
      paymentMethod,
      paymentReference: clean(body.paymentReference),
      notes: clean(body.notes),
    };
    const invoiceId = invoiceRepository.insert({ businessId: ctx.businessId, code, ...shared, userId: ctx.userId });
    lines.forEach((line, i) => {
      // Una sola línea conserva el código de la factura (compatibilidad); con varias: FACTURA-01, -02…
      const lineCode = lines.length === 1 ? code : `${code}-${pad2(i + 1)}`;
      purchaseService.insertLine(ctx, { ...shared, invoiceId }, line, lineCode);
    });
    auditService.log({
      businessId: ctx.businessId, userId: ctx.userId, action: 'CREAR', entity: 'invoice', entityId: invoiceId,
      changes: { code, productos: lines.length, totalCompra: lines.reduce((a, l) => a + l.calc.totalCompra, 0) },
    });
    return invoiceId;
  })();
  return get(ctx, id);
}

function get(ctx, id) {
  const row = invoiceRepository.findById(ctx.businessId, Number(id));
  if (!row) throw fail('Factura no encontrada', 404);
  return serialize(row, ctx);
}

function list(ctx, filters = {}) {
  return invoiceRepository
    .list(ctx.businessId, {
      from: filters.from,
      to: filters.to,
      supplierId: filters.supplierId ? Number(filters.supplierId) : null,
      status: filters.status === 'ACTIVA' || filters.status === 'ANULADA' ? filters.status : null,
    })
    .map((r) => serialize(r, ctx));
}

/** Anula la factura COMPLETA con un solo motivo. Si algún producto ya está en un lote, no se puede. */
function voidInvoice(ctx, id, reason) {
  permissionService.assert(ctx.role, 'anular');
  const motivo = clean(reason);
  if (!motivo) throw fail('Indica el motivo de la anulación');
  const row = invoiceRepository.findById(ctx.businessId, Number(id));
  if (!row) throw fail('Factura no encontrada', 404);
  if (row.status === 'ANULADA') throw fail('La factura ya está anulada', 409);

  const inLot = invoiceRepository.linesInLot(row.id);
  if (inLot.length > 0) {
    const detail = inLot.map((l) => `${l.code} (lote ${l.lot_code})`).join(', ');
    throw fail(`No se puede anular: ya hay productos en lotes: ${detail}. Sácalos del lote primero`, 409);
  }

  db.transaction(() => {
    invoiceRepository.lineIds(row.id).forEach((lineId) => {
      purchaseRepository.markVoid(ctx.businessId, lineId, { reason: motivo, userId: ctx.userId });
    });
    invoiceRepository.markVoid(ctx.businessId, row.id, { reason: motivo, userId: ctx.userId });
    auditService.log({
      businessId: ctx.businessId, userId: ctx.userId, action: 'ANULAR', entity: 'invoice', entityId: row.id,
      changes: { motivo, code: row.code },
    });
  })();
  return get(ctx, row.id);
}

module.exports = { create, get, list, voidInvoice };
