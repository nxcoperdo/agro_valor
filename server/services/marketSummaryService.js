const env = require('../config/env');
const coffeePriceService = require('./coffeePriceService');
const cocoaReferenceService = require('./cocoaReferenceService');
const exchangeRateService = require('./exchangeRateService');
const fncScraperService = require('./fncScraperService');
const { centsToUsdPerLb, exportParityCopPerCarga, cargaToExcelsoLb, BASE_FACTOR, CARGA_KG } = require('../utils/currency');
const { toIso } = require('../utils/datetime');
const { getMarket, cocoaUsdPerTonneToCopKg } = require('../config/markets');

/**
 * Arma la foto del mercado separando dos cosas que NO son lo mismo y que antes se
 * mezclaban:
 *
 *  1. `internal`  — el precio interno de referencia de la FNC, en pesos por carga de
 *     pergamino seco. Es lo que de verdad le pagan al caficultor y por eso es el
 *     número principal de la aplicación.
 *
 *  2. `international` — la cotización del contrato de café en Nueva York, en dólares
 *     por libra de café EXCELSO (verde exportable). Se muestra en su unidad original
 *     como contexto de mercado.
 *
 * La `exportParity` es el puente entre ambos, y es solo una referencia teórica: una
 * carga de 125 kg de pergamino NO rinde 125 kg de excelso, sino unos 93 kg con factor
 * 94, así que convertir la cotización usando el peso del pergamino infla el valor
 * cerca de un 34%.
 */
/**
 * Cacao: el precio interno es la referencia semanal de Agronet (COP/kg); la cotización
 * internacional (ICE, USD por tonelada métrica) se convierte a pesos por kilo con la TRM del día
 * y queda como contexto de mercado.
 */
function getCocoaSummary(market) {
  const price = coffeePriceService.getCurrentPrice(market.id);
  const exchangeRate = exchangeRateService.getCurrentRate();
  const reference = cocoaReferenceService.getLatest();
  const meta = price && price.meta ? JSON.parse(price.meta) : null;
  const changePct =
    meta && meta.previousClose ? ((price.price - meta.previousClose) / meta.previousClose) * 100 : null;

  return {
    market: market.id,
    // Referencia semanal de Agronet (lo que paga la industria): es la cifra principal en cacao,
    // el equivalente al precio interno de la FNC en café.
    internal: reference
      ? {
          copPerKg: reference.priceCopKg,
          weekLabel: reference.weekLabel,
          weekEnd: reference.weekEnd,
          scrapedAt: reference.scrapedAt,
          sourceUrl: reference.sourceUrl,
          isStale: reference.isStale,
          label: 'Precio de referencia semanal (Agronet)',
        }
      : null,
    international: price
      ? {
          usdPerTonne: price.price,
          copPerKg: exchangeRate ? cocoaUsdPerTonneToCopKg(price.price, exchangeRate.rate) : null,
          source: price.source,
          provider: price.provider,
          granularity: coffeePriceService.granularityFor(price.provider),
          quotedAt: toIso(price.quoted_at),
          fetchedAt: toIso(price.fetched_at),
          contract: meta ? meta.contract : null,
          exchange: meta ? meta.exchange : null,
          previousClose: meta ? meta.previousClose : null,
          changePct,
          unitLabel: 'USD por tonelada métrica de cacao',
        }
      : null,
    exportParity: null,
    exchangeRate: exchangeRate
      ? { rate: exchangeRate.rate, source: exchangeRate.source, fetchedAt: toIso(exchangeRate.fetched_at) }
      : null,
  };
}

function getMarketSummary(marketId = 'coffee') {
  const market = getMarket(marketId);
  if (market.id === 'cocoa') return getCocoaSummary(market);

  const price = coffeePriceService.getCurrentPrice();
  const exchangeRate = exchangeRateService.getCurrentRate();
  const fnc = fncScraperService.getLatest();

  const usdPerLb = price ? centsToUsdPerLb(price.price) : null;
  const meta = price && price.meta ? JSON.parse(price.meta) : null;

  const international = price
    ? {
        usdPerLb,
        centsPerLb: price.price,
        source: price.source,
        provider: price.provider,
        granularity: coffeePriceService.granularityFor(price.provider),
        quotedAt: toIso(price.quoted_at),
        fetchedAt: toIso(price.fetched_at),
        contract: meta ? meta.contract : null,
        exchange: meta ? meta.exchange : null,
        previousClose: meta ? meta.previousClose : null,
        changePct:
          meta && meta.previousClose ? ((price.price - meta.previousClose) / meta.previousClose) * 100 : null,
        unitLabel: 'USD por libra de café excelso',
      }
    : null;

  const exportParity =
    usdPerLb != null && exchangeRate
      ? {
          copPerCarga: exportParityCopPerCarga({
            usdPerLb,
            exchangeRate: exchangeRate.rate,
            factor: BASE_FACTOR,
            premiumUsdPerLb: env.colombiaPremiumUsdPerLb,
          }),
          factor: BASE_FACTOR,
          premiumUsdPerLb: env.colombiaPremiumUsdPerLb,
          excelsoLbPerCarga: cargaToExcelsoLb(BASE_FACTOR),
          isTheoretical: true,
          note:
            `Referencia teórica: cuánto valdría una carga liquidada contra la bolsa de Nueva York, ` +
            `convirtiendo pergamino a excelso con factor ${BASE_FACTOR} y sumando una prima de ` +
            `US$ ${env.colombiaPremiumUsdPerLb.toFixed(2)} por libra. No es una oferta de compra.`,
        }
      : null;

  return {
    market: 'coffee',
    internal: fnc
      ? {
          copPerCarga: fnc.price_cop_carga,
          scrapedAt: toIso(fnc.scraped_at),
          sourceUrl: fnc.source_url,
          cargaKg: CARGA_KG,
          label: 'Precio interno de referencia (FNC)',
        }
      : null,
    international,
    exportParity,
    exchangeRate: exchangeRate
      ? { rate: exchangeRate.rate, source: exchangeRate.source, fetchedAt: toIso(exchangeRate.fetched_at) }
      : null,
  };
}

module.exports = { getMarketSummary };
