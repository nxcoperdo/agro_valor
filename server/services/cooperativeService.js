const cooperativeRepository = require('../repositories/cooperativeRepository');
const fncScraperService = require('./fncScraperService');
const exchangeRateService = require('./exchangeRateService');
const priceReportService = require('./priceReportService');
const { copPerCargaToUsdPerLb } = require('../utils/currency');

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

const DISCLAIMER_BASE =
  'Precio base FNC (precio interno de referencia): real, obtenido de la fuente pública de la Federación Nacional de Cafeteros.';
const DISCLAIMER_REPORTED =
  'Los precios marcados como REPORTADOS vienen del promedio de lo que reportaron varios caficultores en los últimos días.';
const DISCLAIMER_ESTIMATED =
  'Los precios marcados como ESTIMADOS se calculan aplicando un diferencial de referencia sobre el precio base; no son un dato en vivo de esa cooperativa.';

function getComparison() {
  const fncReference = fncScraperService.getLatest();
  const cooperatives = cooperativeRepository.findAllActive();
  const exchangeRate = exchangeRateService.getCurrentRate();
  const verifiedPrices = priceReportService.getVerifiedPrices();

  const disclaimer = `${DISCLAIMER_BASE} ${DISCLAIMER_REPORTED} ${DISCLAIMER_ESTIMATED}`;

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
      const verified = verifiedPrices.get(c.id);
      const estimatedPriceCopCarga = verified
        ? verified.priceCopCarga
        : fncReference.price_cop_carga * (1 + c.differential_pct);

      return {
        id: c.id,
        name: c.name,
        region: c.region,
        municipality: c.municipality,
        differentialPct: verified
          ? estimatedPriceCopCarga / fncReference.price_cop_carga - 1
          : c.differential_pct,
        estimatedPriceCopCarga,
        estimatedPriceUsdPerLb: exchangeRate
          ? copPerCargaToUsdPerLb(estimatedPriceCopCarga, exchangeRate.rate)
          : null,
        priceSource: verified ? 'reported' : 'estimated',
        reportInfo: verified
          ? { reporterCount: verified.reporterCount, reportCount: verified.reportCount, latestDate: verified.latestDate }
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
    reportedCount: ranked.filter((c) => c.priceSource === 'reported').length,
    disclaimer,
  };
}

module.exports = { getComparison };
