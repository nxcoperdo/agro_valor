const coffeePriceRepository = require('../repositories/coffeePriceRepository');
const exchangeRateRepository = require('../repositories/exchangeRateRepository');
const coffeePriceService = require('./coffeePriceService');
const forecastRepository = require('../repositories/forecastRepository');
const yahooFuturesProvider = require('./providers/yahooFuturesProvider');
const logger = require('../utils/logger');
const { getMarket, listMarkets } = require('../config/markets');

/**
 * PROYECCIÓN — cómo se arma y por qué.
 *
 * Antes esto era un suavizado exponencial (Holt-Winters) sobre el histórico propio, que
 * en la práctica extrapolaba en línea recta la tendencia de los últimos días — si el café
 * venía subiendo, la proyección decía "va a seguir subiendo", sin límite real de mercado.
 * Con solo unas semanas de historial guardada eso no es confiable.
 *
 * Ahora el precio central sale de la CURVA DE FUTUROS de la bolsa de Nueva York (ICE): el
 * precio al que hoy se está comprando y vendiendo café para entregar en marzo, mayo, julio...
 * Es la mejor estimación que existe, porque es el consenso de todo el mercado con dinero real
 * de por medio, no un modelo estadístico local. Se interpola día a día entre los vencimientos
 * conocidos (yahooFuturesProvider) y, más allá del último vencimiento con dato, se mantiene
 * plano en vez de inventar una tendencia que el mercado no está fijando todavía.
 *
 * Además del precio central se calcula un RANGO PROBABLE (low/high), usando la volatilidad
 * histórica real del café y del dólar: entre más lejos la fecha, más ancho el rango. Esto es
 * lo honesto — nadie puede predecir el precio exacto de dentro de 3 meses, y mostrar un solo
 * número sin margen de error sugiere una certeza que no existe.
 *
 * Si la curva de futuros no se puede obtener (Yahoo caído, símbolos sin cotizar), se cae al
 * método de suavizado anterior como respaldo, marcado explícitamente en modelParams.method
 * para que quien lea el dato sepa que es menos confiable.
 */

const DAILY_STEPS = 14;
const WEEKLY_STEPS = 8;
const MONTHLY_STEPS = 6;
const SEASON_LENGTH = 7;
const DAYS_PER_MONTH = 30;

function buildHorizons() {
  const horizons = [];
  for (let step = 1; step <= DAILY_STEPS; step += 1) horizons.push({ granularity: 'day', step, days: step });
  for (let step = 1; step <= WEEKLY_STEPS; step += 1) {
    horizons.push({ granularity: 'week', step, days: step * SEASON_LENGTH });
  }
  for (let step = 1; step <= MONTHLY_STEPS; step += 1) {
    horizons.push({ granularity: 'month', step, days: step * DAYS_PER_MONTH });
  }
  return horizons;
}

// Red de seguridad: pase lo que pase con la curva o el modelo de respaldo, nunca se muestra
// un precio proyectado (ni el borde del rango) que implique un movimiento de mercado mayor
// a esto respecto al último precio real conocido. El café es volátil pero no así de volátil.
const MAX_FORECAST_MOVE_PCT = 0.5;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Interpola linealmente entre los puntos de la curva; más allá del último, se mantiene plano. */
function interpolateCurve(curve, days) {
  if (days <= curve[0].days) return curve[0].centsPerLb;

  for (let i = 0; i < curve.length - 1; i += 1) {
    const a = curve[i];
    const b = curve[i + 1];
    if (days >= a.days && days <= b.days) {
      const t = (days - a.days) / (b.days - a.days);
      return a.centsPerLb + t * (b.centsPerLb - a.centsPerLb);
    }
  }

  return curve[curve.length - 1].centsPerLb;
}

/**
 * Desviación estándar de los retornos logarítmicos diarios: la medida estándar de
 * volatilidad para armar el rango. Con poca historia todavía (menos de ~10 puntos) se usa
 * un valor conservador típico del mercado en vez de un cálculo con muy pocos datos.
 */
function dailyVolatility(series, fallback) {
  if (!series || series.length < 10) return fallback;

  const returns = [];
  for (let i = 1; i < series.length; i += 1) {
    if (series[i - 1] > 0 && series[i] > 0) returns.push(Math.log(series[i] / series[i - 1]));
  }
  if (returns.length < 5) return fallback;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance);
}

// Volatilidad anualizada típica cuando todavía no hay suficiente historia propia guardada:
// ~28%/año para el contrato de café (por mercado en config/markets.js; cacao ~45%), ~12%/año para el USD/COP (fuentes: volatilidad
// histórica habitual de ICE Coffee C y del peso colombiano). Se pasa a diaria dividiendo
// por raíz de 252 (días hábiles al año).
const TRADING_DAYS_PER_YEAR = 252;
const FALLBACK_FX_ANNUAL_VOL = 0.12;

function buildFuturesForecast(curve, lastObserved, market) {
  // curve trae { daysFromNow, centsPerLb, symbol } (formato del proveedor); interpolateCurve
  // espera { days, centsPerLb } — de ahí el mapeo, y no un simple spread.
  const fullCurve = [
    { days: 0, centsPerLb: lastObserved },
    ...curve.map((p) => ({ days: p.daysFromNow, centsPerLb: p.centsPerLb })),
  ];

  const coffeeVol = dailyVolatility(
    coffeePriceRepository.dailySeries(180, market.id).map((d) => d.price),
    market.fallbackAnnualVol / Math.sqrt(TRADING_DAYS_PER_YEAR)
  );
  const fxVol = dailyVolatility(
    exchangeRateRepository.dailySeries(180).map((d) => d.rate),
    FALLBACK_FX_ANNUAL_VOL / Math.sqrt(TRADING_DAYS_PER_YEAR)
  );
  const combinedDailyVol = Math.sqrt(coffeeVol ** 2 + fxVol ** 2);

  const minPrice = lastObserved * (1 - MAX_FORECAST_MOVE_PCT);
  const maxPrice = lastObserved * (1 + MAX_FORECAST_MOVE_PCT);

  const modelParams = {
    method: 'futures-curve',
    source: `yahoo-ice-${market.id}`,
    curve: curve.map((p) => ({ symbol: p.symbol, days: p.daysFromNow, centsPerLb: p.centsPerLb })),
    dailyVolPct: combinedDailyVol,
  };

  return buildHorizons().map(({ granularity, step, days }) => {
    const predictedForDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const center = interpolateCurve(fullCurve, days);
    const bandPct = clamp(combinedDailyVol * Math.sqrt(days), 0, MAX_FORECAST_MOVE_PCT);

    return {
      granularity,
      step,
      predictedForDate,
      predictedPrice: clamp(center, minPrice, maxPrice),
      lowPrice: clamp(center * (1 - bandPct), minPrice, maxPrice),
      highPrice: clamp(center * (1 + bandPct), minPrice, maxPrice),
      modelParams,
    };
  });
}

/* --------------------------------------------------------------------------------------
 * Respaldo: suavizado exponencial sobre el histórico propio, solo si la curva de futuros
 * no se pudo obtener. Es el método que había antes; se conserva porque, aunque menos
 * confiable, sigue siendo mejor que no mostrar nada.
 * ------------------------------------------------------------------------------------ */

const ALPHA_CANDIDATES = [0.1, 0.3, 0.5, 0.7, 0.9];
const BETA_CANDIDATES = [0.1, 0.3, 0.5, 0.7, 0.9];
const TREND_DAMPING = 0.98;

function fitHolt(series, alpha, beta) {
  let level = series[0];
  let trend = series[1] - series[0];
  let sse = 0;

  for (let t = 1; t < series.length; t += 1) {
    const forecast = level + trend;
    const error = series[t] - forecast;
    sse += error * error;

    const prevLevel = level;
    level = alpha * series[t] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }

  return { level, trend, sse };
}

function fitBestHolt(series) {
  let best = null;
  for (const alpha of ALPHA_CANDIDATES) {
    for (const beta of BETA_CANDIDATES) {
      const result = fitHolt(series, alpha, beta);
      if (!best || result.sse < best.sse) best = { ...result, alpha, beta };
    }
  }
  return best;
}

function dampedTrendSum(trend, horizonDays) {
  const phi = TREND_DAMPING;
  return trend * ((phi * (1 - phi ** horizonDays)) / (1 - phi));
}

function buildHoltFallbackForecast(series, market) {
  const best = fitBestHolt(series);
  const lastObserved = series[series.length - 1];
  const minPrice = lastObserved * (1 - MAX_FORECAST_MOVE_PCT);
  const maxPrice = lastObserved * (1 + MAX_FORECAST_MOVE_PCT);

  const coffeeVol = dailyVolatility(series, market.fallbackAnnualVol / Math.sqrt(TRADING_DAYS_PER_YEAR));
  const fxVol = dailyVolatility(
    exchangeRateRepository.dailySeries(180).map((d) => d.rate),
    FALLBACK_FX_ANNUAL_VOL / Math.sqrt(TRADING_DAYS_PER_YEAR)
  );
  const combinedDailyVol = Math.sqrt(coffeeVol ** 2 + fxVol ** 2);

  const modelParams = {
    method: 'holt-winters-fallback',
    alpha: best.alpha,
    beta: best.beta,
    points: series.length,
    note: 'La curva de futuros no estuvo disponible; esto es un respaldo estadístico, menos confiable.',
  };

  return buildHorizons().map(({ granularity, step, days }) => {
    const predictedForDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const center = best.level + dampedTrendSum(best.trend, days);
    const bandPct = clamp(combinedDailyVol * Math.sqrt(days), 0, MAX_FORECAST_MOVE_PCT);

    return {
      granularity,
      step,
      predictedForDate,
      predictedPrice: clamp(center, minPrice, maxPrice),
      lowPrice: clamp(center * (1 - bandPct), minPrice, maxPrice),
      highPrice: clamp(center * (1 + bandPct), minPrice, maxPrice),
      modelParams,
    };
  });
}

async function computeForecast(market) {
  const current = coffeePriceService.getCurrentPrice(market.id);
  if (!current) return null;

  const lastObserved = current.price;

  try {
    const curve = await yahooFuturesProvider.fetchCurve(5, market.id);
    if (curve.length >= 1) return buildFuturesForecast(curve, lastObserved, market);
    throw new Error('curva de futuros vacía');
  } catch (err) {
    logger.warn(
      `forecastService: no se pudo obtener la curva de futuros de ${market.id}, se usa el respaldo (${err.message})`
    );
  }

  const series = coffeePriceRepository.dailySeries(180, market.id).map((d) => d.price);
  if (series.length < 2) return null;

  return buildHoltFallbackForecast(series, market);
}

async function recomputeAndCache(marketId = 'coffee') {
  const market = getMarket(marketId);
  const forecasts = await computeForecast(market);
  if (!forecasts) {
    logger.warn(`forecastService: no hay suficiente historial de precios de ${market.id} para proyectar todavía.`);
    return [];
  }
  forecastRepository.replaceAll(forecasts, market.id);
  logger.info(
    `Proyección de ${market.id} recalculada (${forecasts.length} horizontes, ${forecasts[0].modelParams.method}).`
  );
  return forecasts;
}

/** Recalcula todos los mercados; uno que falle no impide que los demás se actualicen. */
async function recomputeAllMarkets() {
  for (const market of listMarkets()) {
    try {
      await recomputeAndCache(market.id);
    } catch (err) {
      logger.error(`forecastService: error recalculando ${market.id}:`, err);
    }
  }
}

function normalizeRow(row) {
  return {
    granularity: row.granularity,
    step: row.step,
    predictedPrice: row.predicted_price,
    lowPrice: row.low_price,
    highPrice: row.high_price,
    predictedForDate: row.predicted_for_date,
    generatedAt: row.generated_at,
    modelParams: JSON.parse(row.model_params || '{}'),
  };
}

/**
 * Normalmente la caché ya está poblada por el cron/el arranque. El único momento en que
 * puede estar vacía es justo al arrancar el servidor, mientras esa primera carga sigue en
 * curso (no se bloquea el arranque del servidor por ella) — en ese caso se calcula aquí
 * mismo para esta primera petición en vez de devolver un vacío.
 */
async function getForecast(marketId = 'coffee') {
  const market = getMarket(marketId);
  const cached = forecastRepository.latestAll(market.id);
  if (cached.length > 0) return cached.map(normalizeRow);
  return recomputeAndCache(market.id);
}

module.exports = { recomputeAndCache, recomputeAllMarkets, getForecast };
