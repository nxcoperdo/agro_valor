const fetchWithTimeout = require('../../utils/fetchWithTimeout');

const PROVIDER_NAME = 'yahoo';
/** Contrato continuo de café "C" en ICE Futures. Cotiza en USX = centavos de dólar por libra. */
const SYMBOL = 'KC=F';

/** No necesita API key, así que siempre está disponible. */
function isConfigured() {
  return true;
}

async function fetchLatestPrice() {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(SYMBOL)}?interval=1d&range=5d`;

  const res = await fetchWithTimeout(
    url,
    {
      headers: {
        // Sin un User-Agent de navegador la petición suele ser rechazada.
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    },
    10000
  );

  if (!res.ok) {
    throw new Error(`yahooFinanceProvider: HTTP ${res.status}`);
  }

  const data = await res.json();
  const meta = data && data.chart && data.chart.result && data.chart.result[0] && data.chart.result[0].meta;

  if (!meta) {
    throw new Error('yahooFinanceProvider: respuesta sin datos de mercado');
  }

  const price = parseFloat(meta.regularMarketPrice);
  if (!Number.isFinite(price)) {
    throw new Error('yahooFinanceProvider: no se pudo leer el precio');
  }

  if (meta.currency !== 'USX') {
    throw new Error(`yahooFinanceProvider: moneda inesperada (${meta.currency}), se esperaban centavos`);
  }

  return {
    price,
    currency: 'USD',
    unit: 'cents_per_lb',
    provider: PROVIDER_NAME,
    quotedAt: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
    meta: {
      contract: meta.shortName || null,
      exchange: meta.fullExchangeName || meta.exchangeName || null,
      previousClose: meta.chartPreviousClose ?? null,
      dayHigh: meta.regularMarketDayHigh ?? null,
      dayLow: meta.regularMarketDayLow ?? null,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
    },
  };
}

module.exports = { fetchLatestPrice, isConfigured, name: PROVIDER_NAME };
