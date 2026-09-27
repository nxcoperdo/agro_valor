const db = require('../db/connection');

function exists(mpPaymentId) {
  return Boolean(db.prepare('SELECT 1 FROM mp_payments WHERE mp_payment_id = ?').get(mpPaymentId));
}

function create({ userId, mpPaymentId, status, amountCop, billingPeriodStart }) {
  db.prepare(
    `INSERT INTO mp_payments (user_id, mp_payment_id, status, amount_cop, billing_period_start)
     VALUES (?, ?, ?, ?, ?)`
  ).run(userId, mpPaymentId, status, amountCop, billingPeriodStart);
}

function findByUser(userId) {
  return db.prepare('SELECT * FROM mp_payments WHERE user_id = ? ORDER BY created_at DESC').all(userId);
}

module.exports = { exists, create, findByUser };
