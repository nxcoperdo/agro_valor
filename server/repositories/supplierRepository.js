const db = require('../db/connection');

function findById(businessId, id) {
  return db.prepare('SELECT * FROM suppliers WHERE business_id = ? AND id = ?').get(businessId, id);
}

function findByIdentification(businessId, idType, idNumber) {
  return db
    .prepare('SELECT * FROM suppliers WHERE business_id = ? AND id_type = ? AND id_number = ?')
    .get(businessId, idType, idNumber);
}

function search(businessId, query, limit = 20) {
  const like = `%${query}%`;
  return db
    .prepare(
      `SELECT * FROM suppliers WHERE business_id = ? AND (name LIKE ? OR id_number LIKE ? OR legal_name LIKE ?)
       ORDER BY name LIMIT ?`
    )
    .all(businessId, like, like, like, limit);
}

function create(businessId, s) {
  const info = db
    .prepare(
      `INSERT INTO suppliers (business_id, id_type, id_number, name, legal_name, phone, address, municipality, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(businessId, s.idType, s.idNumber, s.name, s.legalName, s.phone, s.address, s.municipality, s.notes);
  return findById(businessId, info.lastInsertRowid);
}

module.exports = { findById, findByIdentification, search, create };
