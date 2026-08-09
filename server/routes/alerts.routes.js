const express = require('express');
const alertRepository = require('../repositories/alertRepository');
const alertService = require('../services/alertService');
const subscriptionService = require('../services/subscriptionService');
const whatsappService = require('../services/whatsappService');
const { toIso } = require('../utils/datetime');
const { testMessageRateLimit } = require('../middleware/rateLimit');

const router = express.Router();

const VALID_TYPES = ['above', 'below', 'daily', 'weekly'];

function serialize(alert) {
  return {
    id: alert.id,
    type: alert.type,
    thresholdCopCarga: alert.threshold_cop_carga,
    active: Boolean(alert.active),
    lastTriggeredAt: toIso(alert.last_triggered_at),
    createdAt: toIso(alert.created_at),
  };
}

router.get('/', (req, res) => {
  res.json({
    alerts: alertRepository.findByUser(req.user.id).map(serialize),
    deliveries: alertRepository.recentDeliveries(req.user.id, 10).map((d) => ({
      id: d.id,
      status: d.status,
      message: d.message,
      error: d.error,
      createdAt: toIso(d.created_at),
    })),
    whatsappConfigured: whatsappService.isConfigured(),
    phone: req.fullUser.phone,
  });
});

router.post('/', (req, res, next) => {
  try {
    const { type, thresholdCopCarga } = req.body || {};

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Tipo de alerta inválido' });
    }

    if (!req.fullUser.phone) {
      return res.status(400).json({
        error: 'Primero guarda tu número de WhatsApp en tu perfil para poder recibir alertas',
      });
    }

    let threshold = null;
    if (type === 'above' || type === 'below') {
      threshold = parseFloat(thresholdCopCarga);
      if (!Number.isFinite(threshold) || threshold <= 0) {
        return res.status(400).json({ error: 'Define un precio válido por carga para la alerta' });
      }
    }

    const existing = alertRepository.findByUser(req.user.id);
    const { maxAlerts } = subscriptionService.describe(req.fullUser).limits;

    if (existing.length >= maxAlerts) {
      return res.status(400).json({ error: `Tu plan permite hasta ${maxAlerts} alertas` });
    }

    const alert = alertRepository.create({
      userId: req.user.id,
      type,
      thresholdCopCarga: threshold,
    });

    res.status(201).json(serialize(alert));
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', (req, res) => {
  const changes = alertRepository.setActive(req.params.id, req.user.id, Boolean(req.body.active));
  if (!changes) return res.status(404).json({ error: 'Alerta no encontrada' });
  res.json(serialize(alertRepository.findById(req.params.id)));
});

router.delete('/:id', (req, res) => {
  const changes = alertRepository.remove(req.params.id, req.user.id);
  if (!changes) return res.status(404).json({ error: 'Alerta no encontrada' });
  res.json({ ok: true });
});

router.post('/test', testMessageRateLimit, async (req, res, next) => {
  try {
    if (!req.fullUser.phone) {
      return res.status(400).json({ error: 'Primero guarda tu número de WhatsApp en tu perfil' });
    }

    const result = await alertService.sendTestMessage(req.fullUser);

    if (result.status === 'sent') {
      return res.json({ ok: true, message: 'Te enviamos un mensaje de prueba por WhatsApp' });
    }

    res.status(502).json({
      error:
        result.status === 'queued'
          ? 'El envío de WhatsApp todavía no está conectado en el servidor'
          : `No se pudo enviar: ${result.error}`,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
