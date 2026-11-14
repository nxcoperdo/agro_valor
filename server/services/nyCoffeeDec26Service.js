const fetchWithTimeout = require('../utils/fetchWithTimeout');

/**
 * Café "C" arábica en ICE Futures US (Bolsa de Nueva York), vencimiento diciembre 2026.
 * Cotiza en centavos de dólar por libra (c/lb). Al vencer el contrato hay que cambiar
 * este símbolo por el siguiente (KCH27.NYB, ...).
 */
const SYMBOL = 'KCZ26.NYB';
const CONTRACT_LABEL = 'Coffee Dec 26';
const CACHE_MS = 60 * 1000;

let cache = { at: 0, value: null };

const finite = (value) => (Number.isFinite(value) ? value : null);
const round2 = (value) => (value === null ? null : Math.round(value * 100) / 100);

async function fetchFromYahoo() {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(SYMBOL)}?interval=1d&range=5d`;

  const res = await fetchWithTimeout(
    url,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    },
    10000
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  const result = data && data.chart && data.chart.result && data.chart.result[0];
  const meta = result && result.meta;
  const price = meta ? finite(parseFloat(meta.regularMarketPrice)) : null;
  if (price === null) throw new Error('sin precio válido');

  // Cierre anterior = último cierre diario distinto de la barra de hoy. `chartPreviousClose`
  // no sirve: con range=5d es el cierre previo al INICIO del rango, no el de ayer.
  const closes = ((result.indicators && result.indicators.quote && result.indicators.quote[0].close) || []).filter(
    (c) => finite(c) !== null
  );
  const previousClose = closes.length >= 2 ? closes[closes.length - 2] : finite(meta.previousClose);

  const change = previousClose === null ? null : price - previousClose;
  const changePct = previousClose ? (change / previousClose) * 100 : null;

  return {
    available: true,
    contract: CONTRACT_LABEL,
    symbol: SYMBOL,
    unit: 'c/lb',
    price: round2(price),
    change: round2(change),
    changePct: round2(changePct),
    previousClose: round2(previousClose),
    dayLow: round2(finite(meta.regularMarketDayLow)),
    dayHigh: round2(finite(meta.regularMarketDayHigh)),
    quotedAt: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
  };
}

/** Nunca lanza: si la fuente falla devuelve { available: false } (o el último dato bueno si es reciente). */
async function getNyCoffeeDec26() {
  const now = Date.now();
  if (cache.value && now - cache.at < CACHE_MS) return cache.value;

  try {
    const value = await fetchFromYahoo();
    cache = { at: now, value };
    return value;
  } catch (err) {
    console.warn(`[nyCoffeeDec26] ${err.message}`);
    // Un fallo puntual no debe borrar el dato anterior si tiene menos de 15 min.
    if (cache.value && now - cache.at < 15 * 60 * 1000) return cache.value;
    return { available: false };
  }
}

module.exports = { getNyCoffeeDec26 };
