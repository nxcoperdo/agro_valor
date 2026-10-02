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

const TRIAL_DAYS = 7;
const TRIAL_MARGIN_MS = 60 * 1000;

/**
 * true solo mientras el Pro actual viene de la prueba gratis del registro, no de un pago
 * real. No hace falta una columna aparte de "ya pagó": si el usuario paga Pro de verdad
 * antes de que acabe el trial, activatePro empuja plan_expires_at mucho más allá de la
 * ventana trial_granted_at + 7 días, y esto pasa a false solo.
 */
function isTrialing(user) {
  if (!user || !user.trial_granted_at) return false;
  if (!isPro(user)) return false;
  const trialEnd = toEpoch(user.trial_granted_at) + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  return toEpoch(user.plan_expires_at) <= trialEnd + TRIAL_MARGIN_MS;
}

function describe(user) {
  const pro = isPro(user);
  return {
    plan: pro ? 'pro' : 'free',
    isPro: pro,
    isTrialing: isTrialing(user),
    expiresAt: user ? toIso(user.plan_expires_at) : null,
    limits: pro ? PLANS.pro : PLANS.free,
  };
}

/** Prueba gratis de Pro al registrarse — ver auth.routes.js (POST /signup). */
function startTrial(userId) {
  const now = Date.now();
  const expiresAt = new Date(now + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  const grantedAt = new Date(now).toISOString().replace('T', ' ').slice(0, 19);

  logger.info(`Prueba gratis de Pro (${TRIAL_DAYS} días) activada para el usuario ${userId} hasta ${expiresAt}`);
  return userRepository.startTrial(userId, { expiresAt, grantedAt });
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

/**
 * Activa Pro con la fecha exacta de vencimiento que da Google Play (a diferencia de
 * activatePro, que suma meses a mano para la activación manual de Nequi/Daviplata).
 */
function setProUntil(userId, expiresAtIso) {
  const expiresAt = new Date(expiresAtIso).toISOString().replace('T', ' ').slice(0, 19);
  return userRepository.setPlan(userId, 'pro', expiresAt);
}

module.exports = { PLANS, isPro, isTrialing, describe, activatePro, startTrial, cancel, setProUntil };
