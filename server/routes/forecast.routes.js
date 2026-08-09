const express = require('express');
const forecastService = require('../services/forecastService');
const marketSummaryService = require('../services/marketSummaryService');

const router = express.Router();

/**
 * El modelo proyecta la cotización internacional, que es la serie que tenemos.
 * Para que le sirva al caficultor se traduce a lo que le importa: en qué porcentaje
 * podría moverse el mercado, y a cuánto quedaría el precio interno SI se moviera
 * igual. Se dice explícitamente que es un supuesto, no una predicción del precio
 * que pagará su cooperativa.
 */
router.get('/', (req, res) => {
  const forecasts = forecastService.getForecast();
  const summary = marketSummaryService.getMarketSummary();

  const currentCents = summary.international ? summary.international.centsPerLb : null;
  const internalNow = summary.internal ? summary.internal.copPerCarga : null;

  const enriched = forecasts.map((f) => {
    const changePct = currentCents ? ((f.predictedPrice - currentCents) / currentCents) * 100 : null;

    return {
      horizon: f.horizon,
      predictedForDate: f.predictedForDate,
      usdPerLb: f.predictedPrice / 100,
      centsPerLb: f.predictedPrice,
      changePct,
      impliedInternalCopPerCarga:
        changePct != null && internalNow != null ? internalNow * (1 + changePct / 100) : null,
      modelParams: f.modelParams,
    };
  });

  res.json({
    forecasts: enriched,
    currentUsdPerLb: currentCents != null ? currentCents / 100 : null,
    internalNowCopPerCarga: internalNow,
    note:
      'La proyección es del mercado internacional, calculada con suavizado exponencial sobre el histórico. ' +
      'El equivalente en pesos supone que el precio interno se mueve en la misma proporción, cosa que no ' +
      'siempre ocurre porque también influyen la tasa de cambio y la prima de Colombia. Es una estimación, ' +
      'no una garantía de precio de compra.',
  });
});

module.exports = router;
