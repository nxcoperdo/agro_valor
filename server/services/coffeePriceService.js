const coffeePriceRepository = require('../repositories/coffeePriceRepository');
const yahooFinanceProvider = require('./providers/yahooFinanceProvider');
const twelveDataProvider = require('./providers/twelveDataProvider');
const alphaVantageProvider = require('./providers/alphaVantageProvider');
const simulatedProvider = require('./providers/simulatedProvider');
const logger = require('../utils/logger');
const { getMarket } = require('../config/markets');

/**
 * Orden deliberado: primero la fuente con el dato más fresco.
 *  - yahoo: cotización del contrato de café en ICE, diferida unos minutos.
 *  - twelvedata: intradía, pero los futuros de commodities no vienen en el plan gratuito.
 *  - alphavantage: solo promedio MENSUAL, sirve de último respaldo real.
 */
const REAL_PROVIDERS = [yahooFinanceProvider, twelveDataProvider, alphaVantageProvider];

/** Con qué frecuencia se mueve realmente el dato de cada fuente. Se muestra al usuario. */
const GRANULARITY = {
  yahoo: 'intradiario',
  twelvedata: 'intradiario',
  alphavantage: 'mensual',
};

/**
 * Fuera del horario de la bolsa —y entre operación y operación— el proveedor devuelve
 * exactamente la misma cotización. Guardar una fila idéntica cada pocos minutos
 * inflaría la base y ensuciaría la serie del modelo, así que solo se registra cuando
 * el dato realmente cambió; si no, se actualiza la hora de consulta.
 */
function isSameQuote(previous, result) {
  if (!previous || previous.source !== 'real') return false;
  if (previous.provider !== result.provider) return false;

  if (result.quotedAt && previous.quoted_at) {
    return new Date(previous.quoted_at).getTime() === new Date(result.quotedAt).getTime();
  }

  return previous.price === result.price;
}

async function refreshPrice(marketId = 'coffee') {
  const market = getMarket(marketId);

  for (const provider of REAL_PROVIDERS) {
    // Solo los proveedores con datos reales de este producto (twelvedata/alphavantage son de café).
    if (!market.providers.includes(provider.name)) continue;
    if (!provider.isConfigured()) continue;

    try {
      const result = await provider.fetchLatestPrice(market);
      const previous = coffeePriceRepository.latest(market.id);

      if (isSameQuote(previous, result)) {
        return coffeePriceRepository.touch(previous.id);
      }

      const saved = coffeePriceRepository.insert({ ...result, source: 'real', market: market.id });
      logger.info(`Precio de ${market.name.toLowerCase()} real obtenido vía ${provider.name}: ${result.price} ${market.unit}`);
      return saved;
    } catch (err) {
      logger.warn(`Proveedor ${provider.name} (${market.id}) falló: ${err.message}`);
    }
  }

  const last = coffeePriceRepository.latest(market.id);
  const simulated = simulatedProvider.fetchLatestPrice(last ? last.price : undefined, market);
  const saved = coffeePriceRepository.insert({ ...simulated, source: 'simulated', market: market.id });
  logger.info(`Precio de ${market.name.toLowerCase()} simulado generado: ${simulated.price.toFixed(4)}`);
  return saved;
}

function getCurrentPrice(marketId = 'coffee') {
  return coffeePriceRepository.latest(getMarket(marketId).id);
}

function getHistory(days = 30, marketId = 'coffee') {
  return coffeePriceRepository.history(days, getMarket(marketId).id);
}

function granularityFor(provider) {
  return GRANULARITY[provider] || null;
}

module.exports = { refreshPrice, getCurrentPrice, getHistory, granularityFor };
