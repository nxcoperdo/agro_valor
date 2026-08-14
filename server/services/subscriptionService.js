const userRepository = require('../repositories/userRepository');
const { toIso, toEpoch } = require('../utils/datetime');
const logger = require('../utils/logger');

const PLANS = {
  free: {
    id: 'free',
    name: 'Gratis',
    maxAlerts: 0,
    features: ['Precio de referencia FNC del día', 'Dólar y cotización internacional', 'Ranking general de cooperativas'],
  },
  pro: {
    id: 'pro',
    name: 'AgroValor Pro',
    maxAlerts: 10,
    features: [
      'Alertas por WhatsApp cuando el precio te convenga',
      'Calculadora de precio neto con tu factor y humedad',
      'Comparación de cuánto te queda en cada cooperativa',
      'Proyección en calendario: día a día, semana a semana y mes a mes',
      'Historial de tus ventas',
    ],
  },
};

/** Un plan pro vencido cuenta como gratis; los admin siempre tienen todo. */
function isPro(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.plan !== 'pro') return false;
  if (!user.plan_expires_at) return true;
  return toEpoch(user.plan_expires_at) > Date.now();
}

function describe(user) {
  const pro = isPro(user);
  return {
    plan: pro ? 'pro' : 'free',
    isPro: pro,
    expiresAt: user ? toIso(user.plan_expires_at) : null,
    limits: pro ? PLANS.pro : PLANS.free,
  };
}

function activatePro(userId, months = 1) {
  const user = userRepository.findById(userId);
  if (!user) {
    throw Object.assign(new Error('Usuario no encontrado'), { status: 404 });
  }

  // Si todavía tiene tiempo vigente, se le suma; si no, arranca desde hoy.
  const currentExpiry = user.plan_expires_at ? toEpoch(user.plan_expires_at) : 0;
  const startFrom = Math.max(currentExpiry, Date.now());
  const expiresAt = new Date(startFrom + months * 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);

  logger.info(`Plan Pro activado para el usuario ${user.username} hasta ${expiresAt}`);
  return userRepository.setPlan(userId, 'pro', expiresAt);
}

function cancel(userId) {
  return userRepository.setPlan(userId, 'free', null);
}

module.exports = { PLANS, isPro, describe, activatePro, cancel };
