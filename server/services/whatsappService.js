const env = require('../config/env');
const fetchWithTimeout = require('../utils/fetchWithTimeout');
const logger = require('../utils/logger');

/**
 * Envío de mensajes por WhatsApp delegado al proyecto de envío masivo que ya corre
 * en el mismo servidor. AgroValor no habla con WhatsApp directamente: le hace un
 * POST al otro servicio, así que una sola sesión de WhatsApp sirve para ambos.
 *
 * Contrato esperado en WHATSAPP_API_URL:
 *   POST { "to": "573001234567", "message": "texto" }
 *   Respuesta 2xx = enviado. Si se configura WHATSAPP_API_TOKEN se manda como
 *   cabecera Authorization: Bearer <token>.
 *
 * Si no está configurado, los mensajes se registran como "queued" y no se pierde
 * nada: el resto de la aplicación sigue funcionando igual.
 */

const COLOMBIA_COUNTRY_CODE = '57';

/** Normaliza a formato internacional sin signos: 300 123 4567 -> 573001234567 */
function normalizePhone(raw) {
  if (!raw) return null;

  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith(COLOMBIA_COUNTRY_CODE) && digits.length >= 12) return digits;
  if (digits.length === 10) return `${COLOMBIA_COUNTRY_CODE}${digits}`;

  return digits;
}

function isConfigured() {
  return Boolean(env.whatsappApiUrl);
}

/**
 * @returns {Promise<{status: 'sent'|'queued'|'failed', error?: string}>}
 */
async function sendMessage(phone, message) {
  const to = normalizePhone(phone);

  if (!to) {
    return { status: 'failed', error: 'Número de teléfono inválido' };
  }

  if (!isConfigured()) {
    logger.warn(`WhatsApp no configurado (falta WHATSAPP_API_URL). Mensaje en cola para ${to}: ${message.slice(0, 80)}…`);
    return { status: 'queued', error: 'Servicio de WhatsApp no configurado' };
  }

  try {
    const res = await fetchWithTimeout(
      env.whatsappApiUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(env.whatsappApiToken ? { Authorization: `Bearer ${env.whatsappApiToken}` } : {}),
        },
        body: JSON.stringify({ to, message }),
      },
      12000
    );

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${body.slice(0, 120)}`);
    }

    return { status: 'sent' };
  } catch (err) {
    const cause = err.cause ? ` — ${err.cause.code || err.cause.message}` : '';
    logger.warn(`WhatsApp: no se pudo enviar a ${to} (${err.message}${cause})`);
    return { status: 'failed', error: `${err.message}${cause}` };
  }
}

module.exports = { sendMessage, normalizePhone, isConfigured };
