const cron = require('node-cron');
const env = require('../config/env');
const coffeePriceService = require('../services/coffeePriceService');
const exchangeRateService = require('../services/exchangeRateService');
const fncScraperService = require('../services/fncScraperService');
const cocoaReferenceService = require('../services/cocoaReferenceService');
const priceHistoryBackfillService = require('../services/priceHistoryBackfillService');
const forecastService = require('../services/forecastService');
const alertService = require('../services/alertService');
const mercadoPagoBillingService = require('../services/mercadoPagoBillingService');
const logger = require('../utils/logger');
const { listMarkets } = require('../config/markets');

/**
 * Todos los horarios se interpretan en la zona horaria de la aplicación
 * (Colombia por defecto). Sin esto, un cron como "0 6 * * *" se dispararía a las
 * 6 de la mañana del reloj del servidor: si el VPS está en UTC, al caficultor le
 * llegaría el resumen a la 1 de la madrugada.
 */
const CRON_OPTIONS = { timezone: env.timezone };

async function refreshMarketData() {
  try {
    // Cada mercado se refresca por separado: que falle el cacao no debe frenar el café.
    await Promise.all([
      ...listMarkets().map((m) =>
        coffeePriceService.refreshPrice(m.id).catch((err) => logger.error(`Error refrescando precio de ${m.id}:`, err))
      ),
      exchangeRateService.refreshRate(),
    ]);
  } catch (err) {
    logger.error('Error refrescando precio de café / tasa de cambio:', err);
  }
}

async function runOnStartup() {
  await refreshMarketData();

  try {
    await fncScraperService.refresh();
  } catch (err) {
    logger.error('Error refrescando precio FNC al arrancar:', err);
  }

  await cocoaReferenceService.refresh();
  // Un mercado nuevo arranca sin histórico: se completa una vez para que la gráfica no salga vacía.
  await priceHistoryBackfillService.backfill('cocoa');

  try {
    await forecastService.recomputeAllMarkets();
  } catch (err) {
    logger.error('Error recalculando proyección al arrancar:', err);
  }
}

function start() {
  cron.schedule(
    env.priceRefreshCron,
    async () => {
      await refreshMarketData();
      // Las alertas de umbral se evalúan con el precio recién actualizado.
      alertService.evaluateThresholdAlerts().catch((err) => logger.error('Cron alertas de umbral:', err));
    },
    CRON_OPTIONS
  );

  cron.schedule(
    env.fncReferenceCron,
    () => {
      fncScraperService
        .refresh()
        .then(() => alertService.evaluateThresholdAlerts())
        .catch((err) => logger.error('Cron FNC:', err));
    },
    CRON_OPTIONS
  );

  cron.schedule(
    env.cocoaReferenceCron,
    () => {
      cocoaReferenceService
        .refresh()
        .then(() => alertService.evaluateThresholdAlerts())
        .catch((err) => logger.error('Cron referencia de cacao:', err));
    },
    CRON_OPTIONS
  );

  cron.schedule(
    env.forecastRefreshCron,
    () => {
      forecastService.recomputeAllMarkets().catch((err) => logger.error('Cron proyección:', err));
    },
    CRON_OPTIONS
  );

  cron.schedule(
    env.dailyDigestCron,
    () => {
      alertService.sendDigests('daily').catch((err) => logger.error('Cron resumen diario:', err));
    },
    CRON_OPTIONS
  );

  cron.schedule(
    env.weeklyDigestCron,
    () => {
      alertService.sendDigests('weekly').catch((err) => logger.error('Cron resumen semanal:', err));
    },
    CRON_OPTIONS
  );

  // Respaldo del webhook de Mercado Pago: revisa si un pago que quedó "pending" ya se aprobó.
  cron.schedule(
    env.mpPollCron,
    () => {
      mercadoPagoBillingService.reconcile().catch((err) => logger.error('Cron Mercado Pago:', err));
    },
    CRON_OPTIONS
  );

  logger.info(`Jobs programados iniciados (zona horaria: ${env.timezone}).`);
}

module.exports = { start, runOnStartup };
