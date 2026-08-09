const alertRepository = require('../repositories/alertRepository');
const cooperativeService = require('./cooperativeService');
const forecastService = require('./forecastService');
const exchangeRateService = require('./exchangeRateService');
const coffeePriceService = require('./coffeePriceService');
const whatsappService = require('./whatsappService');
const subscriptionService = require('./subscriptionService');
const { toEpoch } = require('../utils/datetime');
const logger = require('../utils/logger');

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

function buildThresholdMessage(alert, snapshot) {
  const direction = alert.type === 'above' ? 'subió por encima de' : 'bajó por debajo de';
  const lines = [
    '☕ *AgroValor*',
    '',
    `El precio del café ${direction} tu meta de ${formatCop(alert.threshold_cop_carga)}.`,
    '',
    `Precio interno de referencia hoy: *${formatCop(snapshot.referencePrice)}* por carga de 125 kg.`,
  ];

  if (snapshot.best) {
    lines.push(
      '',
      `Mejor precio ahora: ${snapshot.best.name} — ${formatCop(snapshot.best.estimatedPriceCopCarga)}` +
        (snapshot.best.priceSource === 'reported' ? ' (reportado por caficultores)' : ' (estimado)')
    );
  }

  return lines.join('\n');
}

function buildDigestMessage(snapshot, { includeForecast }) {
  const lines = [
    '☕ *AgroValor* — resumen del mercado',
    '',
    `Precio interno de referencia: *${formatCop(snapshot.referencePrice)}* por carga de 125 kg.`,
  ];

  if (snapshot.isStale) {
    lines.push('_(último dato disponible; la fuente no se ha actualizado hoy)_');
  }

  if (snapshot.best) {
    lines.push(
      '',
      `Quien mejor está pagando: ${snapshot.best.name} — ${formatCop(snapshot.best.estimatedPriceCopCarga)}`
    );
  }

  if (includeForecast) {
    const forecasts = forecastService.getForecast();

    if (forecasts.length && snapshot.currentCents) {
      lines.push('', '*Proyección del mercado internacional:*');
      const labels = { '1d': 'Mañana', '7d': 'En una semana', '30d': 'En un mes' };

      forecasts.forEach((f) => {
        const changePct = ((f.predictedPrice - snapshot.currentCents) / snapshot.currentCents) * 100;
        const implied = snapshot.referencePrice * (1 + changePct / 100);
        const arrow = changePct >= 0 ? '▲' : '▼';
        lines.push(
          `• ${labels[f.horizon] || f.horizon}: ${arrow} ${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%` +
            ` → ${formatCop(implied)} por carga`
        );
      });

      lines.push(
        '',
        '_Supone que el precio interno se mueve igual que el mercado internacional._',
        '_Es una estimación, no una garantía de precio de compra._'
      );
    }
  }

  return lines.join('\n');
}

async function deliver(alert, message) {
  const result = await whatsappService.sendMessage(alert.phone, message);

  alertRepository.logDelivery({
    alertId: alert.id,
    userId: alert.user_id,
    phone: alert.phone,
    message,
    status: result.status,
    error: result.error || null,
  });

  if (result.status === 'sent') {
    alertRepository.markTriggered(alert.id);
  }

  return result;
}

function isEligible(alert) {
  return subscriptionService.isPro({
    role: 'user',
    plan: alert.plan,
    plan_expires_at: alert.plan_expires_at,
  });
}

function inCooldown(alert) {
  if (!alert.last_triggered_at) return false;
  return Date.now() - toEpoch(alert.last_triggered_at) < COOLDOWN_MS;
}

/** Revisa las alertas de umbral contra el precio actual. La corre el cron de precios. */
async function evaluateThresholdAlerts() {
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
  const message = buildDigestMessage(snapshot, { includeForecast: true });
  let sent = 0;

  for (const alert of alerts) {
    if (!isEligible(alert)) continue;
    const result = await deliver(alert, message);
    if (result.status === 'sent') sent += 1;
  }

  if (sent > 0) logger.info(`Resúmenes ${type} enviados: ${sent}`);
  return { evaluated: alerts.length, sent };
}

/** Mensaje de prueba, para que el usuario confirme que su número quedó bien. */
async function sendTestMessage(user) {
  const snapshot = buildMarketSnapshot();
  const message = snapshot
    ? buildDigestMessage(snapshot, { includeForecast: false })
    : '☕ *AgroValor*\n\nTu número quedó conectado. Aquí te llegarán tus alertas de precio.';

  const result = await whatsappService.sendMessage(user.phone, message);

  alertRepository.logDelivery({
    userId: user.id,
    phone: user.phone,
    message,
    status: result.status,
    error: result.error || null,
  });

  return result;
}

module.exports = { evaluateThresholdAlerts, sendDigests, sendTestMessage };
