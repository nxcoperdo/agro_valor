const userRepository = require('../repositories/userRepository');
const subscriptionService = require('../services/subscriptionService');

/** Carga el usuario completo desde la base (el JWT solo trae id/rol) y exige plan Pro. */
function requirePro(req, res, next) {
  const user = userRepository.findById(req.user.id);

  if (!user) {
    return res.status(401).json({ error: 'Sesión inválida' });
  }

  req.fullUser = user;

  if (!subscriptionService.isPro(user)) {
    return res.status(402).json({
      error: 'Esta función es parte de AgroValor Pro',
      upgradeRequired: true,
      plan: subscriptionService.describe(user),
    });
  }

  next();
}

/** Solo carga el usuario completo, sin exigir plan. */
function loadUser(req, res, next) {
  const user = userRepository.findById(req.user.id);
  if (!user) {
    return res.status(401).json({ error: 'Sesión inválida' });
  }
  req.fullUser = user;
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores' });
  }
  next();
}

module.exports = { requirePro, loadUser, requireAdmin };
