const exchangeRateRepository = require('../repositories/exchangeRateRepository');
const twelveDataFxProvider = require('./providers/twelveDataFxProvider');
const alphaVantageFxProvider = require('./providers/alphaVantageFxProvider');
const simulatedFxProvider = require('./providers/simulatedFxProvider');
const logger = require('../utils/logger');

const REAL_PROVIDERS = [twelveDataFxProvider, alphaVantageFxProvider];

async function refreshRate() {
  for (const provider of REAL_PROVIDERS) {
    if (!provider.isConfigured()) continue;

    try {
      const result = await provider.fetchLatestRate();
      const saved = exchangeRateRepository.insert({ ...result, source: 'real' });
      logger.info(`Tasa USD/COP real obtenida vía ${provider.name}: ${result.rate}`);
      return saved;
    } catch (err) {
      logger.warn(`Proveedor FX ${provider.name} falló: ${err.message}`);
    }
  }

  const last = exchangeRateRepository.latest();
  const simulated = simulatedFxProvider.fetchLatestRate(last ? last.rate : undefined);
  const saved = exchangeRateRepository.insert({ ...simulated, source: 'simulated' });
  logger.info(`Tasa USD/COP simulada generada: ${simulated.rate.toFixed(2)}`);
  return saved;
}

function getCurrentRate() {
  return exchangeRateRepository.latest();
}

module.exports = { refreshRate, getCurrentRate };
