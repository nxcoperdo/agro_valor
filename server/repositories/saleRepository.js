const db = require('../db/connection');

function create({
  userId,
  cooperativeId = null,
  cooperativeName = null,
  cargas,
  priceCopCarga,
  factor = null,
  humidity = null,
  soldOn,
  notes = null,
}) {
  const info = db
    .prepare(
      `INSERT INTO sales (user_id, cooperative_id, cooperative_name, cargas, price_cop_carga, factor, humidity, sold_on, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(userId, cooperativeId, cooperativeName, cargas, priceCopCarga, factor, humidity, soldOn, notes);
  return db.prepare('SELECT * FROM sales WHERE id = ?').get(info.lastInsertRowid);
}

function findByUser(userId, limit = 100) {
  return db
    .prepare('SELECT * FROM sales WHERE user_id = ? ORDER BY sold_on DESC, id DESC LIMIT ?')
    .all(userId, limit);
}

function remove(id, userId) {
  return db.prepare('DELETE FROM sales WHERE id = ? AND user_id = ?').run(id, userId).changes;
}

function summary(userId) {
  return db
    .prepare(
      `SELECT COUNT(*) AS sales_count,
              COALESCE(SUM(cargas), 0) AS total_cargas,
              COALESCE(SUM(cargas * price_cop_carga), 0) AS total_income,
              COALESCE(AVG(price_cop_carga), 0) AS avg_price
       FROM sales WHERE user_id = ?`
    )
    .get(userId);
}

/** Precio de referencia FNC vigente en la fecha de una venta, para comparar. */
function referencePriceOn(date) {
  return db
    .prepare(
      `SELECT price_cop_carga FROM fnc_reference_prices
       WHERE date(scraped_at) <= date(?)
       ORDER BY scraped_at DESC LIMIT 1`
    )
    .get(date);
}

module.exports = { create, findByUser, remove, summary, referencePriceOn };
