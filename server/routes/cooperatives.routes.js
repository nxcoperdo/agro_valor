const express = require('express');
const cooperativeService = require('../services/cooperativeService');
const { isValidMarket, DEFAULT_MARKET } = require('../config/markets');

const router = express.Router();

router.get('/', (req, res) => {
  const market = req.query.market || DEFAULT_MARKET;
  if (!isValidMarket(market)) return res.status(400).json({ error: 'Mercado no soportado' });
  res.json(cooperativeService.getComparison(market));
});

module.exports = router;
