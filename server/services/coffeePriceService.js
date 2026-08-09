const coffeePriceRepository = require('../repositories/coffeePriceRepository');
const yahooFinanceProvider = require('./providers/yahooFinanceProvider');
const twelveDataProvider = require('./providers/twelveDataProvider');
const alphaVantageProvider = require('./providers/alphaVantageProvider');
const simulatedProvider = require('./providers/simulatedProvider');
const logger = require('../utils/logger');

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

async function refreshPrice() {
  for (const provider of REAL_PROVIDERS) {
    if (!provider.isConfigured()) continue;

    try {
      const result = await provider.fetchLatestPrice();
      const previous = coffeePriceRepository.latest();

      if (isSameQuote(previous, result)) {
        return coffeePriceRepository.touch(previous.id);
      }

      const saved = coffeePriceRepository.insert({ ...result, source: 'real' });
      logger.info(`Precio de café real obtenido vía ${provider.name}: ${result.price} centavos/lb`);
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

function granularityFor(provider) {
  return GRANULARITY[provider] || null;
}

module.exports = { refreshPrice, getCurrentPrice, getHistory, granularityFor };
