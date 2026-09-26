const fs = require('fs');
const env = require('../config/env');
const pushDeviceRepository = require('../repositories/pushDeviceRepository');
const logger = require('../utils/logger');

/**
 * Notificaciones push a la app móvil vía Firebase Cloud Messaging.
 *
 * Es el canal gratis: WhatsApp cobra por cada plantilla que se manda, FCM no. Se
 * autentica con la cuenta de servicio del proyecto de Firebase (un JSON que se
 * descarga en Configuración del proyecto → Cuentas de servicio).
 *
 * Igual que WhatsApp, si no está configurado los envíos quedan como "queued" y el
 * resto de la aplicación funciona igual.
 */

/** Errores de FCM que significan que el token ya no sirve (app desinstalada, datos borrados). */
const DEAD_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

let messaging = null;
let initFailed = false;

function isConfigured() {
  return Boolean(env.firebaseServiceAccountPath);
}

function getMessagingClient() {
  if (messaging || initFailed || !isConfigured()) return messaging;

  try {
    const { initializeApp, cert } = require('firebase-admin/app');
    const { getMessaging } = require('firebase-admin/messaging');
    const serviceAccount = JSON.parse(fs.readFileSync(env.firebaseServiceAccountPath, 'utf8'));
    messaging = getMessaging(initializeApp({ credential: cert(serviceAccount) }, 'agrovalor-push'));
  } catch (err) {
    initFailed = true;
    logger.error(`No se pudo iniciar Firebase para notificaciones push: ${err.message}`);
  }
  return messaging;
}

/**
 * Manda la notificación a todos los teléfonos del usuario.
 * @param {number} userId
 * @param {{title: string, body: string, data?: Record<string, string>}} message
 * @returns {Promise<{status: 'sent'|'queued'|'failed', error?: string}>}
 */
async function sendToUser(userId, { title, body, data = {} }) {
  const tokens = pushDeviceRepository.tokensForUser(userId);
  if (tokens.length === 0) {
    return { status: 'failed', error: 'No hay teléfonos con la app registrados' };
  }

  const client = getMessagingClient();
  if (!client) {
    return { status: 'queued', error: 'Notificaciones push no configuradas en el servidor' };
  }

  try {
    const res = await client.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data,
      android: { priority: 'high', notification: { channelId: 'price_alerts' } },
    });

    const dead = res.responses
      .map((r, i) => (!r.success && r.error && DEAD_TOKEN_ERRORS.has(r.error.code) ? tokens[i] : null))
      .filter(Boolean);
    if (dead.length) pushDeviceRepository.removeTokens(dead);

    if (res.successCount > 0) return { status: 'sent' };
    const firstError = res.responses.find((r) => r.error);
    return { status: 'failed', error: firstError ? firstError.error.message : 'No se pudo entregar' };
  } catch (err) {
    logger.error(`Error enviando notificación push: ${err.message}`);
    return { status: 'failed', error: err.message };
  }
}

module.exports = { isConfigured, sendToUser };
