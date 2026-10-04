const fetchWithTimeout = require('../../utils/fetchWithTimeout');

const { getMarket } = require('../../config/markets');

const PROVIDER_NAME = 'yahoo-futures';

/**
 * Curva de futuros del contrato de café "C" en ICE (mismo mercado que yahooFinanceProvider,
 * pero en vez de un solo precio de hoy, el precio al que HOY se está comprando/vendiendo
 * café para entregar en marzo, mayo, julio... Es la mejor estimación de hacia dónde va el
 * precio que existe, porque la pone en juego con dinero real todo el mercado, no un modelo
 * estadístico local con dos meses de historia.
 *
 * Meses de vencimiento estándar del contrato "C": marzo (H), mayo (K), julio (N),
 * septiembre (U), diciembre (Z).
 */
const MONTH_CODES = { 0: 'F', 1: 'G', 2: 'H', 3: 'J', 4: 'K', 5: 'M', 6: 'N', 7: 'Q', 8: 'U', 9: 'V', 10: 'X', 11: 'Z' };

function isConfigured() {
  return true;
}

/**
 * Los próximos `count` vencimientos a partir de `from`. La fecha de cada uno se aproxima
 * al día 1 del mes de vencimiento — no es la fecha exacta de entrega (varía por contrato),
 * pero alcanza para interpolar una curva día a día.
 */
function nextContracts(count, market, from = new Date()) {
  const { prefix, months } = market.futures;
  const contracts = [];
  let y = from.getUTCFullYear();
  let m = from.getUTCMonth();

  for (let i = 0; contracts.length < count && i < 48; i += 1) {
    const isContractMonth = months.includes(m);
    const expiry = new Date(Date.UTC(y, m, 1));

    if (isContractMonth && expiry > from) {
      contracts.push({ symbol: `${prefix}${MONTH_CODES[m]}${String(y).slice(-2)}.NYB`, expiry });
    }

    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }

  return contracts;
}

async function fetchQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;

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
  const meta = data && data.chart && data.chart.result && data.chart.result[0] && data.chart.result[0].meta;
  const price = meta ? parseFloat(meta.regularMarketPrice) : NaN;

  if (!Number.isFinite(price)) throw new Error('sin precio válido');
  return price;
}

/**
 * Curva ordenada por días desde hoy: [{ daysFromNow, centsPerLb, symbol }, ...] (el campo se llama centsPerLb por historia, pero trae el precio en la unidad nativa del mercado: USD/t en cacao). No incluye
 * el día 0 (eso lo pone forecastService con el último precio ya guardado en la base, para
 * que la proyección arranque exactamente del precio que se le muestra al usuario hoy).
 * Contratos individuales que fallen (poca liquidez, symbol sin cotizar) se omiten en vez de
 * tumbar toda la curva.
 */
async function fetchCurve(contractCount = 5, marketId = 'coffee') {
  const contracts = nextContracts(contractCount, getMarket(marketId));
  const results = await Promise.allSettled(contracts.map((c) => fetchQuote(c.symbol)));

  const points = [];
  results.forEach((r, i) => {
    if (r.status !== 'fulfilled') return;
    const { symbol, expiry } = contracts[i];
    const daysFromNow = Math.max(1, Math.round((expiry.getTime() - Date.now()) / 86400000));
    points.push({ daysFromNow, centsPerLb: r.value, symbol });
  });

  points.sort((a, b) => a.daysFromNow - b.daysFromNow);

  // Por seguridad de la interpolación: si dos vencimientos quedaran con el mismo día
  // redondeado, se descarta el segundo en vez de dividir por cero más adelante.
  return points.filter((p, i) => i === 0 || p.daysFromNow > points[i - 1].daysFromNow);
}

module.exports = { fetchCurve, isConfigured, name: PROVIDER_NAME };
