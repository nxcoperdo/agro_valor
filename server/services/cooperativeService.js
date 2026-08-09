const cooperativeRepository = require('../repositories/cooperativeRepository');
const fncScraperService = require('./fncScraperService');
const exchangeRateService = require('./exchangeRateService');
const { copPerCargaToUsdPerLb } = require('../utils/currency');

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function getComparison() {
  const fncReference = fncScraperService.getLatest();
  const cooperatives = cooperativeRepository.findAllActive();
  const exchangeRate = exchangeRateService.getCurrentRate();

  const disclaimer =
    'Precio base FNC (precio interno de referencia): real, obtenido de la fuente pública de la Federación Nacional de Cafeteros. ' +
    'Precios por cooperativa: ESTIMADOS aplicando un diferencial configurado sobre el precio base; no provienen de una fuente en vivo por cooperativa.';

  if (!fncReference) {
    return {
      fncReference: null,
      cooperatives: [],
      disclaimer,
      error: 'Aún no hay un precio de referencia FNC disponible.',
    };
  }

  const isStale = Date.now() - new Date(`${fncReference.scraped_at}Z`).getTime() > STALE_AFTER_MS;

  const ranked = cooperatives
    .map((c) => {
      const estimatedPriceCopCarga = fncReference.price_cop_carga * (1 + c.differential_pct);
      return {
        id: c.id,
        name: c.name,
        region: c.region,
        differentialPct: c.differential_pct,
        estimatedPriceCopCarga,
        estimatedPriceUsdPerLb: exchangeRate
          ? copPerCargaToUsdPerLb(estimatedPriceCopCarga, exchangeRate.rate)
          : null,
      };
    })
    .sort((a, b) => b.estimatedPriceCopCarga - a.estimatedPriceCopCarga)
    .map((c, idx, arr) => ({
      ...c,
      rank: idx + 1,
      isHighestBuyer: idx === 0,
      isLowestBuyer: idx === arr.length - 1,
    }));

  return {
    fncReference: {
      priceCopCarga: fncReference.price_cop_carga,
      priceUsdPerLb: exchangeRate ? copPerCargaToUsdPerLb(fncReference.price_cop_carga, exchangeRate.rate) : null,
      scrapedAt: fncReference.scraped_at,
      sourceUrl: fncReference.source_url,
      isStale,
    },
    exchangeRate: exchangeRate
      ? { rate: exchangeRate.rate, source: exchangeRate.source, fetchedAt: exchangeRate.fetched_at }
      : null,
    cooperatives: ranked,
    disclaimer,
  };
}

module.exports = { getComparison };
