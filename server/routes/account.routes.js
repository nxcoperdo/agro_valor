const express = require('express');
const userRepository = require('../repositories/userRepository');
const subscriptionService = require('../services/subscriptionService');
const whatsappService = require('../services/whatsappService');

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
    ...subscriptionService.describe(user),
  };
}

router.get('/profile', (req, res) => {
  res.json(serialize(req.fullUser));
});

router.put('/profile', (req, res, next) => {
  try {
    const { fullName, phone, municipality, defaultFactor, defaultHumidity, transportCostCopCarga } = req.body || {};

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
    });

    res.json(serialize(userRepository.findById(req.user.id)));
  } catch (err) {
    next(err);
  }
});

router.get('/plan', (req, res) => {
  res.json({
    ...subscriptionService.describe(req.fullUser),
    plans: subscriptionService.PLANS,
  });
});

module.exports = router;
