const cron = require('node-cron');
const env = require('../config/env');
const coffeePriceService = require('../services/coffeePriceService');
const exchangeRateService = require('../services/exchangeRateService');
const fncScraperService = require('../services/fncScraperService');
const forecastService = require('../services/forecastService');
const alertService = require('../services/alertService');
const playBillingService = require('../services/playBillingService');
const logger = require('../utils/logger');

/**
 * Todos los horarios se interpretan en la zona horaria de la aplicación
 * (Colombia por defecto). Sin esto, un cron como "0 6 * * *" se dispararía a las
 * 6 de la mañana del reloj del servidor: si el VPS está en UTC, al caficultor le
 * llegaría el resumen a la 1 de la madrugada.
 */
const CRON_OPTIONS = { timezone: env.timezone };

async function refreshMarketData() {
  try {
    await Promise.all([coffeePriceService.refreshPrice(), exchangeRateService.refreshRate()]);
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

  try {
    forecastService.recomputeAndCache();
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
    env.forecastRefreshCron,
    () => {
      try {
        forecastService.recomputeAndCache();
      } catch (err) {
        logger.error('Cron proyección:', err);
      }
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

  // Notificaciones de Google Play (renovó, canceló, venció): se pregunta cada pocos
  // minutos en vez de recibir un webhook, porque el server todavía no tiene HTTPS.
  cron.schedule(
    env.playNotificationsPullCron,
    () => {
      playBillingService.pullAndProcessNotifications().catch((err) => logger.error('Cron Play Billing:', err));
    },
    CRON_OPTIONS
  );

  logger.info(`Jobs programados iniciados (zona horaria: ${env.timezone}).`);
}

module.exports = { start, runOnStartup };
