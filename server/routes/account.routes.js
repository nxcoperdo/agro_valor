const express = require('express');
const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/userRepository');
const subscriptionService = require('../services/subscriptionService');
const whatsappService = require('../services/whatsappService');
const authService = require('../services/authService');
const mercadoPagoBillingService = require('../services/mercadoPagoBillingService');
const pushDeviceRepository = require('../repositories/pushDeviceRepository');

const router = express.Router();

const MIN_PASSWORD_LENGTH = 8;

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
    mpPaymentPending: user.mp_payment_status === 'pending',
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

/** Cambiar la contraseña estando logueado (distinto del flujo de "olvidé mi contraseña"). */
router.put('/password', (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !bcrypt.compareSync(String(currentPassword), req.fullUser.password_hash)) {
      return res.status(401).json({ error: 'La contraseña actual no es correcta' });
    }

    if (!newPassword || String(newPassword).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `La contraseña nueva debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` });
    }

    userRepository.setPasswordHash(req.user.id, bcrypt.hashSync(String(newPassword), 10));
    res.json({ ok: true });
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

/**
 * Crea la preferencia de pago (Checkout Pro) y devuelve la URL de checkout. La web
 * redirige el navegador a esta URL; la app abre esa misma URL en el navegador externo.
 */
router.post('/mercadopago/pay', async (req, res, next) => {
  try {
    const { initPoint } = await mercadoPagoBillingService.startPayment(req.user.id);
    res.json({ initPoint });
  } catch (err) {
    next(err);
  }
});

/** Se llama cuando el usuario vuelve del checkout de Mercado Pago (web o navegador de la app). */
router.post('/mercadopago/confirm', async (req, res, next) => {
  try {
    const user = await mercadoPagoBillingService.confirmPayment(req.user.id);
    res.json(serialize(user));
  } catch (err) {
    next(err);
  }
});

/**
 * Elimina la cuenta por completo. Pide la contraseña actual porque es irreversible.
 * Los admin no pueden borrarse por aquí, para no dejar la app sin nadie que administre.
 */
router.delete('/', (req, res) => {
  const { password } = req.body || {};

  if (!password || !bcrypt.compareSync(String(password), req.fullUser.password_hash)) {
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }

  if (req.fullUser.role === 'admin') {
    return res.status(403).json({ error: 'No puedes eliminar una cuenta de administrador desde aquí' });
  }

  userRepository.deleteById(req.user.id);
  res.clearCookie(authService.COOKIE_NAME);
  res.json({ ok: true });
});

module.exports = router;
