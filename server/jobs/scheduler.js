const cron = require('node-cron');
const env = require('../config/env');
const coffeePriceService = require('../services/coffeePriceService');
const exchangeRateService = require('../services/exchangeRateService');
const fncScraperService = require('../services/fncScraperService');
const forecastService = require('../services/forecastService');
const logger = require('../utils/logger');

async function runOnStartup() {
  try {
    await Promise.all([coffeePriceService.refreshPrice(), exchangeRateService.refreshRate()]);
  } catch (err) {
    logger.error('Error refrescando precio de café / tasa de cambio al arrancar:', err);
  }

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
  cron.schedule(env.priceRefreshCron, () => {
    coffeePriceService.refreshPrice().catch((err) => logger.error('Cron precio café:', err));
    exchangeRateService.refreshRate().catch((err) => logger.error('Cron tasa de cambio:', err));
  });

  cron.schedule(env.fncReferenceCron, () => {
    fncScraperService.refresh().catch((err) => logger.error('Cron FNC:', err));
  });

  cron.schedule(env.forecastRefreshCron, () => {
    try {
      forecastService.recomputeAndCache();
    } catch (err) {
      logger.error('Cron proyección:', err);
    }
  });

  logger.info('Jobs programados iniciados.');
}

module.exports = { start, runOnStartup };
