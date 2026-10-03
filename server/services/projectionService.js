const db = require('../db/connection');
const coffeeMath = require('../domain/coffeeMath');
const purchaseService = require('./purchaseService');
const purchaseCostService = require('./purchaseCostService');
const auditService = require('./auditService');
const permissionService = require('./permissionService');

const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });
const MODES = ['total', 'por_kg'];

function parseCostos(input) {
  return (input || []).map((c) => {
    const concepto = String(c.concepto || '').trim();
    const valor = parseFloat(c.valor);
    const modo = c.modo || 'total';
    if (!concepto) throw fail('Cada costo proyectado necesita concepto');
    if (!Number.isFinite(valor) || valor < 0) throw fail(`Valor inválido en "${concepto}"`);
    if (!MODES.includes(modo)) throw fail(`Modo inválido en "${concepto}" (total o por_kg)`);
    return { concepto, valor, modo };
  });
}

/** Calcula con los insumos guardados y los costos reales de adquisición de hoy. */
function compute(purchase, saved) {
  const costosAsociados = purchaseCostService.costsOf(purchase.id).map((c) => ({ valor: c.amount }));
  const calc = coffeeMath.calcularProyeccion({
    pesoPagable: purchase.pesoPagable,
    totalCompra: purchase.totalCompra,
    costosAsociados,
    costosProyectados: saved.costos.map((c) => ({ valor: c.valor, modo: c.modo })),
    porcentajeRendimientoSecado: saved.rendimientoSecadoPct,
    destareProyectadoKg: saved.destareKg,
    precioVentaCarga: saved.precioVentaCarga,
  });
  return {
    entradas: saved,
    ...calc,
    costoAdquisicion: coffeeMath.calcularCostoAdquisicion(purchase.totalCompra, costosAsociados),
  };
}

function stripMargins(role, result) {
  if (permissionService.can(role, 'ver_margenes')) return result;
  const { ingresoProyectado, utilidadProyectada, margen, precioVentaKg, ...rest } = result;
  rest.entradas = { ...rest.entradas, precioVentaCarga: undefined };
  return rest;
}

function load(purchaseId) {
  const row = db.prepare('SELECT * FROM purchase_projections WHERE purchase_id = ?').get(purchaseId);
  if (!row) return null;
  return {
    rendimientoSecadoPct: row.rendimiento_secado_pct,
    destareKg: row.destare_kg,
    costos: JSON.parse(row.costos_json || '[]'),
    precioVentaCarga: row.precio_venta_carga,
  };
}

function get(ctx, purchaseId) {
  permissionService.assert(ctx.role, 'ver_costos');
  const p = purchaseService.get(ctx, purchaseId);
  const saved =
    load(p.id) || { rendimientoSecadoPct: coffeeMath.RENDIMIENTO_SECADO_DEFECTO, destareKg: 0, costos: [], precioVentaCarga: null };
  return { guardada: Boolean(load(p.id)), ...stripMargins(ctx.role, compute(p, saved)) };
}

function save(ctx, purchaseId, input) {
  permissionService.assert(ctx.role, 'gestionar_costos');
  const p = purchaseService.get(ctx, purchaseId);
  const rendimiento = input.rendimientoSecadoPct == null || input.rendimientoSecadoPct === '' ? coffeeMath.RENDIMIENTO_SECADO_DEFECTO : parseFloat(input.rendimientoSecadoPct);
  const destare = input.destareKg == null || input.destareKg === '' ? 0 : parseFloat(input.destareKg);
  const precioVentaCarga = input.precioVentaCarga == null || input.precioVentaCarga === '' ? null : parseFloat(input.precioVentaCarga);
  if (!Number.isFinite(rendimiento) || rendimiento <= 0 || rendimiento > 100) throw fail('El rendimiento de secado debe estar entre 0 y 100');
  if (!Number.isFinite(destare) || destare < 0) throw fail('El destare no puede ser negativo');
  if (precioVentaCarga != null && !(precioVentaCarga > 0)) throw fail('El precio de venta debe ser mayor a cero');
  const saved = { rendimientoSecadoPct: rendimiento, destareKg: destare, costos: parseCostos(input.costos), precioVentaCarga };
  const r = compute(p, saved);
  db.prepare(
    `INSERT INTO purchase_projections (purchase_id, rendimiento_secado_pct, kilos_secos, destare_kg, kilos_netos, costos_procesamiento,
       costos_json, costo_total, costo_minimo_kg, costo_minimo_carga, precio_venta_carga, ingreso, utilidad, margen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(purchase_id) DO UPDATE SET rendimiento_secado_pct = excluded.rendimiento_secado_pct, kilos_secos = excluded.kilos_secos,
       destare_kg = excluded.destare_kg, kilos_netos = excluded.kilos_netos, costos_procesamiento = excluded.costos_procesamiento,
       costos_json = excluded.costos_json, costo_total = excluded.costo_total, costo_minimo_kg = excluded.costo_minimo_kg,
       costo_minimo_carga = excluded.costo_minimo_carga, precio_venta_carga = excluded.precio_venta_carga,
       ingreso = excluded.ingreso, utilidad = excluded.utilidad, margen = excluded.margen`
  ).run(p.id, rendimiento, r.kilosSecosProyectados, destare, r.kilosNetosProyectados, r.costosProcesamientoProyectados,
    JSON.stringify(saved.costos), r.costoTotalProyectado, r.costoMinimoKg, r.costoMinimoCarga, precioVentaCarga,
    r.ingresoProyectado, r.utilidadProyectada, r.margen);
  auditService.log({ businessId: ctx.businessId, userId: ctx.userId, action: 'PROYECTAR', entity: 'purchase', entityId: p.id, changes: saved });
  return get(ctx, p.id);
}

module.exports = { get, save, compute, load };
