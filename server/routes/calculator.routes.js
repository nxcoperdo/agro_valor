const express = require('express');
const netPriceService = require('../services/netPriceService');
const cooperativeService = require('../services/cooperativeService');

const router = express.Router();

/**
 * Calcula cuánto le queda realmente al caficultor por su café y en qué cooperativa
 * le conviene más venderlo. Usa por defecto lo que el usuario tenga guardado en su
 * perfil, para que no tenga que escribir lo mismo cada vez.
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
      byCooperative,
      referencePriceCopCarga: comparison.fncReference.priceCopCarga,
      usedProfileDefaults: {
        factor: body.factor == null || body.factor === '',
        humidity: body.humidity == null || body.humidity === '',
        transport: body.transportCostCopCarga == null || body.transportCostCopCarga === '',
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
