const express = require('express');
const forecastService = require('../services/forecastService');
const exchangeRateService = require('../services/exchangeRateService');
const { centsToUsdPerLb, usdPerLbToCop } = require('../utils/currency');

const router = express.Router();

router.get('/', (req, res) => {
  const forecasts = forecastService.getForecast();
  const exchangeRate = exchangeRateService.getCurrentRate();

  const enriched = forecasts.map((f) => {
    const usdPerLb = centsToUsdPerLb(f.predictedPrice);
    return {
      ...f,
      usdPerLb,
      copPerLb: exchangeRate ? usdPerLbToCop(usdPerLb, exchangeRate.rate) : null,
    };
  });

  res.json({
    forecasts: enriched,
    exchangeRate: exchangeRate
      ? { rate: exchangeRate.rate, source: exchangeRate.source, fetchedAt: exchangeRate.fetched_at }
      : null,
    note: 'La conversión a pesos colombianos usa la tasa de cambio USD/COP más reciente disponible, no una proyección de la tasa futura.',
  });
});

module.exports = router;
