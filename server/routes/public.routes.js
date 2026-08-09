const express = require('express');
const coffeePriceService = require('../services/coffeePriceService');
const exchangeRateService = require('../services/exchangeRateService');
const cooperativeService = require('../services/cooperativeService');
const subscriptionService = require('../services/subscriptionService');
const { centsToUsdPerLb, usdPerLbToCop, LB_PER_CARGA } = require('../utils/currency');

const router = express.Router();

/**
 * Datos abiertos, sin necesidad de cuenta: es la vitrina del producto. Muestra el
 * precio del día y quién está pagando mejor, pero no la proyección ni nada
 * personalizado, que es lo que sostiene la suscripción.
 */
router.get('/market', (req, res) => {
  const price = coffeePriceService.getCurrentPrice();
  const exchangeRate = exchangeRateService.getCurrentRate();
  const comparison = cooperativeService.getComparison();

  const usdPerLb = price ? centsToUsdPerLb(price.price) : null;
  const copPerLb = usdPerLb != null && exchangeRate ? usdPerLbToCop(usdPerLb, exchangeRate.rate) : null;

  res.json({
    coffee: price
      ? {
          usdPerCarga: usdPerLb * LB_PER_CARGA,
          copPerCarga: copPerLb != null ? copPerLb * LB_PER_CARGA : null,
          source: price.source,
          provider: price.provider,
          fetchedAt: price.fetched_at,
        }
      : null,
    exchangeRate: exchangeRate
      ? { rate: exchangeRate.rate, source: exchangeRate.source, fetchedAt: exchangeRate.fetched_at }
      : null,
    fncReference: comparison.fncReference,
    cooperatives: comparison.cooperatives,
    reportedCount: comparison.reportedCount,
    disclaimer: comparison.disclaimer,
  });
});

router.get('/plans', (req, res) => {
  res.json({ plans: subscriptionService.PLANS });
});

module.exports = router;
