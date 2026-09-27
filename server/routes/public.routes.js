const express = require('express');
const marketSummaryService = require('../services/marketSummaryService');
const cooperativeService = require('../services/cooperativeService');
const subscriptionService = require('../services/subscriptionService');
const legalContentService = require('../services/legalContentService');

const router = express.Router();

/**
 * Datos abiertos, sin necesidad de cuenta: es la vitrina del producto. Muestra el
 * precio del día y quién está pagando mejor, pero no la proyección ni nada
 * personalizado, que es lo que sostiene la suscripción.
 */
router.get('/market', (req, res) => {
  const summary = marketSummaryService.getMarketSummary();
  const comparison = cooperativeService.getComparison();

  res.json({
    ...summary,
    fncReference: comparison.fncReference,
    cooperatives: comparison.cooperatives,
    reportedCount: comparison.reportedCount,
    disclaimer: comparison.disclaimer,
  });
});

router.get('/plans', (req, res) => {
  res.json({ plans: subscriptionService.PLANS });
});

router.get('/legal/privacy', (req, res) => {
  res.json(legalContentService.getPrivacyPolicy());
});

router.get('/legal/terms', (req, res) => {
  res.json(legalContentService.getTermsOfService());
});

router.get('/legal/cookies', (req, res) => {
  res.json(legalContentService.getCookiePolicy());
});

module.exports = router;
