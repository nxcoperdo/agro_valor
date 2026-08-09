const express = require('express');
const coffeePriceService = require('../services/coffeePriceService');
const marketSummaryService = require('../services/marketSummaryService');

const router = express.Router();

router.get('/current', (req, res) => {
  const summary = marketSummaryService.getMarketSummary();

  if (!summary.internal && !summary.international) {
    return res.status(503).json({ error: 'Aún no hay datos de precio disponibles' });
  }

  res.json(summary);
});

router.get('/history', (req, res) => {
  const days = Math.min(parseInt(req.query.days, 10) || 30, 365);

  // El histórico va en su unidad original (centavos por libra), sin conversiones.
  res.json(
    coffeePriceService.getHistory(days).map((row) => ({
      centsPerLb: row.price,
      usdPerLb: row.price / 100,
      source: row.source,
      quotedAt: row.quoted_at,
      fetchedAt: row.fetched_at,
    }))
  );
});

module.exports = router;
