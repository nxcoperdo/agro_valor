const express = require('express');
const marketSummaryService = require('../services/marketSummaryService');
const cooperativeService = require('../services/cooperativeService');
const subscriptionService = require('../services/subscriptionService');
const legalContentService = require('../services/legalContentService');
const mercadoPagoService = require('../services/mercadoPagoService');
const mercadoPagoBillingService = require('../services/mercadoPagoBillingService');

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

router.get('/legal/dmca', (req, res) => {
  res.json(legalContentService.getDmcaPolicy());
});

router.get('/legal/cookies', (req, res) => {
  res.json(legalContentService.getCookiePolicy());
});

/**
 * Notificación de Mercado Pago (pago único de Checkout Pro). El cron diario
 * (mercadoPagoBillingService.reconcile) es el respaldo por si esta notificación no llega.
 */
router.post('/webhooks/mercadopago', async (req, res) => {
  const dataId = req.query['data.id'];
  const ok = mercadoPagoService.verifyWebhookSignature(req.headers['x-signature'], req.headers['x-request-id'], dataId);

  if (!ok) {
    return res.status(401).json({ error: 'Firma inválida' });
  }

  res.json({ ok: true });
  mercadoPagoBillingService.handleWebhookEvent(req.body || {}).catch(() => {});
});

module.exports = router;
