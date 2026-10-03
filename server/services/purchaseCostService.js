const db = require('../db/connection');
const coffeeMath = require('../domain/coffeeMath');
const purchaseService = require('./purchaseService');
const auditService = require('./auditService');
const permissionService = require('./permissionService');

const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });
const CONCEPTS = ['Transporte', 'Cargue', 'Descargue', 'Báscula', 'Combustible', 'Comisión', 'Otro'];

function costsOf(purchaseId) {
  return db.prepare('SELECT id, concept, amount, notes FROM purchase_costs WHERE purchase_id = ? ORDER BY id').all(purchaseId);
}

const serialize = (c) => ({ id: c.id, concepto: c.concept, valor: c.amount, observacion: c.notes });

/** Costos internos + costoAdquisicion = totalCompra + costos. Solo roles con ver_costos. */
function list(ctx, purchaseId) {
  permissionService.assert(ctx.role, 'ver_costos');
  const p = purchaseService.get(ctx, purchaseId);
  const costos = costsOf(p.id).map(serialize);
  return {
    costos,
    totalCostos: coffeeMath.sumarCostos(costos),
    costoAdquisicion: coffeeMath.calcularCostoAdquisicion(p.totalCompra, costos),
  };
}

function add(ctx, purchaseId, input) {
  permissionService.assert(ctx.role, 'gestionar_costos');
  const p = purchaseService.get(ctx, purchaseId);
  if (p.status === 'ANULADA') throw fail('No se pueden agregar costos a una compra anulada', 409);
  const concept = String(input.concepto || '').trim();
  const valor = Math.round(parseFloat(input.valor));
  if (!concept) throw fail('El concepto del costo es obligatorio');
  if (!Number.isFinite(valor) || valor <= 0) throw fail('El valor del costo debe ser mayor a cero');
  const info = db
    .prepare('INSERT INTO purchase_costs (purchase_id, concept, amount, notes) VALUES (?, ?, ?, ?)')
    .run(p.id, concept, valor, String(input.observacion || '').trim() || null);
  auditService.log({ businessId: ctx.businessId, userId: ctx.userId, action: 'AGREGAR_COSTO', entity: 'purchase', entityId: p.id, changes: { concept, valor } });
  return { id: Number(info.lastInsertRowid), ...list(ctx, p.id) };
}

function remove(ctx, purchaseId, costId) {
  permissionService.assert(ctx.role, 'gestionar_costos');
  const p = purchaseService.get(ctx, purchaseId);
  const cost = db.prepare('SELECT * FROM purchase_costs WHERE id = ? AND purchase_id = ?').get(Number(costId), p.id);
  if (!cost) throw fail('Costo no encontrado', 404);
  db.prepare('DELETE FROM purchase_costs WHERE id = ?').run(cost.id);
  auditService.log({ businessId: ctx.businessId, userId: ctx.userId, action: 'QUITAR_COSTO', entity: 'purchase', entityId: p.id, changes: { concept: cost.concept, valor: cost.amount } });
  return list(ctx, p.id);
}

module.exports = { list, add, remove, costsOf, CONCEPTS };
