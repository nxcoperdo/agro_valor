const db = require('../db/connection');
const coffeeMath = require('../domain/coffeeMath');
const lotRepository = require('../repositories/lotRepository');
const purchaseRepository = require('../repositories/purchaseRepository');
const purchaseService = require('./purchaseService');
const projectionService = require('./projectionService');
const purchaseCostService = require('./purchaseCostService');
const lotService = require('./lotService');
const auditService = require('./auditService');
const permissionService = require('./permissionService');

const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });
const PRE_FINISH = ['CREADO', 'EN_TRANSPORTE', 'EN_SECADO'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function getLot(ctx, lotId) {
  const lot = lotRepository.findById(ctx.businessId, Number(lotId));
  if (!lot) throw fail('Lote no encontrado', 404);
  return lot;
}

const procRow = (lotId) => db.prepare('SELECT * FROM lot_processing WHERE lot_id = ?').get(lotId);
const costsOf = (lotId) => db.prepare('SELECT id, concept, amount, notes FROM lot_processing_costs WHERE lot_id = ? ORDER BY id').all(lotId);

function lotPurchases(ctx, lotId) {
  return purchaseRepository.list(ctx.businessId, { lotId, status: 'ACTIVA' }).map((r) => purchaseService.get(ctx, r.id));
}

/** Compra + costos de compra de las compras ACTIVAS del lote. */
function purchaseBase(ctx, lotId) {
  const ps = lotPurchases(ctx, lotId);
  let totalCompra = 0;
  let costosCompra = 0;
  let pesoPagable = 0;
  let pesoPagableSecar = 0;
  ps.forEach((p) => {
    totalCompra += p.totalCompra;
    pesoPagable += p.pesoPagable;
    if (p.requiresDrying) pesoPagableSecar += p.pesoPagable;
    costosCompra += purchaseCostService.costsOf(p.id).reduce((a, c) => a + c.amount, 0);
  });
  const total = coffeeMath.roundKg(pesoPagable);
  const secar = coffeeMath.roundKg(pesoPagableSecar);
  // pesoPagableSecar: lo que entra al secado. pesoPagableDirecto: lo que no se seca y entra a inventario tal cual.
  return { ps, totalCompra, costosCompra, pesoPagable: total, pesoPagableSecar: secar, pesoPagableDirecto: coffeeMath.roundKg(total - secar) };
}

/** Resultado real del lote a partir de lo registrado en procesamiento. */
function realResult(ctx, lotId) {
  const proc = procRow(lotId);
  if (!proc || proc.kilos_secos_reales == null) return null;
  const base = purchaseBase(ctx, lotId);
  const r = coffeeMath.calcularResultadoReal({
    pesoPagable: base.pesoPagable,
    totalCompra: base.totalCompra,
    costosCompra: [{ valor: base.costosCompra }],
    costosProcesamientoReales: costsOf(lotId).map((c) => ({ valor: c.amount })),
    kilosSecosReales: proc.kilos_secos_reales,
    destareRealKg: proc.destare_real_kg,
  });
  return { ...r, costosProcesamientoReales: coffeeMath.sumarCostos(costsOf(lotId).map((c) => ({ valor: c.amount }))), costosCompra: base.costosCompra, totalCompra: base.totalCompra };
}

/**
 * Proyectado vs real. Lo proyectado sale de la proyección de cada compra (o la de por defecto, 55%).
 * "Utilidad futura": con el precio de referencia que el usuario dejó en las proyecciones (ingreso ÷ kg netos
 * proyectados, ponderado); el real aplica ese mismo precio por kg a los kg netos reales.
 */
function compareProjectedVsReal(ctx, lotId) {
  const base = purchaseBase(ctx, lotId);
  const real = realResult(ctx, lotId);
  let secos = 0, netos = 0, destare = 0, costoTotal = 0, costosProc = 0, ingreso = 0, withPrice = 0;
  base.ps.forEach((p) => {
    const saved = projectionService.load(p.id) || { rendimientoSecadoPct: coffeeMath.rendimientoPorDefecto(p.requiresDrying), destareKg: 0, costos: [], precioVentaCarga: null };
    const c = projectionService.compute(p, saved);
    secos += c.kilosSecosProyectados;
    netos += c.kilosNetosProyectados;
    destare += saved.destareKg;
    costoTotal += c.costoTotalProyectado;
    costosProc += c.costosProcesamientoProyectados;
    if (c.ingresoProyectado != null) { ingreso += c.ingresoProyectado; withPrice += 1; }
  });
  const proj = {
    kilosSecos: coffeeMath.roundKg(secos),
    rendimiento: base.pesoPagable > 0 ? coffeeMath.roundKg((secos / base.pesoPagable) * 100) : null,
    destare: coffeeMath.roundKg(destare),
    kilosNetos: coffeeMath.roundKg(netos),
    costosProcesamiento: Math.round(costosProc),
    costoTotal: Math.round(costoTotal),
    costoKg: netos > 0 ? Math.round(costoTotal / netos) : null,
    costoCarga: netos > 0 ? Math.round((costoTotal / netos) * coffeeMath.CARGA_KG) : null,
    utilidadFutura: withPrice === base.ps.length && base.ps.length > 0 ? Math.round(ingreso - costoTotal) : null,
  };
  const precioKgRef = withPrice === base.ps.length && netos > 0 ? ingreso / netos : null;
  const rl = real && {
    kilosSecos: real.kilosSecosReales,
    rendimiento: real.rendimientoReal,
    destare: db.prepare('SELECT destare_real_kg FROM lot_processing WHERE lot_id = ?').get(lotId).destare_real_kg,
    kilosNetos: real.kilosNetosReales,
    costosProcesamiento: real.costosProcesamientoReales,
    costoTotal: real.costoRealTotal,
    costoKg: real.costoRealKg,
    costoCarga: real.costoRealCarga,
    utilidadFutura: precioKgRef == null ? null : Math.round(real.kilosNetosReales * precioKgRef - real.costoRealTotal),
  };
  const rows = [
    ['kilosSecos', 'Kg secos'], ['rendimiento', 'Rendimiento (%)'], ['destare', 'Destare (kg)'], ['kilosNetos', 'Kg netos'],
    ['costosProcesamiento', 'Costos de procesamiento'], ['costoTotal', 'Costo total'], ['costoKg', 'Costo por kg'],
    ['costoCarga', 'Costo por carga'], ['utilidadFutura', 'Utilidad futura'],
  ].map(([key, label]) => {
    const p = proj[key];
    const r = rl ? rl[key] : null;
    return { key, concepto: label, proyectado: p, real: r, diferencia: p != null && r != null ? Math.round((r - p) * 100) / 100 : null };
  });
  return { tieneReal: Boolean(rl), filas: rows };
}

function get(ctx, lotId) {
  permissionService.assert(ctx.role, 'ver_costos');
  const lot = getLot(ctx, lotId);
  const proc = procRow(lot.id);
  const base = purchaseBase(ctx, lot.id);
  return {
    lotId: lot.id,
    status: lot.status,
    // Qué parte del lote se seca y cuál va directo a inventario (lotes mixtos).
    secado: { kgSecar: base.pesoPagableSecar, kgDirecto: base.pesoPagableDirecto, directoAInventario: base.pesoPagable > 0 && base.pesoPagableSecar <= 0 },
    envio: proc && { fechaEnvio: proc.sent_on, lugar: proc.place, kilosEnviados: proc.kg_sent, fechaFin: proc.finished_on },
    costos: costsOf(lot.id).map((c) => ({ id: c.id, concepto: c.concept, valor: c.amount, observacion: c.notes })),
    resultadoReal: realResult(ctx, lot.id),
    comparacion: compareProjectedVsReal(ctx, lot.id),
  };
}

function saveShipment(ctx, lotId, input) {
  permissionService.assert(ctx.role, 'gestionar_lotes');
  const lot = getLot(ctx, lotId);
  if (!PRE_FINISH.includes(lot.status)) throw fail('El lote ya terminó el procesamiento', 409);
  const sentOn = input.fechaEnvio || null;
  if (sentOn && !DATE_RE.test(sentOn)) throw fail('Fecha de envío inválida (AAAA-MM-DD)');
  const base = purchaseBase(ctx, lot.id);
  const kg = input.kilosEnviados == null || input.kilosEnviados === '' ? base.pesoPagable : parseFloat(input.kilosEnviados);
  if (!Number.isFinite(kg) || kg <= 0) throw fail('Los kilos enviados deben ser mayores a cero');
  const place = String(input.lugar || '').trim() || null;
  db.prepare(
    `INSERT INTO lot_processing (lot_id, sent_on, place, kg_sent) VALUES (?, ?, ?, ?)
     ON CONFLICT(lot_id) DO UPDATE SET sent_on = excluded.sent_on, place = excluded.place, kg_sent = excluded.kg_sent, updated_at = datetime('now')`
  ).run(lot.id, sentOn, place, kg);
  auditService.log({ businessId: ctx.businessId, userId: ctx.userId, action: 'ENVIO_PROCESAMIENTO', entity: 'lot', entityId: lot.id, changes: { sentOn, place, kg } });
  return get(ctx, lot.id);
}

function addCost(ctx, lotId, input) {
  permissionService.assert(ctx.role, 'gestionar_lotes');
  permissionService.assert(ctx.role, 'ver_costos');
  const lot = getLot(ctx, lotId);
  if (['DISPONIBLE_PARA_VENTA', 'PARCIALMENTE_VENDIDO', 'VENDIDO', 'CERRADO'].includes(lot.status)) {
    throw fail('El lote ya está en inventario: sus costos quedaron congelados', 409);
  }
  const concept = String(input.concepto || '').trim();
  const valor = Math.round(parseFloat(input.valor));
  if (!concept) throw fail('El concepto es obligatorio');
  if (!Number.isFinite(valor) || valor <= 0) throw fail('El valor debe ser mayor a cero');
  db.prepare('INSERT INTO lot_processing_costs (lot_id, concept, amount, notes) VALUES (?, ?, ?, ?)').run(lot.id, concept, valor, String(input.observacion || '').trim() || null);
  auditService.log({ businessId: ctx.businessId, userId: ctx.userId, action: 'COSTO_PROCESAMIENTO', entity: 'lot', entityId: lot.id, changes: { concept, valor } });
  return get(ctx, lot.id);
}

function removeCost(ctx, lotId, costId) {
  permissionService.assert(ctx.role, 'gestionar_lotes');
  permissionService.assert(ctx.role, 'ver_costos');
  const lot = getLot(ctx, lotId);
  if (['DISPONIBLE_PARA_VENTA', 'PARCIALMENTE_VENDIDO', 'VENDIDO', 'CERRADO'].includes(lot.status)) {
    throw fail('El lote ya está en inventario: sus costos quedaron congelados', 409);
  }
  const changes = db.prepare('DELETE FROM lot_processing_costs WHERE id = ? AND lot_id = ?').run(Number(costId), lot.id).changes;
  if (!changes) throw fail('Costo no encontrado', 404);
  return get(ctx, lot.id);
}

/**
 * Registra la salida real del secado y deja el lote en SECADO_FINALIZADO.
 * En un lote mixto (compras que se secan + compras que no), `kilosSecosReales` es lo que salió del
 * secado de las primeras; lo que no se seca se suma al 100 % y todo entra junto a inventario.
 */
function finish(ctx, lotId, input) {
  permissionService.assert(ctx.role, 'gestionar_lotes');
  const lot = getLot(ctx, lotId);
  if (lot.status !== 'EN_SECADO') throw fail(`El lote debe estar EN_SECADO para registrar la salida (está ${lot.status})`, 409);
  const secadoReal = parseFloat(input.kilosSecosReales);
  const destare = input.destareRealKg == null || input.destareRealKg === '' ? 0 : parseFloat(input.destareRealKg);
  if (!Number.isFinite(secadoReal) || secadoReal <= 0) throw fail('Los kilos secos reales deben ser mayores a cero');
  if (!Number.isFinite(destare) || destare < 0) throw fail('El destare no puede ser negativo');
  const finishedOn = input.fechaFin || require('./sequenceService').today();
  if (!DATE_RE.test(finishedOn)) throw fail('Fecha inválida (AAAA-MM-DD)');
  const base = purchaseBase(ctx, lot.id);
  if (base.pesoPagable <= 0) throw fail('El lote no tiene compras activas', 409);
  if (base.pesoPagableSecar <= 0) throw fail('Ninguna compra de este lote requiere secado: envíalo directo a inventario', 409);
  const secos = coffeeMath.roundKg(secadoReal + base.pesoPagableDirecto);
  if (destare >= secos) throw fail('El destare debe ser menor a los kilos secos');
  const netos = coffeeMath.roundKg(secos - destare);
  // Rendimiento real del secado: solo sobre lo que realmente se secó.
  const rend = coffeeMath.roundKg((secadoReal / base.pesoPagableSecar) * 100);
  db.transaction(() => {
    db.prepare(
      `INSERT INTO lot_processing (lot_id, kilos_secos_reales, destare_real_kg, kilos_netos_reales, rendimiento_real_pct, finished_on)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(lot_id) DO UPDATE SET kilos_secos_reales = excluded.kilos_secos_reales, destare_real_kg = excluded.destare_real_kg,
         kilos_netos_reales = excluded.kilos_netos_reales, rendimiento_real_pct = excluded.rendimiento_real_pct,
         finished_on = excluded.finished_on, updated_at = datetime('now')`
    ).run(lot.id, secos, destare, netos, rend, finishedOn);
    lotService.transition(ctx, lot.id, 'SECADO_FINALIZADO', { reason: 'salida real registrada' });
    auditService.log({ businessId: ctx.businessId, userId: ctx.userId, action: 'SALIDA_REAL', entity: 'lot', entityId: lot.id, changes: { secos, destare, netos, rend } });
  })();
  return get(ctx, lot.id);
}

/** True si el lote tiene compras activas y ninguna requiere secado (va directo a inventario). */
function isDirectToInventory(ctx, lotId) {
  const base = purchaseBase(ctx, lotId);
  return base.pesoPagable > 0 && base.pesoPagableSecar <= 0;
}

/**
 * Atajo para lotes donde nada requiere secado: registra la salida al 100 % (secos = peso pagable,
 * sin destare) y deja el lote en SECADO_FINALIZADO para poder enviarlo a inventario.
 */
function finishWithoutDrying(ctx, lotId, input = {}) {
  permissionService.assert(ctx.role, 'gestionar_lotes');
  const lot = getLot(ctx, lotId);
  if (!PRE_FINISH.includes(lot.status)) throw fail('El lote ya terminó el procesamiento', 409);
  const base = purchaseBase(ctx, lot.id);
  if (base.pesoPagable <= 0) throw fail('El lote no tiene compras activas', 409);
  if (base.pesoPagableSecar > 0) throw fail('Este lote tiene compras que requieren secado', 409);
  const finishedOn = input.fechaFin || require('./sequenceService').today();
  if (!DATE_RE.test(finishedOn)) throw fail('Fecha inválida (AAAA-MM-DD)');
  db.transaction(() => {
    db.prepare(
      `INSERT INTO lot_processing (lot_id, kilos_secos_reales, destare_real_kg, kilos_netos_reales, rendimiento_real_pct, finished_on)
       VALUES (?, ?, 0, ?, 100, ?)
       ON CONFLICT(lot_id) DO UPDATE SET kilos_secos_reales = excluded.kilos_secos_reales, destare_real_kg = 0,
         kilos_netos_reales = excluded.kilos_netos_reales, rendimiento_real_pct = 100,
         finished_on = excluded.finished_on, updated_at = datetime('now')`
    ).run(lot.id, base.pesoPagable, base.pesoPagable, finishedOn);
    lotService.transition(ctx, lot.id, 'SECADO_FINALIZADO', { reason: 'sin secado: salida al 100%' });
    auditService.log({ businessId: ctx.businessId, userId: ctx.userId, action: 'SALIDA_SIN_SECADO', entity: 'lot', entityId: lot.id, changes: { kg: base.pesoPagable } });
  })();
  return get(ctx, lot.id);
}

module.exports = { get, saveShipment, addCost, removeCost, finish, finishWithoutDrying, isDirectToInventory, realResult, compareProjectedVsReal, purchaseBase };
