const fs = require('fs');
const { google } = require('googleapis');
const env = require('../config/env');
const logger = require('../utils/logger');

/**
 * Verificación de compras de Google Play Billing (Android Publisher API v3, Subscriptions v2).
 * Si no hay cuenta de servicio configurada, se comporta como whatsappService sin credenciales:
 * el resto de la app sigue funcionando, solo esta pieza queda inactiva.
 */

let cachedClient = null;

function isConfigured() {
  return Boolean(env.googlePlayServiceAccountPath) && fs.existsSync(env.googlePlayServiceAccountPath);
}

function getClient() {
  if (cachedClient) return cachedClient;

  const auth = new google.auth.GoogleAuth({
    keyFile: env.googlePlayServiceAccountPath,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });

  cachedClient = google.androidpublisher({ version: 'v3', auth });
  return cachedClient;
}

/** Notification types del payload de RTDN (subscriptionNotification.notificationType). */
const NOTIFICATION_TYPES = {
  1: 'RECOVERED',
  2: 'RENEWED',
  3: 'CANCELED',
  4: 'PURCHASED',
  5: 'ON_HOLD',
  6: 'IN_GRACE_PERIOD',
  7: 'RESTARTED',
  8: 'PRICE_CHANGE_CONFIRMED',
  9: 'DEFERRED',
  12: 'REVOKED',
  13: 'EXPIRED',
};

/**
 * @param {string} purchaseToken
 * @returns {Promise<{active: boolean, expiryTimeIso: string|null, productId: string|null}>}
 */
async function verifySubscription(purchaseToken) {
  if (!isConfigured()) {
    throw Object.assign(new Error('Google Play Billing no está configurado en el servidor'), { status: 503 });
  }

  const client = getClient();
  const res = await client.purchases.subscriptionsv2.get({
    packageName: env.googlePlayPackageName,
    token: purchaseToken,
  });

  const data = res.data || {};
  const lineItem = (data.lineItems || [])[0] || {};
  const state = data.subscriptionState;
  const active = state === 'SUBSCRIPTION_STATE_ACTIVE' || state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD';

  return {
    active,
    expiryTimeIso: lineItem.expiryTime || null,
    productId: lineItem.productId || null,
  };
}

module.exports = { isConfigured, verifySubscription, getClient, NOTIFICATION_TYPES };
