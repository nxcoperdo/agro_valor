const express = require('express');
const salesService = require('../services/salesService');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(salesService.getHistory(req.user.id));
});

router.post('/', (req, res, next) => {
  try {
    const sale = salesService.recordSale(req.user.id, req.body || {});
    res.status(201).json(sale);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    salesService.deleteSale(req.user.id, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
