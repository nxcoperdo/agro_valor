const express = require('express');
const netPriceService = require('../services/netPriceService');
const cooperativeService = require('../services/cooperativeService');
const cocoaNetPriceService = require('../services/cocoaNetPriceService');
const marketSummaryService = require('../services/marketSummaryService');
const cocoaReferenceService = require('../services/cocoaReferenceService');

const router = express.Router();

/**
 * Calcula cuánto le queda realmente al caficultor por su café y en qué cooperativa
 * le conviene más venderlo. Usa por defecto lo que el usuario tenga guardado en su
 * perfil, para que no tenga que escribir lo mismo cada vez.
 *
 * Exclusivo de Pro (gating real en el middleware requirePro de app.js, no aquí).
 */
router.post('/', (req, res, next) => {
  try {
    const user = req.fullUser;
    const body = req.body || {};

    const input = {
      factor: body.factor != null && body.factor !== '' ? body.factor : user.default_factor,
      humidity: body.humidity != null && body.humidity !== '' ? body.humidity : user.default_humidity,
      pasillaPct: body.pasillaPct,
      cargas: body.cargas,
      transportCostCopCarga:
        body.transportCostCopCarga != null && body.transportCostCopCarga !== ''
          ? body.transportCostCopCarga
          : user.transport_cost_cop_carga,
    };

    const comparison = cooperativeService.getComparison();

    if (!comparison.fncReference) {
      return res.status(503).json({ error: 'Aún no hay un precio de referencia disponible para calcular' });
    }

    const againstReference = netPriceService.calculate({
      ...input,
      basePriceCopCarga: comparison.fncReference.priceCopCarga,
    });

    const byCooperative = netPriceService.compareAcrossCooperatives(comparison.cooperatives, input);

    res.json({
      againstReference,
      referencePriceCopCarga: comparison.fncReference.priceCopCarga,
      // El café sigue calculando con un precio viejo (la fuente FNC suele cargarse a mano), pero se avisa.
      referenceIsStale: comparison.fncReference.isStale,
      referenceScrapedAt: comparison.fncReference.scrapedAt,
      usedProfileDefaults: {
        factor: body.factor == null || body.factor === '',
        humidity: body.humidity == null || body.humidity === '',
        transport: body.transportCostCopCarga == null || body.transportCostCopCarga === '',
      },
      byCooperative,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Precio neto del cacao en COP por kilo. Referencia: precio semanal de Agronet (respaldo: ICE
 * convertido con la TRM). También exclusivo de Pro (mismo middleware que la calculadora de café).
 */
router.post('/cocoa', (req, res, next) => {
  try {
    const body = req.body || {};
    const summary = marketSummaryService.getMarketSummary('cocoa');
    const iceCopPerKg = summary.international ? summary.international.copPerKg : null;
    const reference = cocoaReferenceService.getLatest();
    const referenceCopPerKg = reference && !reference.isStale ? reference.priceCopKg : null;

    if (!referenceCopPerKg && !iceCopPerKg) {
      return res.status(503).json({ error: 'Aún no hay un precio de referencia del cacao disponible para calcular' });
    }

    res.json({
      ...cocoaNetPriceService.calculate({
        referenceCopPerKg,
        iceCopPerKg,
        kg: body.kg,
        humidity: body.humidity,
        defectPct: body.defectPct,
        fermented: body.fermented,
        buyerDiscountPct: body.buyerDiscountPct,
        transportCostCopKg: body.transportCostCopKg,
      }),
      referenceWeekLabel: referenceCopPerKg ? reference.weekLabel : null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
