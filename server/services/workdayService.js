const db = require('../db/connection');
const workdayRepository = require('../repositories/workdayRepository');
const sequenceService = require('./sequenceService');
const auditService = require('./auditService');
const permissionService = require('./permissionService');
const coffeeMath = require('../domain/coffeeMath');
const { toIso } = require('../utils/datetime');

const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });

function serializeSummary(s, role) {
  const out = {
    compras: s.compras,
    proveedores: s.proveedores,
    pesadas: s.pesadas,
    kgRecibidos: coffeeMath.roundKg(s.kg_recibidos),
    kgPagables: coffeeMath.roundKg(s.kg_pagables),
    kgDescontados: coffeeMath.roundKg(s.kg_descontados),
    totalPagado: s.total_pagado,
    kgSecosProyectados: coffeeMath.roundKg(s.kg_secos_proyectados),
    precioCargaPromedio: Math.round(s.precio_carga_promedio),
    mermaPromedio: s.kg_recibidos > 0 ? coffeeMath.roundKg((s.kg_descontados / s.kg_recibidos) * 100) : 0,
  };
  if (permissionService.can(role, 'ver_costos')) out.costosInternos = s.costos_internos;
  return out;
}

function serialize(w, role) {
  return w && {
    id: w.id,
    code: w.code,
    date: w.work_date,
    status: w.status,
    closedAt: w.closed_at ? toIso(w.closed_at) : null,
    summary: serializeSummary(workdayRepository.summarize(w.business_id, 'p.workday_id = ?', [w.id]), role),
  };
}

/** Jornada abierta de hoy; si no existe (o la de hoy ya se cerró) se abre una nueva. */
function currentOrOpen(ctx) {
  const date = sequenceService.today();
  const row = db.transaction(() => {
    const open = workdayRepository.findOpenForDate(ctx.businessId, date);
    if (open) return open;
    const created = workdayRepository.insert(ctx.businessId, {
      code: sequenceService.nextWorkdayCode(ctx.businessId),
      date,
      userId: ctx.userId,
    });
    auditService.log({ businessId: ctx.businessId, userId: ctx.userId, action: 'ABRIR_JORNADA', entity: 'workday', entityId: created.id, changes: { code: created.code } });
    return created;
  })();
  return row;
}

/** Id de jornada para una compra nueva: la indicada (debe estar abierta) o la actual. */
function resolveForPurchase(ctx, workdayId) {
  if (workdayId) {
    const w = workdayRepository.findById(ctx.businessId, Number(workdayId));
    if (!w) throw fail('Jornada no encontrada', 404);
    if (w.status !== 'ABIERTA') throw fail(`La jornada ${w.code} está cerrada`, 409);
    return w.id;
  }
  return currentOrOpen(ctx).id;
}

const current = (ctx) => serialize(currentOrOpen(ctx), ctx.role);
const list = (ctx) => workdayRepository.list(ctx.businessId).map((w) => serialize(w, ctx.role));

function get(ctx, id) {
  const w = workdayRepository.findById(ctx.businessId, Number(id));
  if (!w) throw fail('Jornada no encontrada', 404);
  return serialize(w, ctx.role);
}

function closeWorkday(ctx, id) {
  permissionService.assert(ctx.role, 'cerrar_jornada');
  const w = workdayRepository.findById(ctx.businessId, Number(id));
  if (!w) throw fail('Jornada no encontrada', 404);
  if (w.status === 'CERRADA') throw fail('La jornada ya está cerrada', 409);
  workdayRepository.close(ctx.businessId, w.id, ctx.userId);
  auditService.log({ businessId: ctx.businessId, userId: ctx.userId, action: 'CERRAR_JORNADA', entity: 'workday', entityId: w.id, changes: { code: w.code } });
  return get(ctx, w.id);
}

/** Resumen de un día calendario (todas sus jornadas), hoy por defecto. */
function daySummary(ctx, date = sequenceService.today()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw fail('Fecha inválida (AAAA-MM-DD)');
  const s = workdayRepository.summarize(ctx.businessId, "date(datetime(p.purchased_at, '-5 hours')) = ?", [date]);
  return { date, ...serializeSummary(s, ctx.role) };
}

module.exports = { currentOrOpen, resolveForPurchase, current, list, get, closeWorkday, daySummary, serializeSummary };
