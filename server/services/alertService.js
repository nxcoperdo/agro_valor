const alertRepository = require('../repositories/alertRepository');
const cooperativeService = require('./cooperativeService');
const forecastService = require('./forecastService');
const exchangeRateService = require('./exchangeRateService');
const coffeePriceService = require('./coffeePriceService');
const cocoaReferenceService = require('./cocoaReferenceService');
const whatsappService = require('./whatsappService');
const pushService = require('./pushService');
const pushDeviceRepository = require('../repositories/pushDeviceRepository');
const subscriptionService = require('./subscriptionService');
const env = require('../config/env');
const { getMarket, cocoaUsdPerTonneToCopKg } = require('../config/markets');
const { toEpoch } = require('../utils/datetime');
const logger = require('../utils/logger');

/**
 * Sin dato de cooperativas / pronóstico para alguna variable de la plantilla: Meta
 * exige un número fijo de variables por plantilla, así que no se puede omitir el
 * bloque como hacía el texto libre — se rellena con este texto en su lugar.
 */
const NO_DATA = 'Sin datos suficientes por ahora.';

/** Tiempo mínimo entre dos avisos de la misma alerta, para no volverse spam. */
const COOLDOWN_MS = 12 * 60 * 60 * 1000;

function formatCop(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(
    value
  );
}

function buildMarketSnapshot() {
  const comparison = cooperativeService.getComparison();
  if (!comparison.fncReference) return null;

  const best = comparison.cooperatives[0] || null;
  const exchangeRate = exchangeRateService.getCurrentRate();
  const currentPrice = coffeePriceService.getCurrentPrice();

  return {
    referencePrice: comparison.fncReference.priceCopCarga,
    isStale: comparison.fncReference.isStale,
    best,
    exchangeRate: exchangeRate ? exchangeRate.rate : null,
    currentCents: currentPrice ? currentPrice.price : null,
  };
}

function bestPriceLine(best) {
  if (!best) return NO_DATA;
  return (
    `Mejor precio ahora: ${best.name} — ${formatCop(best.estimatedPriceCopCarga)}` +
    (best.priceSource === 'reported' ? ' (reportado por caficultores)' : ' (estimado)')
  );
}

/**
 * Plantilla "agrovalor_alerta_precio": el precio cruzó la meta que puso el usuario.
 * 4 variables fijas — ver server/config/env.js para el nombre real de la plantilla.
 */
function buildThresholdMessage(alert, snapshot) {
  const direction = alert.type === 'above' ? 'subió por encima de' : 'bajó por debajo de';
  const params = [direction, formatCop(alert.threshold_cop_carga), formatCop(snapshot.referencePrice), bestPriceLine(snapshot.best)];

  // Mismo texto de la plantilla aprobada en Meta (categoría Utilidad): se redactó como
  // aviso de algo que el usuario configuró, porque la versión anterior Meta la clasificaba
  // como Marketing.
  const text = [
    'Se cumplió la alerta de precio que configuraste en tu cuenta de AgroValor.',
    '',
    `Condición de tu alerta: el precio del café ${params[0]} ${params[1]} por carga.`,
    '',
    `Precio de referencia registrado hoy: ${params[2]} por carga de 125 kg.`,
    '',
    `Detalle de tu comparación de cooperativas: ${params[3]}`,
    '',
    'Recibes este mensaje porque creaste esta alerta. Puedes editarla o eliminarla desde tu cuenta.',
  ].join('\n');

  const push = {
    title: `☕ El café ${alert.type === 'above' ? 'subió' : 'bajó'} de ${params[1]}`,
    body: `Referencia hoy: ${params[2]} por carga. ${params[3]}`,
  };

  return { text, templateName: env.whatsappTemplateAlert, params, push };
}

/**
 * Plantilla "agrovalor_resumen_mercado": resumen diario/semanal con pronóstico.
 * 5 variables fijas — mañana/semana/mes siempre van, con NO_DATA si falta el dato.
 */
async function buildDigestMessage(snapshot) {
  const referenceLine = snapshot.isStale
    ? `${formatCop(snapshot.referencePrice)} (último dato disponible; la fuente no se ha actualizado hoy)`
    : formatCop(snapshot.referencePrice);

  const forecasts = await forecastService.getForecast();
  // El digest es un mensaje corto: solo el primer paso de cada granularidad
  // (mañana, la semana que viene, el mes que viene), no las 28 filas completas.
  // Se muestra el rango (no solo el precio central) para no sugerir una certeza que no existe.
  const highlightLine = (granularity) => {
    const row = forecasts.find((f) => f.granularity === granularity && f.step === 1);
    if (!row || !snapshot.currentCents) return NO_DATA;

    const impliedFor = (centsPerLb) => snapshot.referencePrice * (centsPerLb / snapshot.currentCents);
    const changePct = ((row.predictedPrice - snapshot.currentCents) / snapshot.currentCents) * 100;
    const implied = impliedFor(row.predictedPrice);
    const arrow = changePct >= 0 ? '▲' : '▼';
    const center = `${arrow} ${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}% → ${formatCop(implied)} por carga`;

    if (row.lowPrice == null || row.highPrice == null) return center;
    return `${center} (rango probable: ${formatCop(impliedFor(row.lowPrice))} a ${formatCop(impliedFor(row.highPrice))})`;
  };

  const params = [referenceLine, bestPriceLine(snapshot.best), highlightLine('day'), highlightLine('week'), highlightLine('month')];

  const text = [
    'Este es el resumen del mercado que programaste en tu cuenta de AgroValor.',
    '',
    `Precio de referencia registrado: ${params[0]} por carga de 125 kg.`,
    '',
    `Detalle de tu comparación de cooperativas: ${params[1]}`,
    '',
    'Proyección del mercado internacional:',
    `• Mañana: ${params[2]}`,
    `• En una semana: ${params[3]}`,
    `• En un mes: ${params[4]}`,
    '',
    'Es una estimación, no una garantía de precio de compra. Recibes este mensaje porque activaste el resumen; puedes desactivarlo desde tu cuenta.',
  ].join('\n');

  const push = {
    title: '☕ Resumen del mercado',
    body: `Referencia: ${params[0]} por carga. Mañana: ${params[2]}`,
  };

  return { text, templateName: env.whatsappTemplateDigest, params, push };
}

/**
 * Plantilla "agrovalor_bienvenida": confirma que el número quedó conectado.
 * 2 variables fijas.
 */
function buildWelcomeMessage(snapshot) {
  const params = [snapshot ? formatCop(snapshot.referencePrice) : 'no disponible en este momento', bestPriceLine(snapshot && snapshot.best)];

  const text = [
    'Tu número quedó conectado a tu cuenta de AgroValor. Por aquí te llegarán las alertas de precio que configures.',
    '',
    `Precio de referencia registrado hoy: ${params[0]} por carga de 125 kg.`,
    '',
    `Detalle de tu comparación de cooperativas: ${params[1]}`,
    '',
    'Puedes desactivar estos mensajes cuando quieras desde tu cuenta.',
  ].join('\n');

  const push = {
    title: '☕ AgroValor',
    body: `Las notificaciones quedaron activas. Referencia hoy: ${params[0]} por carga.`,
  };

  return { text, templateName: env.whatsappTemplateWelcome, params, push };
}

/** Canales por los que le puede llegar algo a este usuario, según sus preferencias y lo que tenga registrado. */
function channelsFor({ userId, phone, notifyWhatsapp, notifyPush, deviceCount }) {
  const channels = [];
  if (notifyWhatsapp && phone) channels.push('whatsapp');
  if (notifyPush && (deviceCount ?? pushDeviceRepository.countForUser(userId)) > 0) channels.push('push');
  return channels;
}

/** Manda el mensaje por cada canal disponible y deja registro de cada envío. */
async function sendOnChannels({ alertId = null, userId, phone, channels, built }) {
  const results = [];

  for (const channel of channels) {
    const result =
      channel === 'whatsapp'
        ? await whatsappService.sendTemplateMessage(phone, built.templateName, built.params)
        : await pushService.sendToUser(userId, { ...built.push, data: { type: 'price_alert' } });

    alertRepository.logDelivery({
      alertId,
      userId,
      phone: channel === 'whatsapp' ? phone : 'app',
      message: channel === 'whatsapp' ? built.text : `${built.push.title} — ${built.push.body}`,
      status: result.status,
      error: result.error || null,
      channel,
    });
    results.push({ channel, ...result });
  }

  // Basta con que llegue por un canal para darla por avisada.
  const sent = results.some((r) => r.status === 'sent');
  return { status: sent ? 'sent' : results[0]?.status || 'failed', results };
}

async function deliver(alert, built) {
  const allChannels = channelsFor({
    userId: alert.user_id,
    phone: alert.phone,
    notifyWhatsapp: Boolean(alert.notify_whatsapp),
    notifyPush: Boolean(alert.notify_push),
    deviceCount: alert.device_count,
  });
  // Las plantillas de WhatsApp aprobadas en Meta son de café: el cacao avisa solo por la app.
  const channels = built.pushOnly ? allChannels.filter((c) => c === 'push') : allChannels;

  const result = await sendOnChannels({ alertId: alert.id, userId: alert.user_id, phone: alert.phone, channels, built });

  if (result.status === 'sent') {
    alertRepository.markTriggered(alert.id);
  }

  return result;
}

function isEligible(alert) {
  return subscriptionService.isPro({
    role: alert.role,
    plan: alert.plan,
    plan_expires_at: alert.plan_expires_at,
  });
}

function inCooldown(alert) {
  if (!alert.last_triggered_at) return false;
  return Date.now() - toEpoch(alert.last_triggered_at) < COOLDOWN_MS;
}

/**
 * Cacao: el precio de referencia es el semanal de Agronet (lo mismo que ve el usuario en el
 * panel). Si todavía no hay dato de Agronet, se usa la cotización ICE convertida con la TRM.
 */
function buildCocoaSnapshot() {
  const reference = cocoaReferenceService.getLatest();
  if (reference && !reference.isStale) return { referencePrice: reference.priceCopKg, source: 'agronet' };

  const price = coffeePriceService.getCurrentPrice('cocoa');
  const rate = exchangeRateService.getCurrentRate();
  if (!price || !rate) return null;
  return { referencePrice: cocoaUsdPerTonneToCopKg(price.price, rate.rate), source: 'ice' };
}

function buildCocoaThresholdMessage(alert, snapshot) {
  const direction = alert.type === 'above' ? 'subió por encima de' : 'bajó por debajo de';
  const threshold = formatCop(alert.threshold_cop_carga);
  const now = formatCop(snapshot.referencePrice);
  return {
    pushOnly: true,
    text: `Se cumplió tu alerta de cacao: el precio ${direction} ${threshold} por kilo. Referencia hoy: ${now} por kilo.`,
    push: {
      title: `🍫 El cacao ${alert.type === 'above' ? 'subió' : 'bajó'} de ${threshold}/kg`,
      body:
        snapshot.source === 'agronet'
          ? `Referencia semanal de la industria (Agronet): ${now} por kilo.`
          : `Referencia internacional hoy: ${now} por kilo (ICE convertido con la TRM).`,
    },
  };
}

async function evaluateCocoaAlerts() {
  const snapshot = buildCocoaSnapshot();
  if (!snapshot) return { evaluated: 0, sent: 0 };

  const alerts = alertRepository.findActiveByTypes(['above', 'below'], getMarket('cocoa').id);
  let sent = 0;

  for (const alert of alerts) {
    if (!isEligible(alert) || inCooldown(alert)) continue;
    const crossed =
      alert.type === 'above'
        ? snapshot.referencePrice >= alert.threshold_cop_carga
        : snapshot.referencePrice <= alert.threshold_cop_carga;
    if (!crossed) continue;

    const result = await deliver(alert, buildCocoaThresholdMessage(alert, snapshot));
    if (result.status === 'sent') sent += 1;
  }

  if (sent > 0) logger.info(`Alertas de cacao enviadas: ${sent}`);
  return { evaluated: alerts.length, sent };
}

/** Revisa las alertas de umbral contra el precio actual. La corre el cron de precios. */
async function evaluateThresholdAlerts() {
  // El cacao se evalúa aparte: que falle no debe frenar las alertas de café.
  evaluateCocoaAlerts().catch((err) => logger.error('Alertas de cacao:', err));

  const snapshot = buildMarketSnapshot();
  if (!snapshot) return { evaluated: 0, sent: 0 };

  const alerts = alertRepository.findActiveByTypes(['above', 'below']);
  let sent = 0;

  for (const alert of alerts) {
    if (!isEligible(alert) || inCooldown(alert)) continue;

    const crossed =
      alert.type === 'above'
        ? snapshot.referencePrice >= alert.threshold_cop_carga
        : snapshot.referencePrice <= alert.threshold_cop_carga;

    if (!crossed) continue;

    const result = await deliver(alert, buildThresholdMessage(alert, snapshot));
    if (result.status === 'sent') sent += 1;
  }

  if (sent > 0) logger.info(`Alertas de precio enviadas: ${sent}`);
  return { evaluated: alerts.length, sent };
}

/** Envía los resúmenes programados (diario o semanal). */
async function sendDigests(type) {
  const snapshot = buildMarketSnapshot();
  if (!snapshot) return { evaluated: 0, sent: 0 };

  const alerts = alertRepository.findActiveByTypes([type]);
  const built = await buildDigestMessage(snapshot);
  let sent = 0;

  for (const alert of alerts) {
    if (!isEligible(alert)) continue;
    const result = await deliver(alert, built);
    if (result.status === 'sent') sent += 1;
  }

  if (sent > 0) logger.info(`Resúmenes ${type} enviados: ${sent}`);
  return { evaluated: alerts.length, sent };
}

/** Mensaje de prueba por cada canal activo, para que el usuario confirme que le llega. */
async function sendTestMessage(user) {
  const channels = channelsFor({
    userId: user.id,
    phone: user.phone,
    notifyWhatsapp: Boolean(user.notify_whatsapp),
    notifyPush: Boolean(user.notify_push),
  });

  return sendOnChannels({ userId: user.id, phone: user.phone, channels, built: buildWelcomeMessage(buildMarketSnapshot()) });
}

module.exports = { evaluateThresholdAlerts, sendDigests, sendTestMessage, channelsFor };
