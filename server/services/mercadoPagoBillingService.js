const mercadoPagoService = require('./mercadoPagoService');
const subscriptionService = require('./subscriptionService');
const userRepository = require('../repositories/userRepository');
const mpPaymentRepository = require('../repositories/mpPaymentRepository');
const env = require('../config/env');
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

/** Crea la suscripción y devuelve la URL de checkout de Mercado Pago para redirigir al usuario. */
async function startSubscription(userId) {
  if (!mercadoPagoService.isConfigured()) {
    throw Object.assign(new Error('Mercado Pago no está configurado en el servidor'), { status: 503 });
  }

  const user = userRepository.findById(userId);
  const { id, initPoint } = await mercadoPagoService.createPreapproval({
    userId,
    payerEmail: payerEmailFor(user),
  });

  userRepository.setMpPreapproval(userId, { preapprovalId: id, status: 'pending' });
  return { initPoint };
}

/** Se llama cuando el usuario vuelve del checkout de Mercado Pago (back_url). */
async function confirmSubscription(userId) {
  const user = userRepository.findById(userId);

  if (!user.mp_preapproval_id) {
    throw Object.assign(new Error('No tienes una suscripción de Mercado Pago en curso'), { status: 400 });
  }

  const { status } = await mercadoPagoService.getPreapproval(user.mp_preapproval_id);
  userRepository.setMpPreapproval(userId, { preapprovalId: user.mp_preapproval_id, status });

  if (status === 'authorized') {
    subscriptionService.activatePro(userId, 1);
  }

  return userRepository.findById(userId);
}

/**
 * El usuario cancela la renovación. Pro sigue hasta que vence el mes ya pagado
 * (plan_expires_at no se toca): lo que cambia es que Mercado Pago no vuelve a cobrar y
 * reconcile() ya no la extiende, porque solo mira suscripciones 'authorized'.
 */
async function cancelSubscription(userId) {
  const user = userRepository.findById(userId);

  if (!user.mp_preapproval_id || user.mp_preapproval_status === 'cancelled') {
    throw Object.assign(new Error('No tienes una suscripción activa para cancelar'), { status: 400 });
  }

  const { status } = await mercadoPagoService.cancelPreapproval(user.mp_preapproval_id);
  userRepository.setMpPreapproval(userId, { preapprovalId: user.mp_preapproval_id, status: status || 'cancelled' });
  logger.info(`Suscripción de Mercado Pago cancelada por el usuario ${user.username}`);

  return userRepository.findById(userId);
}

/**
 * Cron diario: para cada usuario con una suscripción autorizada, revisa si Mercado Pago
 * ya hizo un cobro nuevo (que ellos disparan solos cada mes) y extiende Pro. Esto es lo
 * que reemplaza al webhook mientras el server no tenga HTTPS para recibirlo.
 */
async function reconcile() {
  if (!mercadoPagoService.isConfigured()) return;

  const users = userRepository.findAllWithMpPreapproval('authorized');

  for (const user of users) {
    try {
      const payments = await mercadoPagoService.searchAuthorizedPayments(user.mp_preapproval_id);

      for (const payment of payments) {
        if (payment.status !== 'approved') continue;
        if (mpPaymentRepository.exists(payment.id)) continue;

        mpPaymentRepository.create({
          userId: user.id,
          mpPaymentId: payment.id,
          status: payment.status,
          amountCop: Math.round(payment.amount),
          billingPeriodStart: payment.date,
        });
        subscriptionService.activatePro(user.id, 1);
      }
    } catch (err) {
      logger.error(`mercadoPagoBillingService: error reconciliando la suscripción del usuario ${user.id}:`, err);
    }
  }
}

/** Procesa una notificación de webhook (cuando exista HTTPS). Reusa la misma lógica de reconcile. */
async function handleWebhookEvent(payload) {
  if (payload.type !== 'subscription_authorized_payment' && payload.type !== 'subscription_preapproval') return;
  await reconcile();
}

module.exports = { startSubscription, confirmSubscription, cancelSubscription, reconcile, handleWebhookEvent, payerEmailFor };
