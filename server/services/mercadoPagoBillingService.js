const mercadoPagoService = require('./mercadoPagoService');
const subscriptionService = require('./subscriptionService');
const userRepository = require('../repositories/userRepository');
const mpPaymentRepository = require('../repositories/mpPaymentRepository');
const logger = require('../utils/logger');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Desde que el registro pide correo (y el correo ES el usuario, ver auth.routes.js),
 * user.username ya es un correo real para toda cuenta nueva. Antes se generaba uno
 * técnico (usuario@pagos.agrovalor.co) para las cuentas creadas cuando aún no se pedía
 * correo — eso hacía que Mercado Pago mostrara "el correo no coincide con la cuenta" en
 * el checkout, porque el comprador entra ahí con SU correo real de Mercado Pago, que
 * nunca iba a coincidir con uno inventado. Con el correo real esto ya no debería pasar;
 * el fallback técnico solo queda para las cuentas viejas que aún no tienen uno.
 */
function payerEmailFor(user) {
  if (EMAIL_RE.test(user.username)) return user.username;
  return `${user.username}@pagos.agrovalor.co`;
}

/** Crea la preferencia de pago único (Checkout Pro) y devuelve la URL de checkout. */
async function startPayment(userId) {
  if (!mercadoPagoService.isConfigured()) {
    throw Object.assign(new Error('Mercado Pago no está configurado en el servidor'), { status: 503 });
  }

  const user = userRepository.findById(userId);
  const { id, initPoint } = await mercadoPagoService.createPreference({
    userId,
    payerEmail: payerEmailFor(user),
  });

  userRepository.setMpPayment(userId, { paymentId: id, status: 'pending' });
  return { initPoint };
}

/**
 * Registra un pago aprobado si todavía no se había contado (idempotencia por mp_payment_id)
 * y extiende Pro un año. Se usa desde confirmPayment (cuando el usuario vuelve del checkout),
 * desde reconcile (cron de respaldo) y desde el webhook.
 */
function applyApprovedPayment(user, payment) {
  if (mpPaymentRepository.exists(payment.id)) return false;

  mpPaymentRepository.create({
    userId: user.id,
    mpPaymentId: payment.id,
    status: payment.status,
    amountCop: Math.round(payment.amount),
    billingPeriodStart: payment.date,
  });
  subscriptionService.activatePro(user.id, 12);
  logger.info(`Pago de Mercado Pago aprobado para ${user.username}: Pro activado por 1 año (pago ${payment.id})`);
  return true;
}

/** Busca el pago más reciente del usuario y, si ya está aprobado, activa Pro. */
async function confirmPayment(userId) {
  const user = userRepository.findById(userId);
  const payments = await mercadoPagoService.searchPayments(userId);
  const approved = payments.find((p) => p.status === 'approved');

  if (approved) {
    applyApprovedPayment(user, approved);
    userRepository.setMpPayment(userId, { paymentId: approved.id, status: 'approved' });
  } else if (payments[0]) {
    userRepository.setMpPayment(userId, { paymentId: payments[0].id, status: payments[0].status });
  }

  return userRepository.findById(userId);
}

/**
 * Cron de respaldo: para quien se quedó con un pago "pending" (p. ej. cerró el navegador
 * antes de volver a la web), revisa si Mercado Pago ya lo aprobó. El webhook cubre el caso
 * normal en tiempo real; esto es por si ese webhook no llegó.
 */
async function reconcile() {
  if (!mercadoPagoService.isConfigured()) return;

  const users = userRepository.findAllWithMpPaymentStatus('pending');

  for (const user of users) {
    try {
      await confirmPayment(user.id);
    } catch (err) {
      logger.error(`mercadoPagoBillingService: error reconciliando el pago del usuario ${user.id}:`, err);
    }
  }
}

/** Procesa una notificación de webhook ("type": "payment"). */
async function handleWebhookEvent(payload) {
  if (payload.type !== 'payment' || !payload.data || !payload.data.id) return;

  const payment = await mercadoPagoService.getPayment(payload.data.id);
  if (!payment.externalReference) return;

  const user = userRepository.findById(parseInt(payment.externalReference, 10));
  if (!user) return;

  if (payment.status === 'approved') {
    applyApprovedPayment(user, payment);
  }
  userRepository.setMpPayment(user.id, { paymentId: payment.id, status: payment.status });
}

module.exports = { startPayment, confirmPayment, reconcile, handleWebhookEvent, payerEmailFor };
