const env = require('./env');

/**
 * Mercados que soporta la plataforma. Café es el principal y el valor por defecto en todas
 * las rutas. Para sumar otro (frijol, maíz…) basta con agregar una entrada aquí; el precio,
 * la proyección y las alertas leen de esta configuración.
 *
 * - unit: unidad en que cotiza la bolsa (se guarda tal cual en coffee_prices.unit).
 * - yahooCurrency: moneda que debe reportar Yahoo para ese contrato (validación defensiva).
 * - futures: prefijo y meses de contrato ICE (H=mar, K=may, N=jul, U=sep, Z=dic).
 * - providers: qué proveedores de precio spot tienen datos reales de este producto.
 * - display: cómo se le muestra el precio al productor en pesos.
 */
const MARKETS = {
  coffee: {
    id: 'coffee',
    name: 'Café',
    emoji: '☕',
    unit: 'cents_per_lb',
    yahooSymbol: 'KC=F',
    yahooCurrency: 'USX',
    futures: { prefix: 'KC', months: [2, 4, 6, 8, 11] },
    providers: ['yahoo', 'twelvedata', 'alphavantage'],
    simulatedBase: env.coffeeBasePriceCents,
    fallbackAnnualVol: 0.28,
    display: { unit: 'cop_carga', label: 'COP por carga de 125 kg' },
  },
  cocoa: {
    id: 'cocoa',
    name: 'Cacao',
    emoji: '🍫',
    unit: 'usd_per_tonne',
    yahooSymbol: 'CC=F',
    yahooCurrency: 'USD',
    futures: { prefix: 'CC', months: [2, 4, 6, 8, 11] },
    providers: ['yahoo'],
    simulatedBase: 5600,
    fallbackAnnualVol: 0.45,
    display: { unit: 'cop_kg', label: 'COP por kilo' },
    // Qué fracción de la cotización ICE (convertida a COP/kg) llega al productor en finca.
    // Supuesto editable: no hay un precio interno oficial de cacao como el de la FNC.
    farmgateFactor: 0.8,
  },
};

const DEFAULT_MARKET = 'coffee';

function isValidMarket(id) {
  return Object.prototype.hasOwnProperty.call(MARKETS, id);
}

/** Devuelve la config del mercado; si no se pide ninguno, café. Lanza si no existe. */
function getMarket(id = DEFAULT_MARKET) {
  if (!isValidMarket(id)) {
    const err = new Error(`Mercado no soportado: ${id}`);
    err.status = 400;
    throw err;
  }
  return MARKETS[id];
}

function listMarkets() {
  return Object.values(MARKETS);
}

/**
 * Convierte el precio de bolsa del cacao (USD por tonelada métrica) a pesos por kilo.
 * COP/kg = USD/t × TRM ÷ 1000.
 */
function cocoaUsdPerTonneToCopKg(usdPerTonne, copPerUsd) {
  return (usdPerTonne * copPerUsd) / 1000;
}

module.exports = { MARKETS, DEFAULT_MARKET, isValidMarket, getMarket, listMarkets, cocoaUsdPerTonneToCopKg };
