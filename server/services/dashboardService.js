const db = require('../db/connection');
const coffeeMath = require('../domain/coffeeMath');
const sequenceService = require('./sequenceService');
const permissionService = require('./permissionService');
const profitabilityService = require('./profitabilityService');
const workdayService = require('./workdayService');

/** Indicadores del negocio. Costos, utilidad y margen solo se incluyen si el rol puede verlos. */
function get(ctx) {
  const b = ctx.businessId;
  const today = workdayService.daySummary(ctx, sequenceService.today());
  const compras = db
    .prepare("SELECT COALESCE(SUM(total_compra), 0) AS invertido, COALESCE(SUM(peso_total_kg), 0) AS kg, COALESCE(SUM(peso_pagable_kg), 0) AS pagables FROM purchases WHERE business_id = ? AND status = 'ACTIVA'")
    .get(b);
  const lotesActivos = db.prepare("SELECT COUNT(*) AS c FROM lots WHERE business_id = ? AND status NOT IN ('VENDIDO', 'CERRADO')").get(b).c;
  const inv = db.prepare('SELECT COALESCE(SUM(kg_initial - kg_sold), 0) AS kg, COALESCE(SUM(kg_initial), 0) AS ini, COALESCE(SUM(kg_initial * cost_kg), 0) AS costo FROM inventory_lots WHERE business_id = ?').get(b);
  const ventas = db.prepare("SELECT COALESCE(SUM(total), 0) AS t, COUNT(*) AS n FROM trade_sales WHERE business_id = ? AND status = 'ACTIVA'").get(b);

  const out = {
    comprasHoy: today.compras,
    kgCompradosHoy: today.kgRecibidos,
    kgComprados: coffeeMath.roundKg(compras.kg),
    totalInvertido: compras.invertido,
    lotesActivos,
    kgInventario: coffeeMath.roundKg(inv.kg),
    ventas: ventas.t,
    cantidadVentas: ventas.n,
  };
  if (permissionService.can(ctx.role, 'ver_costos')) {
    const costoKg = inv.ini > 0 ? inv.costo / inv.ini : null;
    out.costoPromedioKg = costoKg == null ? null : coffeeMath.roundCop(costoKg);
    out.costoPromedioCarga = costoKg == null ? null : coffeeMath.roundCop(costoKg * coffeeMath.CARGA_KG);
  }
  if (permissionService.can(ctx.role, 'ver_rentabilidad')) {
    const p = profitabilityService.overall(ctx);
    out.utilidad = p.utilidadReal;
    out.margen = p.margenReal;
  }
  return out;
}

module.exports = { get };
