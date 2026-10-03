const db = require('../db/connection');
const coffeeMath = require('../domain/coffeeMath');
const lotRepository = require('../repositories/lotRepository');
const purchaseRepository = require('../repositories/purchaseRepository');
const purchaseService = require('./purchaseService');
const sequenceService = require('./sequenceService');
const auditService = require('./auditService');
const permissionService = require('./permissionService');
const { toIso } = require('../utils/datetime');

const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });

const STATUSES = ['CREADO', 'EN_TRANSPORTE', 'EN_SECADO', 'SECADO_FINALIZADO', 'DISPONIBLE_PARA_VENTA', 'PARCIALMENTE_VENDIDO', 'VENDIDO', 'CERRADO'];

/** Cambios que puede pedir un usuario. El resto los provocan procesamiento, inventario y ventas. */
const MANUAL_TRANSITIONS = {
  CREADO: ['EN_TRANSPORTE'],
  EN_TRANSPORTE: ['EN_SECADO'],
  VENDIDO: ['CERRADO'],
};

/** Totales de las compras ACTIVAS del lote (la trazabilidad completa está en detail). */
function totals(lotId, role) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS compras, COUNT(DISTINCT p.supplier_id) AS proveedores,
              COALESCE(SUM(p.peso_total_kg), 0) AS kg_recibidos, COALESCE(SUM(p.peso_pagable_kg), 0) AS kg_pagables,
              COALESCE(SUM(p.total_compra), 0) AS total_compra,
              COALESCE(SUM((SELECT COALESCE(SUM(c.amount), 0) FROM purchase_costs c WHERE c.purchase_id = p.id)), 0) AS costos_compra,
              COALESCE(SUM(COALESCE((SELECT pr.kilos_secos FROM purchase_projections pr WHERE pr.purchase_id = p.id), p.peso_pagable_kg * 0.55)), 0) AS kg_secos_proyectados,
              COALESCE(SUM((SELECT pr.kilos_netos FROM purchase_projections pr WHERE pr.purchase_id = p.id)), 0) AS kg_netos_guardados,
              COALESCE(SUM((SELECT pr.costos_procesamiento FROM purchase_projections pr WHERE pr.purchase_id = p.id)), 0) AS costos_proc_proyectados
       FROM purchases p WHERE p.lot_id = ? AND p.status = 'ACTIVA'`
    )
    .get(lotId);
  const out = {
    compras: row.compras,
    proveedores: row.proveedores,
    kgRecibidos: coffeeMath.roundKg(row.kg_recibidos),
    pesoPagable: coffeeMath.roundKg(row.kg_pagables),
    totalCompra: row.total_compra,
    pesoProyectado: coffeeMath.roundKg(row.kg_secos_proyectados),
  };
  if (permissionService.can(role, 'ver_costos')) out.costosCompra = row.costos_compra;
  return out;
}

function summarize(lot, role) {
  return { id: lot.id, code: lot.code, status: lot.status, notes: lot.notes, createdAt: toIso(lot.created_at), ...totals(lot.id, role) };
}

/** Lote con las compras (y sus proveedores y jornadas) que lo forman: Proveedor → Compra → Pesadas → Jornada → Lote. */
function detail(ctx, id) {
  const lot = lotRepository.findById(ctx.businessId, Number(id));
  if (!lot) throw fail('Lote no encontrado', 404);
  const compras = purchaseRepository.list(ctx.businessId, { lotId: lot.id }).map((r) => {
    const p = purchaseService.get(ctx, r.id);
    const wd = p.workdayId ? db.prepare('SELECT code FROM purchase_workdays WHERE id = ?').get(p.workdayId) : null;
    return { ...p, workdayCode: wd ? wd.code : null };
  });
  return { ...summarize(lot, ctx.role), purchases: compras };
}

function create(ctx, input) {
  permissionService.assert(ctx.role, 'gestionar_lotes');
  const ids = [...new Set((input.purchaseIds || []).map(Number))];
  if (!ids.length || ids.some((n) => !Number.isInteger(n) || n <= 0)) throw fail('Selecciona al menos una compra');
  const id = db.transaction(() => {
    for (const pid of ids) {
      const p = purchaseRepository.findById(ctx.businessId, pid);
      if (!p) throw fail(`Compra ${pid} no encontrada`, 404);
      if (p.status !== 'ACTIVA') throw fail(`La compra ${p.code} está anulada`, 409);
      if (p.lot_id) throw fail(`La compra ${p.code} ya pertenece al lote ${p.lot_code}`, 409);
    }
    const lot = lotRepository.insert(ctx.businessId, {
      code: sequenceService.nextYearlyCode(ctx.businessId, 'lote'),
      notes: input.notes ? String(input.notes).trim() || null : null,
      userId: ctx.userId,
    });
    ids.forEach((pid) => lotRepository.attachPurchase(lot.id, pid));
    auditService.log({ businessId: ctx.businessId, userId: ctx.userId, action: 'CREAR_LOTE', entity: 'lot', entityId: lot.id, changes: { code: lot.code, purchaseIds: ids } });
    return lot.id;
  })();
  return detail(ctx, id);
}

function list(ctx) {
  return lotRepository.list(ctx.businessId).map((l) => summarize(l, ctx.role));
}

/** Saca una compra del lote (solo mientras el lote está CREADO). Un lote vacío no se deja. */
function removePurchase(ctx, lotId, purchaseId) {
  permissionService.assert(ctx.role, 'gestionar_lotes');
  const lot = lotRepository.findById(ctx.businessId, Number(lotId));
  if (!lot) throw fail('Lote no encontrado', 404);
  if (lot.status !== 'CREADO') throw fail('Solo se pueden quitar compras de un lote en estado CREADO', 409);
  const p = purchaseRepository.findById(ctx.businessId, Number(purchaseId));
  if (!p || p.lot_id !== lot.id) throw fail('La compra no pertenece a este lote', 404);
  if (lotRepository.purchaseCount(lot.id) <= 1) throw fail('El lote debe conservar al menos una compra', 409);
  lotRepository.detachPurchase(lot.id, p.id);
  auditService.log({ businessId: ctx.businessId, userId: ctx.userId, action: 'QUITAR_COMPRA_LOTE', entity: 'lot', entityId: lot.id, changes: { purchase: p.code } });
  return detail(ctx, lot.id);
}

/** Cambio de estado interno (procesamiento, inventario y ventas lo usan) con auditoría. */
function transition(ctx, lotId, to, { reason } = {}) {
  const lot = lotRepository.findById(ctx.businessId, Number(lotId));
  if (!lot) throw fail('Lote no encontrado', 404);
  if (!STATUSES.includes(to)) throw fail('Estado inválido');
  if (lot.status === to) return lot;
  lotRepository.setStatus(ctx.businessId, lot.id, to);
  auditService.log({ businessId: ctx.businessId, userId: ctx.userId, action: 'CAMBIO_ESTADO_LOTE', entity: 'lot', entityId: lot.id, changes: { de: lot.status, a: to, reason } });
  return { ...lot, status: to };
}

/** Cambio manual de estado permitido por el flujo (CREADO → EN_TRANSPORTE → EN_SECADO, VENDIDO → CERRADO). */
function changeStatus(ctx, lotId, to) {
  permissionService.assert(ctx.role, 'gestionar_lotes');
  const lot = lotRepository.findById(ctx.businessId, Number(lotId));
  if (!lot) throw fail('Lote no encontrado', 404);
  if (!(MANUAL_TRANSITIONS[lot.status] || []).includes(to)) {
    throw fail(`No se puede pasar de ${lot.status} a ${to} manualmente`, 409);
  }
  transition(ctx, lot.id, to);
  return detail(ctx, lot.id);
}

module.exports = { STATUSES, create, list, detail, removePurchase, changeStatus, transition };
