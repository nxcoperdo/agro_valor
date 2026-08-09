const express = require('express');
const coffeePriceService = require('../services/coffeePriceService');
const exchangeRateService = require('../services/exchangeRateService');
const { centsToUsdPerLb, usdPerLbToCop } = require('../utils/currency');

const router = express.Router();

router.get('/current', (req, res) => {
  const current = coffeePriceService.getCurrentPrice();
  if (!current) {
    return res.status(503).json({ error: 'Aún no hay datos de precio disponibles' });
  }

  const exchangeRate = exchangeRateService.getCurrentRate();
  const usdPerLb = centsToUsdPerLb(current.price);
  const copPerLb = exchangeRate ? usdPerLbToCop(usdPerLb, exchangeRate.rate) : null;

  res.json({
    ...current,
    usdPerLb,
    copPerLb,
    exchangeRate: exchangeRate
      ? { rate: exchangeRate.rate, source: exchangeRate.source, provider: exchangeRate.provider, fetchedAt: exchangeRate.fetched_at }
      : null,
  });
});

router.get('/history', (req, res) => {
  const days = Math.min(parseInt(req.query.days, 10) || 30, 365);
  res.json(coffeePriceService.getHistory(days));
});

module.exports = router;
