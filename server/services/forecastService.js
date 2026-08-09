const coffeePriceRepository = require('../repositories/coffeePriceRepository');
const forecastRepository = require('../repositories/forecastRepository');
const logger = require('../utils/logger');

const ALPHA_CANDIDATES = [0.1, 0.3, 0.5, 0.7, 0.9];
const BETA_CANDIDATES = [0.1, 0.3, 0.5, 0.7, 0.9];
const GAMMA = 0.3;
const SEASON_LENGTH = 7;
const MIN_POINTS_FOR_SEASONALITY = 2 * SEASON_LENGTH;

/** Suavizado de Holt (nivel + tendencia). Devuelve el estado final { level, trend } y el SSE de 1 paso adelante. */
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

/** Busca los mejores alpha/beta minimizando el SSE de un paso adelante (grid search). */
function fitBestHolt(series) {
  let best = null;

  for (const alpha of ALPHA_CANDIDATES) {
    for (const beta of BETA_CANDIDATES) {
      const result = fitHolt(series, alpha, beta);
      if (!best || result.sse < best.sse) {
        best = { ...result, alpha, beta };
      }
    }
  }

  return best;
}

/** Holt-Winters aditivo (nivel + tendencia + estacionalidad semanal), usado solo con suficiente historia. */
function fitHoltWinters(series, alpha, beta, gamma) {
  const seasonals = [];
  for (let i = 0; i < SEASON_LENGTH; i += 1) {
    const seasonPoints = [];
    for (let j = i; j < series.length; j += SEASON_LENGTH) seasonPoints.push(series[j]);
    const avg = seasonPoints.reduce((a, b) => a + b, 0) / seasonPoints.length;
    seasonals.push(avg);
  }
  const overallAvg = seasonals.reduce((a, b) => a + b, 0) / seasonals.length;
  const season = seasonals.map((s) => s - overallAvg);

  let level = series[0];
  let trend = series[1] - series[0];

  for (let t = 0; t < series.length; t += 1) {
    const s = season[t % SEASON_LENGTH];
    const forecast = level + trend + s;
    const error = series[t] - forecast;

    const prevLevel = level;
    level = alpha * (series[t] - s) + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    season[t % SEASON_LENGTH] = gamma * (series[t] - level) + (1 - gamma) * s;

    if (t === series.length - 1) {
      // conserva el último error para referencia si se necesitara en el futuro
      void error;
    }
  }

  return { level, trend, season };
}

function forecastAt(model, horizonDays, hasSeasonality) {
  if (hasSeasonality) {
    const s = model.season[(horizonDays - 1) % SEASON_LENGTH];
    return model.level + horizonDays * model.trend + s;
  }
  return model.level + horizonDays * model.trend;
}

function computeForecast() {
  const daily = coffeePriceRepository.dailySeries(180);
  const series = daily.map((d) => d.price);

  if (series.length < 2) {
    return null;
  }

  const hasSeasonality = series.length >= MIN_POINTS_FOR_SEASONALITY;
  let modelParams;
  let predictFn;

  if (hasSeasonality) {
    const best = fitBestHolt(series);
    const hw = fitHoltWinters(series, best.alpha, best.beta, GAMMA);
    modelParams = { method: 'holt-winters', alpha: best.alpha, beta: best.beta, gamma: GAMMA, points: series.length };
    predictFn = (h) => forecastAt(hw, h, true);
  } else {
    const best = fitBestHolt(series);
    modelParams = { method: 'holt', alpha: best.alpha, beta: best.beta, points: series.length };
    predictFn = (h) => forecastAt(best, h, false);
  }

  const now = new Date();
  const horizons = [
    { horizon: '1d', days: 1 },
    { horizon: '7d', days: 7 },
    { horizon: '30d', days: 30 },
  ];

  return horizons.map(({ horizon, days }) => {
    const predictedForDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    return {
      horizon,
      predictedPrice: Math.max(predictFn(days), 0.01),
      predictedForDate,
      modelParams,
    };
  });
}

function recomputeAndCache() {
  const forecasts = computeForecast();
  if (!forecasts) {
    logger.warn('forecastService: no hay suficiente historial de precios para proyectar todavía.');
    return [];
  }
  forecastRepository.replaceAll(forecasts);
  logger.info(`Proyección de precio recalculada (${forecasts.length} horizontes).`);
  return forecasts;
}

function normalizeRow(row) {
  return {
    horizon: row.horizon,
    predictedPrice: row.predicted_price,
    predictedForDate: row.predicted_for_date,
    generatedAt: row.generated_at,
    modelParams: JSON.parse(row.model_params || '{}'),
  };
}

function getForecast() {
  const cached = forecastRepository.latestAll();
  if (cached.length > 0) return cached.map(normalizeRow);
  return recomputeAndCache();
}

module.exports = { recomputeAndCache, getForecast };
