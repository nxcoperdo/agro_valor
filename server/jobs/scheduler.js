const cron = require('node-cron');
const env = require('../config/env');
const coffeePriceService = require('../services/coffeePriceService');
const exchangeRateService = require('../services/exchangeRateService');
const fncScraperService = require('../services/fncScraperService');
const forecastService = require('../services/forecastService');
const alertService = require('../services/alertService');
const logger = require('../utils/logger');

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
  cron.schedule(env.priceRefreshCron, async () => {
    await refreshMarketData();
    // Las alertas de umbral se evalúan con el precio recién actualizado.
    alertService.evaluateThresholdAlerts().catch((err) => logger.error('Cron alertas de umbral:', err));
  });

  cron.schedule(env.fncReferenceCron, () => {
    fncScraperService
      .refresh()
      .then(() => alertService.evaluateThresholdAlerts())
      .catch((err) => logger.error('Cron FNC:', err));
  });

  cron.schedule(env.forecastRefreshCron, () => {
    try {
      forecastService.recomputeAndCache();
    } catch (err) {
      logger.error('Cron proyección:', err);
    }
  });

  cron.schedule(env.dailyDigestCron, () => {
    alertService.sendDigests('daily').catch((err) => logger.error('Cron resumen diario:', err));
  });

  cron.schedule(env.weeklyDigestCron, () => {
    alertService.sendDigests('weekly').catch((err) => logger.error('Cron resumen semanal:', err));
  });

  logger.info('Jobs programados iniciados.');
}

module.exports = { start, runOnStartup };
