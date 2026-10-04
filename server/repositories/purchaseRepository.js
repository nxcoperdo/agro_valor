const db = require('../db/connection');

function insert(p) {
  const info = db
    .prepare(
      `INSERT INTO purchases (business_id, code, receipt_code, supplier_id, workday_id, coffee_type, merma_inicial_pct,
         peso_total_kg, kg_descontados, peso_pagable_kg, precio_carga, precio_kg, total_compra,
         payment_method, payment_reference, notes, created_by, requires_drying)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(p.businessId, p.code, p.code, p.supplierId, p.workdayId, p.coffeeType, p.mermaPct, p.pesoTotal,
      p.kgDescontados, p.pesoPagable, p.precioCarga, p.precioKg, p.totalCompra, p.paymentMethod,
      p.paymentReference, p.notes, p.userId, p.requiresDrying ? 1 : 0);
  return info.lastInsertRowid;
}

function insertWeighing(purchaseId, w) {
  db.prepare('INSERT INTO purchase_weighings (purchase_id, weight_kg, user_id, notes) VALUES (?, ?, ?, ?)').run(
    purchaseId, w.pesoKg, w.userId, w.notes
  );
}

const SELECT = `SELECT p.*, s.name AS supplier_name, s.id_type AS supplier_id_type, s.id_number AS supplier_id_number,
    s.phone AS supplier_phone, l.code AS lot_code,
    (SELECT COUNT(*) FROM purchase_weighings w WHERE w.purchase_id = p.id) AS weighings_count
  FROM purchases p JOIN suppliers s ON s.id = p.supplier_id LEFT JOIN lots l ON l.id = p.lot_id`;

function findById(businessId, id) {
  return db.prepare(`${SELECT} WHERE p.business_id = ? AND p.id = ?`).get(businessId, id);
}

function weighings(purchaseId) {
  return db.prepare('SELECT * FROM purchase_weighings WHERE purchase_id = ? ORDER BY id').all(purchaseId);
}

function list(businessId, { from, to, supplierId, status, noLot, lotId, limit = 200 }) {
  const where = ['p.business_id = ?'];
  const params = [businessId];
  if (from) { where.push('date(p.purchased_at) >= ?'); params.push(from); }
  if (to) { where.push('date(p.purchased_at) <= ?'); params.push(to); }
  if (supplierId) { where.push('p.supplier_id = ?'); params.push(supplierId); }
  if (status) { where.push('p.status = ?'); params.push(status); }
  if (noLot) where.push('p.lot_id IS NULL');
  if (lotId) { where.push('p.lot_id = ?'); params.push(lotId); }
  params.push(limit);
  return db.prepare(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY p.id DESC LIMIT ?`).all(...params);
}

function markVoid(businessId, id, { reason, userId }) {
  return db
    .prepare(
      `UPDATE purchases SET status = 'ANULADA', void_reason = ?, voided_by = ?, voided_at = datetime('now')
       WHERE business_id = ? AND id = ? AND status = 'ACTIVA'`
    )
    .run(reason, userId, businessId, id).changes;
}

module.exports = { insert, insertWeighing, findById, weighings, list, markVoid };
