const db = require('../db/connection');

function insert(i) {
  const info = db
    .prepare(
      `INSERT INTO purchase_invoices (business_id, code, supplier_id, workday_id, payment_method, payment_reference, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(i.businessId, i.code, i.supplierId, i.workdayId, i.paymentMethod, i.paymentReference, i.notes, i.userId);
  return Number(info.lastInsertRowid);
}

const SELECT = `SELECT i.*, s.name AS supplier_name, s.id_type AS supplier_id_type, s.id_number AS supplier_id_number,
    s.phone AS supplier_phone, s.legal_name AS supplier_legal_name, s.address AS supplier_address,
    s.municipality AS supplier_municipality, s.notes AS supplier_notes, w.code AS workday_code
  FROM purchase_invoices i JOIN suppliers s ON s.id = i.supplier_id LEFT JOIN purchase_workdays w ON w.id = i.workday_id`;

function findById(businessId, id) {
  return db.prepare(`${SELECT} WHERE i.business_id = ? AND i.id = ?`).get(businessId, id);
}

function list(businessId, { from, to, supplierId, status, limit = 200 }) {
  const where = ['i.business_id = ?'];
  const params = [businessId];
  if (from) { where.push('date(i.purchased_at) >= ?'); params.push(from); }
  if (to) { where.push('date(i.purchased_at) <= ?'); params.push(to); }
  if (supplierId) { where.push('i.supplier_id = ?'); params.push(supplierId); }
  if (status) { where.push('i.status = ?'); params.push(status); }
  params.push(limit);
  return db.prepare(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY i.id DESC LIMIT ?`).all(...params);
}

/** Ids de las compras (líneas) de la factura, en el orden en que se registraron. */
function lineIds(invoiceId) {
  return db.prepare('SELECT id FROM purchases WHERE invoice_id = ? ORDER BY id').all(invoiceId).map((r) => r.id);
}

/** Líneas con lote, para impedir la anulación de una factura cuyos productos ya se clasificaron. */
function linesInLot(invoiceId) {
  return db
    .prepare(
      `SELECT p.code, l.code AS lot_code FROM purchases p JOIN lots l ON l.id = p.lot_id
       WHERE p.invoice_id = ? AND p.status = 'ACTIVA'`
    )
    .all(invoiceId);
}

function markVoid(businessId, id, { reason, userId }) {
  return db
    .prepare(
      `UPDATE purchase_invoices SET status = 'ANULADA', void_reason = ?, voided_by = ?, voided_at = datetime('now')
       WHERE business_id = ? AND id = ? AND status = 'ACTIVA'`
    )
    .run(reason, userId, businessId, id).changes;
}

/** Cuántas líneas ACTIVAS tiene la factura. */
function activeLineCount(invoiceId) {
  return db.prepare("SELECT COUNT(*) AS n FROM purchases WHERE invoice_id = ? AND status = 'ACTIVA'").get(invoiceId).n;
}

function lineCount(invoiceId) {
  return db.prepare('SELECT COUNT(*) AS n FROM purchases WHERE invoice_id = ?').get(invoiceId).n;
}

module.exports = { insert, findById, list, lineIds, linesInLot, markVoid, activeLineCount, lineCount };
