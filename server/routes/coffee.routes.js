const express = require('express');
const { requirePermission } = require('../middleware/requireBusiness');
const supplierService = require('../services/supplierService');
const purchaseService = require('../services/purchaseService');

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

module.exports = router;
