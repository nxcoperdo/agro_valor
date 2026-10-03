const db = require('../db/connection');
const coffeeMath = require('../domain/coffeeMath');
const purchaseRepository = require('../repositories/purchaseRepository');
const supplierService = require('./supplierService');
const sequenceService = require('./sequenceService');
const auditService = require('./auditService');
const permissionService = require('./permissionService');
const { toIso } = require('../utils/datetime');

const COFFEE_TYPES = ['cafe_verde', 'cafe_merma_5', 'cafe_sin_merma', 'otro'];
const PAYMENT_METHODS = ['efectivo', 'transferencia', 'credito', 'otro'];
const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });
const clean = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim());

function serialize(row, weighings) {
  return {
    id: row.id,
    code: row.code,
    receiptCode: row.receipt_code,
    status: row.status,
    purchasedAt: toIso(row.purchased_at),
    supplier: {
      id: row.supplier_id,
      name: row.supplier_name,
      idType: row.supplier_id_type,
      idNumber: row.supplier_id_number,
      phone: row.supplier_phone,
    },
    workdayId: row.workday_id,
    lot: row.lot_id ? { id: row.lot_id, code: row.lot_code } : null,
    coffeeType: row.coffee_type,
    porcentajeMermaInicial: row.merma_inicial_pct,
    pesoTotalCompra: row.peso_total_kg,
    kgDescontados: row.kg_descontados,
    pesoPagable: row.peso_pagable_kg,
    precioCarga: row.precio_carga,
    precioKg: row.precio_kg,
    totalCompra: row.total_compra,
    paymentMethod: row.payment_method,
    paymentReference: row.payment_reference,
    notes: row.notes,
    weighingsCount: row.weighings_count,
    voidReason: row.void_reason,
    voidedAt: row.voided_at ? toIso(row.voided_at) : null,
    ...(weighings && {
      weighings: weighings.map((w) => ({ id: w.id, pesoKg: w.weight_kg, at: toIso(w.weighed_at), notes: w.notes })),
    }),
  };
}

function parseWeighings(input) {
  if (!Array.isArray(input) || input.length === 0) throw fail('Agrega al menos una pesada');
  return input.map((w, i) => {
    const pesoKg = parseFloat(typeof w === 'object' ? w.pesoKg : w);
    if (!Number.isFinite(pesoKg) || pesoKg <= 0) throw fail(`La pesada ${i + 1} debe ser mayor a cero`);
    return { pesoKg, notes: typeof w === 'object' ? clean(w.notes) : null };
  });
}

function create(ctx, body) {
  const coffeeType = body.coffeeType || 'cafe_verde';
  if (!COFFEE_TYPES.includes(coffeeType)) throw fail('Tipo de café inválido');
  const paymentMethod = body.paymentMethod || 'efectivo';
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw fail('Forma de pago inválida');

  const pesadas = parseWeighings(body.weighings);
  const mermaPct =
    body.porcentajeMermaInicial != null && body.porcentajeMermaInicial !== ''
      ? parseFloat(body.porcentajeMermaInicial)
      : coffeeMath.mermaPorDefecto(coffeeType);
  const precioCarga = parseFloat(body.precioCarga);
  if (!Number.isFinite(precioCarga) || precioCarga <= 0) throw fail('El precio por carga debe ser mayor a cero');

  const calc = coffeeMath.calcularCompra({
    pesadasKg: pesadas.map((p) => p.pesoKg),
    porcentajeMermaInicial: mermaPct,
    precioCarga,
  });

  const id = db.transaction(() => {
    const supplier = supplierService.resolveForPurchase(ctx, body);
    const code = sequenceService.nextYearlyCode(ctx.businessId, 'compra');
    const purchaseId = purchaseRepository.insert({
      businessId: ctx.businessId,
      code,
      supplierId: supplier.id,
      workdayId: body.workdayId || null,
      coffeeType,
      mermaPct,
      pesoTotal: calc.pesoTotalCompra,
      kgDescontados: calc.kgDescontados,
      pesoPagable: calc.pesoPagable,
      precioCarga: coffeeMath.roundCop(precioCarga),
      precioKg: calc.precioKg,
      totalCompra: calc.totalCompra,
      paymentMethod,
      paymentReference: clean(body.paymentReference),
      notes: clean(body.notes),
      userId: ctx.userId,
    });
    pesadas.forEach((p) => purchaseRepository.insertWeighing(purchaseId, { ...p, userId: ctx.userId }));
    auditService.log({
      businessId: ctx.businessId, userId: ctx.userId, action: 'CREAR', entity: 'purchase', entityId: purchaseId,
      changes: { code, totalCompra: calc.totalCompra, pesoPagable: calc.pesoPagable },
    });
    return purchaseId;
  })();
  return get(ctx, id);
}

function get(ctx, id) {
  const row = purchaseRepository.findById(ctx.businessId, Number(id));
  if (!row) throw fail('Compra no encontrada', 404);
  return serialize(row, purchaseRepository.weighings(row.id));
}

function list(ctx, filters = {}) {
  return purchaseRepository
    .list(ctx.businessId, {
      from: filters.from,
      to: filters.to,
      supplierId: filters.supplierId ? Number(filters.supplierId) : null,
      status: filters.status === 'ACTIVA' || filters.status === 'ANULADA' ? filters.status : null,
    })
    .map((r) => serialize(r));
}

/** Nunca se borra: se marca ANULADA con motivo, usuario y fecha. */
function voidPurchase(ctx, id, reason) {
  permissionService.assert(ctx.role, 'anular');
  const motivo = clean(reason);
  if (!motivo) throw fail('Indica el motivo de la anulación');
  const row = purchaseRepository.findById(ctx.businessId, Number(id));
  if (!row) throw fail('Compra no encontrada', 404);
  if (row.status === 'ANULADA') throw fail('La compra ya está anulada', 409);
  if (row.lot_id) throw fail(`La compra pertenece al lote ${row.lot_code}; sácala del lote antes de anularla`, 409);
  purchaseRepository.markVoid(ctx.businessId, row.id, { reason: motivo, userId: ctx.userId });
  auditService.log({
    businessId: ctx.businessId, userId: ctx.userId, action: 'ANULAR', entity: 'purchase', entityId: row.id,
    changes: { motivo, code: row.code },
  });
  return get(ctx, row.id);
}

module.exports = { create, get, list, voidPurchase, COFFEE_TYPES, PAYMENT_METHODS };
