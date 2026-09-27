const crypto = require('crypto');
const env = require('../config/env');
const fetchWithTimeout = require('../utils/fetchWithTimeout');
const logger = require('../utils/logger');

/**
 * Cliente delgado sobre la API de Mercado Pago (Suscripciones / Preapproval). Igual que
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
 * Suscripción sin plan asociado, con pago autorizado: se crea una vez y Mercado Pago
 * cobra automáticamente cada mes por su cuenta, sin que este server tenga que guardar
 * ni volver a cobrar la tarjeta.
 */
async function createPreapproval({ userId, payerEmail, reason }) {
  const data = await request('POST', '/preapproval', {
    reason: reason || 'AgroValor Pro',
    external_reference: String(userId),
    payer_email: payerEmail,
    back_url: env.mpBackUrl,
    status: 'pending',
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: env.mpProAmountCop,
      currency_id: 'COP',
    },
  });

  return { id: data.id, initPoint: data.init_point, status: data.status };
}

async function getPreapproval(id) {
  const data = await request('GET', `/preapproval/${id}`);
  return { id: data.id, status: data.status, payerEmail: data.payer_email };
}

/** Cancela la suscripción: Mercado Pago deja de cobrar desde el próximo mes. No se puede reactivar. */
async function cancelPreapproval(id) {
  const data = await request('PUT', `/preapproval/${id}`, { status: 'cancelled' });
  return { id: data.id, status: data.status };
}

/** Cobros ya hechos de una suscripción — el *poll* de reconciliación mientras no haya HTTPS para el webhook. */
async function searchAuthorizedPayments(preapprovalId) {
  const data = await request('GET', `/authorized_payments/search?preapproval_id=${preapprovalId}`);
  return (data.results || []).map((p) => ({
    id: String(p.id),
    status: p.status,
    amount: p.transaction_amount,
    date: p.date_created,
  }));
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

module.exports = { isConfigured, createPreapproval, getPreapproval, cancelPreapproval, searchAuthorizedPayments, verifyWebhookSignature };
