const db = require('../db/connection');
const fetchWithTimeout = require('../utils/fetchWithTimeout');
const { getMarket } = require('../config/markets');
const logger = require('../utils/logger');

/** Con menos filas que esto el gráfico de velas no dice nada, así que se completa con el pasado. */
const MIN_ROWS = 30;
const PROVIDER = 'yahoo-history';

const pad = (n) => String(n).padStart(2, '0');
const sqlTime = (d) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;

/**
 * Convierte las velas diarias de Yahoo en filas de precio. El gráfico arma cada vela con la
 * primera fila del día (apertura), la mayor (máximo), la menor (mínimo) y la última (cierre),
 * así que cada día se guarda como 4 filas ordenadas: apertura, mínimo, máximo y cierre.
 */
function candlesToRows(timestamps, quote) {
  const rows = [];
  timestamps.forEach((ts, i) => {
    const o = quote.open[i];
    const h = quote.high[i];
    const l = quote.low[i];
    const c = quote.close[i];
    if ([o, h, l, c].some((v) => !Number.isFinite(v))) return;

    const day = new Date(ts * 1000);
    // Todas dentro del mismo día de Colombia (UTC-5): de 12:00 a 15:00 UTC son 07:00–10:00 locales.
    [o, l, h, c].forEach((price, k) => {
      const at = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 12 + k, 0));
      rows.push({ price, at: sqlTime(at) });
    });
  });
  return rows;
}

/** Completa el histórico de un mercado que arrancó vacío. Solo actúa una vez: si ya hay datos, no hace nada. */
async function backfill(marketId) {
  const market = getMarket(marketId);
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM coffee_prices WHERE market = ?').get(market.id);
  if (n >= MIN_ROWS) return 0;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(market.yahooSymbol)}?interval=1d&range=1y`;
    const res = await fetchWithTimeout(
      url,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36', Accept: 'application/json' } },
      15000
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const result = (await res.json())?.chart?.result?.[0];
    if (!result || !result.timestamp) throw new Error('respuesta sin datos');
    if (result.meta.currency !== market.yahooCurrency) throw new Error(`moneda inesperada (${result.meta.currency})`);

    const rows = candlesToRows(result.timestamp, result.indicators.quote[0]);
    const insert = db.prepare(
      `INSERT INTO coffee_prices (price, currency, unit, source, provider, quoted_at, fetched_at, market)
       VALUES (?, 'USD', ?, 'real', ?, ?, ?, ?)`
    );
    db.transaction(() => rows.forEach((r) => insert.run(r.price, market.unit, PROVIDER, r.at.replace(' ', 'T') + 'Z', r.at, market.id)))();
    logger.info(`Histórico de ${market.id} completado desde Yahoo: ${rows.length / 4} días`);
    return rows.length;
  } catch (err) {
    logger.warn(`priceHistoryBackfillService: no se pudo completar el histórico de ${market.id} (${err.message})`);
    return 0;
  }
}

module.exports = { backfill, candlesToRows, MIN_ROWS };
