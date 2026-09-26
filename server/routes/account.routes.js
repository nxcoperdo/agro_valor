const express = require('express');
const userRepository = require('../repositories/userRepository');
const subscriptionService = require('../services/subscriptionService');
const whatsappService = require('../services/whatsappService');
const pushDeviceRepository = require('../repositories/pushDeviceRepository');

const router = express.Router();

function serialize(user) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    phone: user.phone,
    municipality: user.municipality,
    defaultFactor: user.default_factor,
    defaultHumidity: user.default_humidity,
    transportCostCopCarga: user.transport_cost_cop_carga,
    notifyWhatsapp: user.notify_whatsapp !== 0,
    notifyPush: user.notify_push !== 0,
    ...subscriptionService.describe(user),
  };
}

router.get('/profile', (req, res) => {
  res.json(serialize(req.fullUser));
});

router.put('/profile', (req, res, next) => {
  try {
    const { fullName, phone, municipality, defaultFactor, defaultHumidity, transportCostCopCarga, notifyWhatsapp, notifyPush } =
      req.body || {};

    const normalizedPhone = phone ? whatsappService.normalizePhone(phone) : null;
    if (phone && !normalizedPhone) {
      return res.status(400).json({ error: 'El número de WhatsApp no parece válido' });
    }

    userRepository.updateProfile(req.user.id, {
      fullName: fullName != null && fullName !== '' ? String(fullName).trim() : null,
      phone: normalizedPhone,
      municipality: municipality != null && municipality !== '' ? String(municipality).trim() : null,
      defaultFactor: defaultFactor != null && defaultFactor !== '' ? parseFloat(defaultFactor) : null,
      defaultHumidity: defaultHumidity != null && defaultHumidity !== '' ? parseFloat(defaultHumidity) : null,
      transportCostCopCarga:
        transportCostCopCarga != null && transportCostCopCarga !== '' ? parseFloat(transportCostCopCarga) : null,
      notifyWhatsapp: typeof notifyWhatsapp === 'boolean' ? notifyWhatsapp : null,
      notifyPush: typeof notifyPush === 'boolean' ? notifyPush : null,
    });

    res.json(serialize(userRepository.findById(req.user.id)));
  } catch (err) {
    next(err);
  }
});

/** La app registra aquí el token de Firebase del teléfono para recibir notificaciones push. */
router.post('/devices', (req, res) => {
  const { token, platform } = req.body || {};
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) {
    return res.status(400).json({ error: 'Token de dispositivo inválido' });
  }
  pushDeviceRepository.upsert({
    userId: req.user.id,
    token,
    platform: typeof platform === 'string' ? platform.slice(0, 20) : null,
  });
  res.status(201).json({ ok: true });
});

/** Al cerrar sesión la app borra su token, para que ese teléfono deje de recibir avisos de esta cuenta. */
router.delete('/devices', (req, res) => {
  const { token } = req.body || {};
  if (typeof token === 'string') pushDeviceRepository.remove(token, req.user.id);
  res.json({ ok: true });
});

router.get('/plan', (req, res) => {
  res.json({
    ...subscriptionService.describe(req.fullUser),
    plans: subscriptionService.PLANS,
  });
});

module.exports = router;
