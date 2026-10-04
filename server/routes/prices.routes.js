const express = require('express');
const coffeePriceService = require('../services/coffeePriceService');
const marketSummaryService = require('../services/marketSummaryService');
const { toIso } = require('../utils/datetime');
const { isValidMarket, DEFAULT_MARKET } = require('../config/markets');

const router = express.Router();

/** Lee ?market= (café si no viene). Responde 400 y devuelve null si el mercado no existe. */
function readMarket(req, res) {
  const market = req.query.market || DEFAULT_MARKET;
  if (!isValidMarket(market)) {
    res.status(400).json({ error: 'Mercado no soportado' });
    return null;
  }
  return market;
}

router.get('/current', (req, res) => {
  const market = readMarket(req, res);
  if (!market) return;
  const summary = marketSummaryService.getMarketSummary(market);

  if (!summary.internal && !summary.international) {
    return res.status(503).json({ error: 'Aún no hay datos de precio disponibles' });
  }

  res.json(summary);
});

router.get('/history', (req, res) => {
  const market = readMarket(req, res);
  if (!market) return;
  const days = Math.min(parseInt(req.query.days, 10) || 30, 365);

  // El histórico va en su unidad original, sin conversiones: café en centavos por libra y
  // cacao en USD por tonelada (campo usdPerTonne).
  res.json(
    coffeePriceService.getHistory(days, market).map((row) => ({
      ...(market === 'cocoa'
        ? { usdPerTonne: row.price }
        : { centsPerLb: row.price, usdPerLb: row.price / 100 }),
      source: row.source,
      quotedAt: toIso(row.quoted_at),
      fetchedAt: toIso(row.fetched_at),
    }))
  );
});

module.exports = router;
