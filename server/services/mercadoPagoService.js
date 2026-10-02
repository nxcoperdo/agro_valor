const crypto = require('crypto');
const env = require('../config/env');
const fetchWithTimeout = require('../utils/fetchWithTimeout');
const logger = require('../utils/logger');

/**
 * Cliente delgado sobre la API de Mercado Pago (Checkout Pro / pagos únicos). Igual que
 * whatsappService: si no hay credenciales, isConfigured() da falso y el resto de la app
 * sigue funcionando, solo esta pieza queda inactiva.
 */

const BASE_URL = 'https://api.mercadopago.com';

function isConfigured() {
  return Boolean(env.mpAccessToken);
}

async function request(method, path, body) {
  const res = await fetchWithTimeout(
    `${BASE_URL}${path}`,
    {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.mpAccessToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    },
    12000
  );

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = data.message || `Error ${res.status} de Mercado Pago`;
    throw Object.assign(new Error(message), { status: res.status, mpResponse: data });
  }

  return data;
}

/**
 * Checkout Pro: preferencia de pago único (no recurrente). El usuario paga una vez en
 * el checkout de Mercado Pago y vuelve a back_url; no hay cobro automático después, a
 * diferencia del antiguo modelo de Preapproval (suscripción mensual).
 */
async function createPreference({ userId, payerEmail, reason }) {
  const notificationUrl = `${env.publicBaseUrl}/api/public/webhooks/mercadopago`;

  const data = await request('POST', '/checkout/preferences', {
    items: [
      {
        title: reason || 'AgroValor Pro (1 año)',
        quantity: 1,
        currency_id: 'COP',
        unit_price: env.mpProAnnualAmountCop,
      },
    ],
    payer: { email: payerEmail },
    external_reference: String(userId),
    back_urls: {
      success: env.mpBackUrl,
      pending: env.mpBackUrl,
      failure: env.mpBackUrl,
    },
    auto_return: 'approved',
    notification_url: notificationUrl,
  });

  return { id: data.id, initPoint: data.init_point };
}

/** Pagos de un usuario, el más reciente primero — así se confirma el pago sin depender del webhook. */
async function searchPayments(externalReference) {
  const data = await request(
    'GET',
    `/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}&sort=date_created&criteria=desc`
  );
  return (data.results || []).map((p) => ({
    id: String(p.id),
    status: p.status,
    amount: p.transaction_amount,
    date: p.date_approved || p.date_created,
    externalReference: p.external_reference,
  }));
}

/** Un pago puntual por su id, para cuando llega el webhook con "type": "payment". */
async function getPayment(paymentId) {
  const data = await request('GET', `/v1/payments/${paymentId}`);
  return {
    id: String(data.id),
    status: data.status,
    amount: data.transaction_amount,
    date: data.date_approved || data.date_created,
    externalReference: data.external_reference,
  };
}

/** Firma HMAC-SHA256 de los webhooks (header x-signature: "ts=...,v1=..."). */
function verifyWebhookSignature(xSignatureHeader, xRequestIdHeader, dataId) {
  if (!xSignatureHeader || !env.mpWebhookSecret) return false;

  const parts = Object.fromEntries(
    xSignatureHeader.split(',').map((part) => part.trim().split('=').map((s) => s.trim()))
  );
  const { ts, v1 } = parts;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${xRequestIdHeader};ts:${ts};`;
  const hash = crypto.createHmac('sha256', env.mpWebhookSecret).update(manifest).digest('hex');

  return hash === v1;
}

module.exports = { isConfigured, createPreference, searchPayments, getPayment, verifyWebhookSignature };
