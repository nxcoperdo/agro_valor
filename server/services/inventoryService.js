const db = require('../db/connection');
const coffeeMath = require('../domain/coffeeMath');
const lotRepository = require('../repositories/lotRepository');
const lotService = require('./lotService');
const processingService = require('./processingService');
const sequenceService = require('./sequenceService');
const auditService = require('./auditService');
const permissionService = require('./permissionService');
const { toIso } = require('../utils/datetime');

const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const findLotRow = (businessId, inventoryLotId) =>
  db.prepare(
    `SELECT i.*, l.code AS lot_code, l.status AS lot_status FROM inventory_lots i JOIN lots l ON l.id = i.lot_id
     WHERE i.business_id = ? AND i.id = ?`
  ).get(businessId, Number(inventoryLotId));

function serialize(row, role) {
  const out = {
    id: row.id,
    lot: { id: row.lot_id, code: row.lot_code },
    status: row.lot_status,
    location: row.location,
    enteredOn: row.entered_on,
    kgIniciales: row.kg_initial,
    kgVendidos: row.kg_sold,
    kgDisponibles: coffeeMath.roundKg(row.kg_initial - row.kg_sold),
  };
  if (permissionService.can(role, 'ver_costos')) {
    out.costoKg = row.cost_kg;
    out.costoCarga = row.cost_carga;
  }
  return out;
}

/** Cuando termina el procesamiento: el lote pasa a inventario con su costo real congelado. */
function enter(ctx, lotId, input = {}) {
  permissionService.assert(ctx.role, 'gestionar_lotes');
  permissionService.assert(ctx.role, 'ver_costos');
  const lot = lotRepository.findById(ctx.businessId, Number(lotId));
  if (!lot) throw fail('Lote no encontrado', 404);
  // Si nada del lote requiere secado, el paso de secado se registra solo (al 100 %) y entra a inventario.
  if (['CREADO', 'EN_TRANSPORTE', 'EN_SECADO'].includes(lot.status) && processingService.isDirectToInventory(ctx, lot.id)) {
    processingService.finishWithoutDrying(ctx, lot.id, { fechaFin: input.fechaEntrada });
    lot.status = 'SECADO_FINALIZADO';
  }
  if (lot.status !== 'SECADO_FINALIZADO') throw fail(`El lote debe estar en SECADO_FINALIZADO para entrar a inventario (está ${lot.status})`, 409);
  const enteredOn = input.fechaEntrada || sequenceService.today();
  if (!DATE_RE.test(enteredOn)) throw fail('Fecha inválida (AAAA-MM-DD)');
  const real = processingService.realResult(ctx, lot.id);
  if (!real || !real.costoRealKg) throw fail('Falta registrar la salida real del secado', 409);
  const id = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO inventory_lots (business_id, lot_id, kg_initial, location, entered_on, cost_kg, cost_carga)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(ctx.businessId, lot.id, real.kilosNetosReales, String(input.ubicacion || '').trim() || null, enteredOn, real.costoRealKg, real.costoRealCarga);
    db.prepare("INSERT INTO inventory_movements (inventory_lot_id, type, kg, ref_type, ref_id, user_id) VALUES (?, 'ENTRADA', ?, 'lot', ?, ?)")
      .run(info.lastInsertRowid, real.kilosNetosReales, lot.id, ctx.userId);
    lotService.transition(ctx, lot.id, 'DISPONIBLE_PARA_VENTA', { reason: 'entrada a inventario' });
    auditService.log({ businessId: ctx.businessId, userId: ctx.userId, action: 'ENTRADA_INVENTARIO', entity: 'lot', entityId: lot.id, changes: { kg: real.kilosNetosReales, costoKg: real.costoRealKg } });
    return Number(info.lastInsertRowid);
  })();
  return get(ctx, id);
}

function get(ctx, id) {
  const row = findLotRow(ctx.businessId, id);
  if (!row) throw fail('Inventario no encontrado', 404);
  return serialize(row, ctx.role);
}

function list(ctx, { onlyAvailable = false } = {}) {
  const rows = db
    .prepare(
      `SELECT i.*, l.code AS lot_code, l.status AS lot_status FROM inventory_lots i JOIN lots l ON l.id = i.lot_id
       WHERE i.business_id = ? ORDER BY i.id DESC`
    )
    .all(ctx.businessId);
  const items = rows.map((r) => serialize(r, ctx.role));
  const filtered = onlyAvailable ? items.filter((i) => i.kgDisponibles > 0) : items;
  return {
    items: filtered,
    totalKgDisponibles: coffeeMath.roundKg(items.reduce((a, i) => a + i.kgDisponibles, 0)),
  };
}

function movements(ctx, id) {
  if (!findLotRow(ctx.businessId, id)) throw fail('Inventario no encontrado', 404);
  return db.prepare('SELECT * FROM inventory_movements WHERE inventory_lot_id = ? ORDER BY id').all(Number(id)).map((m) => ({
    id: m.id, type: m.type, kg: m.kg, refType: m.ref_type, refId: m.ref_id, at: toIso(m.created_at),
  }));
}

/** Estado del lote según saldo: DISPONIBLE (nada vendido), PARCIALMENTE_VENDIDO o VENDIDO (saldo 0). */
function syncLotStatus(ctx, row, reason) {
  const available = coffeeMath.roundKg(row.kg_initial - row.kg_sold);
  const status = available <= 0 ? 'VENDIDO' : row.kg_sold > 0 ? 'PARCIALMENTE_VENDIDO' : 'DISPONIBLE_PARA_VENTA';
  lotService.transition(ctx, row.lot_id, status, { reason });
}

/** Descuenta saldo (ventas). Debe llamarse dentro de la transacción de la venta. */
function removeStock(ctx, inventoryLotId, kg, { refType = 'sale', refId = null } = {}) {
  const row = findLotRow(ctx.businessId, inventoryLotId);
  if (!row) throw fail('Inventario no encontrado', 404);
  if (!['DISPONIBLE_PARA_VENTA', 'PARCIALMENTE_VENDIDO'].includes(row.lot_status)) throw fail(`El lote ${row.lot_code} no está disponible para venta`, 409);
  const available = coffeeMath.roundKg(row.kg_initial - row.kg_sold);
  if (!(kg > 0)) throw fail('Los kg a vender deben ser mayores a cero');
  if (kg > available + 1e-9) throw fail(`Solo hay ${available} kg disponibles en ${row.lot_code}`, 409);
  const sold = coffeeMath.roundKg(row.kg_sold + kg);
  db.prepare('UPDATE inventory_lots SET kg_sold = ? WHERE id = ?').run(sold, row.id);
  db.prepare("INSERT INTO inventory_movements (inventory_lot_id, type, kg, ref_type, ref_id, user_id) VALUES (?, 'SALIDA_VENTA', ?, ?, ?, ?)").run(row.id, -kg, refType, refId, ctx.userId);
  syncLotStatus(ctx, { ...row, kg_sold: sold }, 'venta');
  return { ...row, kg_sold: sold };
}

/** Devuelve saldo (anulación de venta). */
function restoreStock(ctx, inventoryLotId, kg, { refType = 'sale', refId = null } = {}) {
  const row = findLotRow(ctx.businessId, inventoryLotId);
  if (!row) throw fail('Inventario no encontrado', 404);
  const sold = coffeeMath.roundKg(Math.max(0, row.kg_sold - kg));
  db.prepare('UPDATE inventory_lots SET kg_sold = ? WHERE id = ?').run(sold, row.id);
  db.prepare("INSERT INTO inventory_movements (inventory_lot_id, type, kg, ref_type, ref_id, user_id) VALUES (?, 'AJUSTE', ?, ?, ?, ?)").run(row.id, kg, refType, refId, ctx.userId);
  syncLotStatus(ctx, { ...row, kg_sold: sold }, 'anulación de venta');
}

module.exports = { enter, get, list, movements, removeStock, restoreStock, findLotRow };
