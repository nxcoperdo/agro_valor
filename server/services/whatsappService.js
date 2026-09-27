const env = require('../config/env');
const fetchWithTimeout = require('../utils/fetchWithTimeout');
const logger = require('../utils/logger');

/**
 * Envío de mensajes por WhatsApp vía Meta WhatsApp Business Cloud API
 * (https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages).
 *
 * Las alertas de AgroValor las inicia el servidor, no el usuario, así que quedan
 * fuera de la ventana de 24 horas de "conversación abierta" en la que Meta permite
 * texto libre — solo se pueden mandar como *plantillas* ya aprobadas por Meta, con
 * un puñado de variables numeradas ({{1}}, {{2}}...). Por eso no hay un `sendMessage`
 * de texto libre: todo pasa por `sendTemplateMessage`.
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
  return Boolean(env.whatsappPhoneNumberId && env.whatsappAccessToken);
}

/**
 * @param {string} phone
 * @param {string} templateName Nombre exacto de la plantilla aprobada en Meta.
 * @param {string[]} params Valores para las variables {{1}}, {{2}}... del cuerpo, en orden.
 * @param {{copyCode?: string}} [options] copyCode: para plantillas de categoría
 *   Autenticación, que Meta exige con botón "Copiar código" — el código va también en el botón.
 * @returns {Promise<{status: 'sent'|'queued'|'failed', error?: string}>}
 */
async function sendTemplateMessage(phone, templateName, params = [], { copyCode } = {}) {
  const to = normalizePhone(phone);

  if (!to) {
    return { status: 'failed', error: 'Número de teléfono inválido' };
  }

  if (!isConfigured()) {
    logger.warn(
      `WhatsApp no configurado (falta WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_ACCESS_TOKEN). Plantilla "${templateName}" en cola para ${to}.`
    );
    return { status: 'queued', error: 'Servicio de WhatsApp no configurado' };
  }

  const url = `https://graph.facebook.com/${env.whatsappApiVersion}/${env.whatsappPhoneNumberId}/messages`;

  const components = [
    {
      type: 'body',
      parameters: params.map((value) => ({ type: 'text', text: String(value) })),
    },
  ];
  if (copyCode) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: String(copyCode) }],
    });
  }

  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.whatsappAccessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: env.whatsappTemplateLang },
            components,
          },
        }),
      },
      12000
    );

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${body.slice(0, 200)}`);
    }

    return { status: 'sent' };
  } catch (err) {
    const cause = err.cause ? ` — ${err.cause.code || err.cause.message}` : '';
    logger.warn(`WhatsApp: no se pudo enviar plantilla "${templateName}" a ${to} (${err.message}${cause})`);
    return { status: 'failed', error: `${err.message}${cause}` };
  }
}

module.exports = { sendTemplateMessage, normalizePhone, isConfigured };
