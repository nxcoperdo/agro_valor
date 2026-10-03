const express = require('express');
const { requirePermission } = require('../middleware/requireBusiness');
const supplierService = require('../services/supplierService');
const purchaseService = require('../services/purchaseService');
const purchaseCostService = require('../services/purchaseCostService');
const projectionService = require('../services/projectionService');
const quickCalcService = require('../services/quickCalcService');
const lotService = require('../services/lotService');
const processingService = require('../services/processingService');
const receiptService = require('../services/receiptService');
const workdayService = require('../services/workdayService');

const router = express.Router();

/** Contexto que usan los servicios: negocio, usuario y rol dentro del negocio. */
const ctxOf = (req) => ({ businessId: req.business.businessId, userId: req.user.id, role: req.business.role });

const wrap = (fn) => (req, res, next) => {
  try {
    res.status(fn.status || 200).json(fn(req));
  } catch (err) {
    if (err.supplier) return res.status(err.status || 409).json({ error: err.message, supplier: err.supplier });
    next(err);
  }
};
const created = (fn) => Object.assign((req) => fn(req), { status: 201 });

router.get('/me', wrap((req) => ({ businessId: req.business.businessId, role: req.business.role, name: req.business.name })));

router.get('/suppliers', wrap((req) => ({ suppliers: supplierService.search(ctxOf(req), req.query.q) })));
router.post('/suppliers', requirePermission('registrar'), wrap(created((req) => supplierService.create(ctxOf(req), req.body || {}))));

router.get('/purchases', wrap((req) => ({ purchases: purchaseService.list(ctxOf(req), req.query) })));
router.post('/purchases', requirePermission('registrar'), wrap(created((req) => purchaseService.create(ctxOf(req), req.body || {}))));
router.get('/purchases/:id', wrap((req) => purchaseService.get(ctxOf(req), req.params.id)));
router.post('/purchases/:id/void', wrap((req) => purchaseService.voidPurchase(ctxOf(req), req.params.id, (req.body || {}).reason)));

router.get('/purchases/:id/costs', wrap((req) => purchaseCostService.list(ctxOf(req), req.params.id)));
router.post('/purchases/:id/costs', wrap(created((req) => purchaseCostService.add(ctxOf(req), req.params.id, req.body || {}))));
router.delete('/purchases/:id/costs/:costId', wrap((req) => purchaseCostService.remove(ctxOf(req), req.params.id, req.params.costId)));
router.get('/purchases/:id/projection', wrap((req) => projectionService.get(ctxOf(req), req.params.id)));
router.put('/purchases/:id/projection', wrap((req) => projectionService.save(ctxOf(req), req.params.id, req.body || {})));
router.post('/calculator', wrap((req) => quickCalcService.calculate(req.body || {})));
router.post('/calculator/compare', wrap((req) => quickCalcService.compare(req.body || {})));
router.get('/lots', wrap((req) => ({ lots: lotService.list(ctxOf(req)) })));
router.post('/lots', wrap(created((req) => lotService.create(ctxOf(req), req.body || {}))));
router.get('/lots/:id', wrap((req) => lotService.detail(ctxOf(req), req.params.id)));
router.post('/lots/:id/status', wrap((req) => lotService.changeStatus(ctxOf(req), req.params.id, (req.body || {}).status)));
router.delete('/lots/:id/purchases/:purchaseId', wrap((req) => lotService.removePurchase(ctxOf(req), req.params.id, req.params.purchaseId)));
router.get('/lots/:id/processing', wrap((req) => processingService.get(ctxOf(req), req.params.id)));
router.put('/lots/:id/processing', wrap((req) => processingService.saveShipment(ctxOf(req), req.params.id, req.body || {})));
router.post('/lots/:id/processing/costs', wrap(created((req) => processingService.addCost(ctxOf(req), req.params.id, req.body || {}))));
router.delete('/lots/:id/processing/costs/:costId', wrap((req) => processingService.removeCost(ctxOf(req), req.params.id, req.params.costId)));
router.post('/lots/:id/processing/finish', wrap((req) => processingService.finish(ctxOf(req), req.params.id, req.body || {})));
router.get('/business', wrap((req) => receiptService.businessInfo(req.business.businessId)));
router.put('/business', requirePermission('gestionar_equipo'), wrap((req) => receiptService.updateBusiness(ctxOf(req), req.body || {})));
router.get('/purchases/:id/receipt', wrap((req) => receiptService.build(ctxOf(req), req.params.id)));
router.get('/purchases/:id/receipt.pdf', async (req, res, next) => {
  try {
    const buffer = await receiptService.pdf(ctxOf(req), req.params.id);
    const code = receiptService.build(ctxOf(req), req.params.id).code;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${req.query.download ? 'attachment' : 'inline'}; filename="${code}.pdf"`,
    });
    res.send(buffer);
  } catch (err) { next(err); }
});

router.get('/workdays', wrap((req) => ({ workdays: workdayService.list(ctxOf(req)) })));
router.get('/workdays/current', wrap((req) => workdayService.current(ctxOf(req))));
router.get('/workdays/:id', wrap((req) => workdayService.get(ctxOf(req), req.params.id)));
router.post('/workdays/:id/close', wrap((req) => workdayService.closeWorkday(ctxOf(req), req.params.id)));
router.get('/day-summary.pdf', async (req, res, next) => {
  try {
    const date = req.query.date || undefined;
    const buffer = await workdayService.daySummaryPdf(ctxOf(req), date);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `${req.query.download ? 'attachment' : 'inline'}; filename="resumen-dia.pdf"` });
    res.send(buffer);
  } catch (err) { next(err); }
});
router.get('/day-summary', wrap((req) => workdayService.daySummary(ctxOf(req), req.query.date)));

module.exports = router;
