const express = require('express');
const alertRepository = require('../repositories/alertRepository');
const alertService = require('../services/alertService');
const subscriptionService = require('../services/subscriptionService');
const whatsappService = require('../services/whatsappService');
const pushService = require('../services/pushService');
const pushDeviceRepository = require('../repositories/pushDeviceRepository');
const { toIso } = require('../utils/datetime');
const { testMessageRateLimit } = require('../middleware/rateLimit');
const { isValidMarket, DEFAULT_MARKET } = require('../config/markets');

const router = express.Router();

const VALID_TYPES = ['above', 'below', 'daily', 'weekly'];

const NO_CHANNEL_ERROR =
  'No tienes por dónde recibir alertas: guarda tu número de WhatsApp o activa las notificaciones en la app';

function channelInput(req) {
  return {
    userId: req.user.id,
    phone: req.fullUser.phone,
    notifyWhatsapp: req.fullUser.notify_whatsapp !== 0,
    notifyPush: req.fullUser.notify_push !== 0,
  };
}

function serialize(alert) {
  return {
    id: alert.id,
    type: alert.type,
    market: alert.market || DEFAULT_MARKET,
    // Umbral en la unidad del mercado: COP/carga en café, COP/kg en cacao.
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
      channel: d.channel,
      createdAt: toIso(d.created_at),
    })),
    whatsappConfigured: whatsappService.isConfigured(),
    pushConfigured: pushService.isConfigured(),
    phone: req.fullUser.phone,
    deviceCount: pushDeviceRepository.countForUser(req.user.id),
    notifyWhatsapp: req.fullUser.notify_whatsapp !== 0,
    notifyPush: req.fullUser.notify_push !== 0,
  });
});

router.post('/', (req, res, next) => {
  try {
    const { type, thresholdCopCarga, market = DEFAULT_MARKET } = req.body || {};

    if (!isValidMarket(market)) {
      return res.status(400).json({ error: 'Mercado no soportado' });
    }

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Tipo de alerta inválido' });
    }

    const channels = alertService.channelsFor(channelInput(req));
    if (channels.length === 0) {
      return res.status(400).json({ error: NO_CHANNEL_ERROR });
    }

    if (market === 'cocoa') {
      if (type !== 'above' && type !== 'below') {
        return res.status(400).json({ error: 'Para cacao solo hay alertas de precio (sube o baja de un valor)' });
      }
      if (!channels.includes('push')) {
        return res.status(400).json({ error: 'Las alertas de cacao llegan por notificación en la app: actívalas primero' });
      }
    }

    let threshold = null;
    if (type === 'above' || type === 'below') {
      threshold = parseFloat(thresholdCopCarga);
      if (!Number.isFinite(threshold) || threshold <= 0) {
        return res
          .status(400)
          .json({ error: `Define un precio válido por ${market === 'cocoa' ? 'kilo' : 'carga'} para la alerta` });
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
      market,
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
    if (alertService.channelsFor(channelInput(req)).length === 0) {
      return res.status(400).json({ error: NO_CHANNEL_ERROR });
    }

    const { status, results } = await alertService.sendTestMessage(req.fullUser);
    const names = { whatsapp: 'WhatsApp', push: 'notificación en la app' };
    const describe = (r) =>
      r.status === 'queued' ? `${names[r.channel]}: todavía no está conectado en el servidor` : `${names[r.channel]}: ${r.error}`;

    if (status === 'sent') {
      const sentBy = results.filter((r) => r.status === 'sent').map((r) => names[r.channel]);
      const failed = results.filter((r) => r.status !== 'sent').map(describe);
      return res.json({
        ok: true,
        message: `Te enviamos un mensaje de prueba por ${sentBy.join(' y ')}${failed.length ? `. No llegó por ${failed.join('; ')}` : ''}`,
        results,
      });
    }

    res.status(502).json({ error: `No se pudo enviar. ${results.map(describe).join('. ')}`, results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
