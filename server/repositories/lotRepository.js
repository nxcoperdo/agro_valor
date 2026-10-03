const db = require('../db/connection');

const findById = (businessId, id) => db.prepare('SELECT * FROM lots WHERE business_id = ? AND id = ?').get(businessId, id);

function insert(businessId, { code, notes, userId }) {
  const info = db.prepare('INSERT INTO lots (business_id, code, notes, created_by) VALUES (?, ?, ?, ?)').run(businessId, code, notes, userId);
  return findById(businessId, info.lastInsertRowid);
}

const list = (businessId, limit = 200) =>
  db.prepare('SELECT * FROM lots WHERE business_id = ? ORDER BY id DESC LIMIT ?').all(businessId, limit);

const setStatus = (businessId, id, status) =>
  db.prepare('UPDATE lots SET status = ? WHERE business_id = ? AND id = ?').run(status, businessId, id).changes;

const attachPurchase = (lotId, purchaseId) => {
  db.prepare('INSERT INTO lot_purchases (lot_id, purchase_id) VALUES (?, ?)').run(lotId, purchaseId);
  db.prepare('UPDATE purchases SET lot_id = ? WHERE id = ?').run(lotId, purchaseId);
};

const detachPurchase = (lotId, purchaseId) => {
  db.prepare('DELETE FROM lot_purchases WHERE lot_id = ? AND purchase_id = ?').run(lotId, purchaseId);
  db.prepare('UPDATE purchases SET lot_id = NULL WHERE id = ?').run(purchaseId);
};

const purchaseCount = (lotId) => db.prepare('SELECT COUNT(*) AS c FROM lot_purchases WHERE lot_id = ?').get(lotId).c;

module.exports = { findById, insert, list, setStatus, attachPurchase, detachPurchase, purchaseCount };
