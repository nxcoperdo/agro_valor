const coffeePriceRepository = require('../repositories/coffeePriceRepository');
const twelveDataProvider = require('./providers/twelveDataProvider');
const alphaVantageProvider = require('./providers/alphaVantageProvider');
const simulatedProvider = require('./providers/simulatedProvider');
const logger = require('../utils/logger');

const REAL_PROVIDERS = [twelveDataProvider, alphaVantageProvider];

async function refreshPrice() {
  for (const provider of REAL_PROVIDERS) {
    if (!provider.isConfigured()) continue;

    try {
      const result = await provider.fetchLatestPrice();
      const saved = coffeePriceRepository.insert({ ...result, source: 'real' });
      logger.info(`Precio de café real obtenido vía ${provider.name}: ${result.price}`);
      return saved;
    } catch (err) {
      logger.warn(`Proveedor ${provider.name} falló: ${err.message}`);
    }
  }

  const last = coffeePriceRepository.latest();
  const simulated = simulatedProvider.fetchLatestPrice(last ? last.price : undefined);
  const saved = coffeePriceRepository.insert({ ...simulated, source: 'simulated' });
  logger.info(`Precio de café simulado generado: ${simulated.price.toFixed(4)}`);
  return saved;
}

function getCurrentPrice() {
  return coffeePriceRepository.latest();
}

function getHistory(days = 30) {
  return coffeePriceRepository.history(days);
}

module.exports = { refreshPrice, getCurrentPrice, getHistory };
