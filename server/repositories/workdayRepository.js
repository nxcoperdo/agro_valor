const db = require('../db/connection');

const findById = (businessId, id) =>
  db.prepare('SELECT * FROM purchase_workdays WHERE business_id = ? AND id = ?').get(businessId, id);

const findOpenForDate = (businessId, date) =>
  db
    .prepare("SELECT * FROM purchase_workdays WHERE business_id = ? AND work_date = ? AND status = 'ABIERTA' ORDER BY id DESC LIMIT 1")
    .get(businessId, date);

function insert(businessId, { code, date, userId }) {
  const info = db
    .prepare('INSERT INTO purchase_workdays (business_id, code, work_date, opened_by) VALUES (?, ?, ?, ?)')
    .run(businessId, code, date, userId);
  return findById(businessId, info.lastInsertRowid);
}

const list = (businessId, limit = 60) =>
  db.prepare('SELECT * FROM purchase_workdays WHERE business_id = ? ORDER BY id DESC LIMIT ?').all(businessId, limit);

function close(businessId, id, userId) {
  return db
    .prepare("UPDATE purchase_workdays SET status = 'CERRADA', closed_by = ?, closed_at = datetime('now') WHERE business_id = ? AND id = ? AND status = 'ABIERTA'")
    .run(userId, businessId, id).changes;
}

/**
 * Consolidado de compras ACTIVAS. `where` es un fragmento sobre la tabla p (purchases) y
 * `params` sus valores; siempre se filtra por negocio.
 * Kilos secos proyectados: el guardado en la proyección de la compra o, si no hay,
 * peso pagable × rendimiento por defecto (55% si se seca, 100% si no).
 */
function summarize(businessId, where = '1=1', params = []) {
  return db
    .prepare(
      `SELECT COUNT(*) AS compras,
              COUNT(DISTINCT p.supplier_id) AS proveedores,
              COALESCE(SUM((SELECT COUNT(*) FROM purchase_weighings w WHERE w.purchase_id = p.id)), 0) AS pesadas,
              COALESCE(SUM(p.peso_total_kg), 0) AS kg_recibidos,
              COALESCE(SUM(p.peso_pagable_kg), 0) AS kg_pagables,
              COALESCE(SUM(p.kg_descontados), 0) AS kg_descontados,
              COALESCE(SUM(p.total_compra), 0) AS total_pagado,
              COALESCE(SUM((SELECT COALESCE(SUM(c.amount), 0) FROM purchase_costs c WHERE c.purchase_id = p.id)), 0) AS costos_internos,
              COALESCE(SUM(COALESCE((SELECT pr.kilos_secos FROM purchase_projections pr WHERE pr.purchase_id = p.id), p.peso_pagable_kg * (CASE WHEN p.requires_drying = 1 THEN 0.55 ELSE 1 END))), 0) AS kg_secos_proyectados,
              COALESCE(AVG(p.precio_carga), 0) AS precio_carga_promedio
       FROM purchases p WHERE p.business_id = ? AND p.status = 'ACTIVA' AND ${where}`
    )
    .get(businessId, ...params);
}

module.exports = { findById, findOpenForDate, insert, list, close, summarize };
