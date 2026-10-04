const cooperativeRepository = require('../repositories/cooperativeRepository');
const fncScraperService = require('./fncScraperService');
const exchangeRateService = require('./exchangeRateService');
const priceReportService = require('./priceReportService');
const cocoaReferenceService = require('./cocoaReferenceService');
const { getMarket } = require('../config/markets');
const { copPerCargaToUsdPerLb } = require('../utils/currency');
const { toIso, toEpoch } = require('../utils/datetime');

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

const DISCLAIMER_BASE =
  'Precio base FNC (precio interno de referencia): real, obtenido de la fuente pública de la Federación Nacional de Cafeteros.';
const DISCLAIMER_REPORTED =
  'Los precios marcados como REPORTADOS vienen del promedio de lo que reportaron varios caficultores en los últimos días.';
const DISCLAIMER_ESTIMATED =
  'Los precios marcados como ESTIMADOS se calculan aplicando un diferencial de referencia sobre el precio base; no son un dato en vivo de esa cooperativa.';

/**
 * Cacao: la referencia es el precio semanal de Agronet (promedio de industria y exportadores),
 * no una "base" sobre la cual estimar. Un comprador solo muestra precio cuando varios usuarios
 * distintos lo reportaron; si no, queda "sin reportes" en vez de inventar un diferencial.
 */
function getCocoaComparison() {
  const reference = cocoaReferenceService.getLatest();
  const verifiedPrices = priceReportService.getVerifiedPrices();

  const cooperatives = cooperativeRepository
    .findAllActive('cocoa')
    .map((c) => {
      const verified = verifiedPrices.get(c.id);
      return {
        id: c.id,
        name: c.name,
        region: c.region,
        municipality: c.municipality,
        // Los reportes guardan el valor en priceCopCarga (nombre histórico); en cacao es COP por kilo.
        priceCopKg: verified ? verified.priceCopCarga : null,
        priceSource: verified ? 'reported' : 'none',
        reportInfo: verified
          ? { reporterCount: verified.reporterCount, reportCount: verified.reportCount, latestDate: verified.latestDate }
          : null,
      };
    })
    // Los que tienen precio reportado primero, de mayor a menor; el resto por nombre.
    .sort((a, b) => (b.priceCopKg ?? -1) - (a.priceCopKg ?? -1) || a.name.localeCompare(b.name))
    .map((c, idx, arr) => {
      const priced = arr.filter((x) => x.priceCopKg != null);
      return {
        ...c,
        rank: c.priceCopKg != null ? idx + 1 : null,
        isHighestBuyer: priced.length > 1 && idx === 0,
        isLowestBuyer: priced.length > 1 && c.priceCopKg != null && idx === priced.length - 1,
      };
    });

  return {
    market: 'cocoa',
    reference,
    cooperatives,
    reportedCount: cooperatives.filter((c) => c.priceSource === 'reported').length,
    disclaimer:
      'El precio de referencia es el promedio semanal que publica Agronet (Ministerio de Agricultura) con lo que pagan la industria nacional y los exportadores. ' +
      'Fedecacao no fija precios de compra. El precio de cada comprador solo aparece cuando varios productores lo reportan; no se estima.',
    error: reference ? null : 'Aún no hay un precio de referencia del cacao disponible.',
  };
}

function getComparison(marketId = 'coffee') {
  if (getMarket(marketId).id === 'cocoa') return getCocoaComparison();

  const fncReference = fncScraperService.getLatest();
  const cooperatives = cooperativeRepository.findAllActive('coffee');
  const exchangeRate = exchangeRateService.getCurrentRate();
  const verifiedPrices = priceReportService.getVerifiedPrices();

  const disclaimer = `${DISCLAIMER_BASE} ${DISCLAIMER_REPORTED} ${DISCLAIMER_ESTIMATED}`;

  if (!fncReference) {
    return {
      market: 'coffee',
      fncReference: null,
      cooperatives: [],
      disclaimer,
      error: 'Aún no hay un precio de referencia FNC disponible.',
    };
  }

  const isStale = Date.now() - toEpoch(fncReference.scraped_at) > STALE_AFTER_MS;

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
    market: 'coffee',
    fncReference: {
      priceCopCarga: fncReference.price_cop_carga,
      priceUsdPerLb: exchangeRate ? copPerCargaToUsdPerLb(fncReference.price_cop_carga, exchangeRate.rate) : null,
      scrapedAt: toIso(fncReference.scraped_at),
      sourceUrl: fncReference.source_url,
      isStale,
    },
    exchangeRate: exchangeRate
      ? { rate: exchangeRate.rate, source: exchangeRate.source, fetchedAt: toIso(exchangeRate.fetched_at) }
      : null,
    cooperatives: ranked,
    reportedCount: ranked.filter((c) => c.priceSource === 'reported').length,
    disclaimer,
  };
}

module.exports = { getComparison };
