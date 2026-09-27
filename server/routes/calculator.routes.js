const express = require('express');
const netPriceService = require('../services/netPriceService');
const cooperativeService = require('../services/cooperativeService');
const subscriptionService = require('../services/subscriptionService');

const router = express.Router();

/**
 * Calcula cuánto le queda realmente al caficultor por su café y en qué cooperativa
 * le conviene más venderlo. Usa por defecto lo que el usuario tenga guardado en su
 * perfil, para que no tenga que escribir lo mismo cada vez.
 *
 * El neto contra el precio de referencia es gratis (utilidad básica). Saber en qué
 * cooperativa concreta le conviene vender es Pro: a los usuarios gratis se les
 * muestra cuánta plata se están dejando, pero no el detalle por cooperativa.
 */
router.post('/', (req, res, next) => {
  try {
    const user = req.fullUser;
    const isPro = subscriptionService.isPro(user);
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

    const response = {
      againstReference,
      referencePriceCopCarga: comparison.fncReference.priceCopCarga,
      usedProfileDefaults: {
        factor: body.factor == null || body.factor === '',
        humidity: body.humidity == null || body.humidity === '',
        transport: body.transportCostCopCarga == null || body.transportCostCopCarga === '',
      },
      isPro,
    };

    if (isPro) {
      response.byCooperative = byCooperative;
    } else if (byCooperative.length > 0) {
      const totals = byCooperative.map((c) => c.total);
      response.locked = true;
      response.cooperativesCount = byCooperative.length;
      response.maxDifferenceCop = Math.max(...totals) - Math.min(...totals);
    }

    res.json(response);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
