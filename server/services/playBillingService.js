const googlePlayService = require('./googlePlayService');
const subscriptionService = require('./subscriptionService');
const userRepository = require('../repositories/userRepository');
const env = require('../config/env');
const logger = require('../utils/logger');

/**
 * Verifica una compra que la app acaba de reportar (justo después de que Play Billing
 * la confirmó del lado del teléfono) y, si es real y del producto esperado, activa Pro
 * con la fecha exacta que da Google.
 */
async function verifyAndActivate(userId, { purchaseToken, productId }) {
  if (!purchaseToken || productId !== env.googlePlayProductId) {
    throw Object.assign(new Error('Compra inválida'), { status: 400 });
  }

  const result = await googlePlayService.verifySubscription(purchaseToken);

  if (!result.active || result.productId !== env.googlePlayProductId) {
    throw Object.assign(new Error('La suscripción no está activa'), { status: 400 });
  }

  userRepository.setPlayPurchase(userId, { purchaseToken, productId });
  return subscriptionService.setProUntil(userId, result.expiryTimeIso);
}

/**
 * Google nunca manda el estado real en la notificación misma — solo avisa que "algo
 * cambió" y hay que volver a preguntarle. Por eso cada mensaje dispara una verificación
 * fresca contra la API, nunca se actúa solo con el tipo de notificación.
 */
async function processNotification(payload) {
  const notification = payload.subscriptionNotification;
  if (!notification || !notification.purchaseToken) return;

  const user = userRepository.findByPlayPurchaseToken(notification.purchaseToken);
  if (!user) {
    logger.warn(
      `playBillingService: notificación de Play para un token que no pertenece a ningún usuario (tipo ${
        googlePlayService.NOTIFICATION_TYPES[notification.notificationType] || notification.notificationType
      }).`
    );
    return;
  }

  const result = await googlePlayService.verifySubscription(notification.purchaseToken);

  if (result.active) {
    subscriptionService.setProUntil(user.id, result.expiryTimeIso);
  } else {
    subscriptionService.cancel(user.id);
  }
}

/**
 * Jala los mensajes pendientes de la suscripción pull de Pub/Sub y los procesa uno por
 * uno. Se usa el cliente de bajo nivel (v1.SubscriberClient.pull) en vez de la API de
 * streaming de alto nivel, porque esto corre como un cron cada pocos minutos, no como
 * un proceso que mantiene una conexión abierta todo el tiempo.
 */
async function pullAndProcessNotifications() {
  if (!googlePlayService.isConfigured() || !env.googlePlaySubscriptionName) return;

  // Import perezoso: si nadie llama esta función (Play Billing sin configurar todavía),
  // no hace falta que @google-cloud/pubsub abra ninguna conexión.
  const { v1 } = require('@google-cloud/pubsub');
  const client = new v1.SubscriberClient({ keyFilename: env.googlePlayServiceAccountPath });
  const subscription = env.googlePlaySubscriptionName;

  const [response] = await client.pull({ subscription, maxMessages: 20 });
  const received = response.receivedMessages || [];
  const ackIds = [];

  for (const { ackId, message } of received) {
    try {
      const payload = JSON.parse(Buffer.from(message.data, 'base64').toString('utf8'));
      await processNotification(payload);
      ackIds.push(ackId);
    } catch (err) {
      logger.error('playBillingService: error procesando notificación de Play:', err);
      // No se acumula en ackIds: Pub/Sub la reintenta más tarde.
    }
  }

  if (ackIds.length > 0) {
    await client.acknowledge({ subscription, ackIds });
  }
}

module.exports = { verifyAndActivate, processNotification, pullAndProcessNotifications };
