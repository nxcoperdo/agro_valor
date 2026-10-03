const db = require('../db/connection');
const coffeeMath = require('../domain/coffeeMath');
const lotRepository = require('../repositories/lotRepository');
const processingService = require('./processingService');
const permissionService = require('./permissionService');

const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });

/** Líneas de venta ACTIVAS con su costo congelado al momento de entrar a inventario. */
function activeItems(businessId, { lotId, from, to } = {}) {
  const where = ["s.business_id = ?", "s.status = 'ACTIVA'"];
  const params = [businessId];
  if (lotId) { where.push('i.lot_id = ?'); params.push(lotId); }
  if (from) { where.push('s.sold_on >= ?'); params.push(from); }
  if (to) { where.push('s.sold_on <= ?'); params.push(to); }
  return db.prepare(
    `SELECT it.kg, it.subtotal, it.cost_kg_frozen, i.lot_id FROM trade_sale_items it
     JOIN trade_sales s ON s.id = it.sale_id JOIN inventory_lots i ON i.id = it.inventory_lot_id WHERE ${where.join(' AND ')}`
  ).all(...params);
}

function sumProfit(items) {
  const ingresoVenta = items.reduce((a, i) => a + i.subtotal, 0);
  const costoMercanciaVendida = items.reduce((a, i) => a + coffeeMath.roundCop(i.kg * i.cost_kg_frozen), 0);
  const kgVendidos = coffeeMath.roundKg(items.reduce((a, i) => a + i.kg, 0));
  const utilidadReal = ingresoVenta - costoMercanciaVendida;
  const margenReal = ingresoVenta > 0 ? Math.round((utilidadReal / ingresoVenta) * 10000) / 100 : null;
  return { ingresoVenta, costoMercanciaVendida, utilidadReal, margenReal, kgVendidos };
}

/** Rentabilidad global del negocio en un periodo. */
function overall(ctx, { from, to } = {}) {
  permissionService.assert(ctx.role, 'ver_rentabilidad');
  return { from: from || null, to: to || null, ...sumProfit(activeItems(ctx.businessId, { from, to })) };
}

/** Utilidad por lote: inversión, costos, ventas, inventario pendiente, utilidad realizada y pendiente, margen. */
function byLot(ctx, lotId) {
  permissionService.assert(ctx.role, 'ver_rentabilidad');
  const lot = lotRepository.findById(ctx.businessId, Number(lotId));
  if (!lot) throw fail('Lote no encontrado', 404);
  const base = processingService.purchaseBase(ctx, lot.id);
  const real = processingService.realResult(ctx, lot.id);
  const inv = db.prepare('SELECT * FROM inventory_lots WHERE lot_id = ?').get(lot.id);
  const sold = sumProfit(activeItems(ctx.businessId, { lotId: lot.id }));
  const costosProc = real ? real.costosProcesamientoReales : db.prepare('SELECT COALESCE(SUM(amount), 0) AS t FROM lot_processing_costs WHERE lot_id = ?').get(lot.id).t;
  const kgDisponibles = inv ? coffeeMath.roundKg(inv.kg_initial - inv.kg_sold) : 0;
  const precioPromedioVentaKg = sold.kgVendidos > 0 ? sold.ingresoVenta / sold.kgVendidos : null;
  const costoPendiente = inv ? coffeeMath.roundCop(kgDisponibles * inv.cost_kg) : 0;
  return {
    lot: { id: lot.id, code: lot.code, status: lot.status },
    inversion: base.totalCompra,
    costos: base.costosCompra + costosProc,
    costoRealTotal: real ? real.costoRealTotal : null,
    ventas: sold.ingresoVenta,
    kgVendidos: sold.kgVendidos,
    kgInventarioPendiente: kgDisponibles,
    inventarioPendienteACosto: costoPendiente,
    costoMercanciaVendida: sold.costoMercanciaVendida,
    utilidadRealizada: sold.utilidadReal,
    utilidadPendiente: precioPromedioVentaKg == null || !inv ? null : coffeeMath.roundCop(kgDisponibles * precioPromedioVentaKg) - costoPendiente,
    margen: sold.margenReal,
  };
}

function lots(ctx) {
  permissionService.assert(ctx.role, 'ver_rentabilidad');
  return lotRepository.list(ctx.businessId).map((l) => byLot(ctx, l.id));
}

module.exports = { overall, byLot, lots, sumProfit, activeItems };
