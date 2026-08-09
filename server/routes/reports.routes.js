const express = require('express');
const priceReportService = require('../services/priceReportService');

const router = express.Router();

/** Reportar cuánto pagó realmente una cooperativa: es lo que alimenta los precios reales. */
router.post('/', (req, res, next) => {
  try {
    const report = priceReportService.createReport(req.user.id, req.body || {});
    res.status(201).json({
      ok: true,
      report,
      message: `Gracias por reportar. Con ${priceReportService.MIN_REPORTERS} reportes de caficultores distintos, el precio de esa cooperativa deja de ser estimado y pasa a ser un dato real para todos.`,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/mine', (req, res) => {
  res.json({ reports: priceReportService.getMyReports(req.user.id) });
});

module.exports = router;
