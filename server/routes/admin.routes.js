const express = require('express');
const userRepository = require('../repositories/userRepository');
const subscriptionService = require('../services/subscriptionService');

const router = express.Router();

router.get('/users', (req, res) => {
  res.json({ users: userRepository.listAll() });
});

/**
 * Activación manual del plan Pro. Sirve mientras el cobro sea por Nequi/Daviplata
 * o transferencia: el usuario paga, y aquí se le habilita el plan.
 */
router.post('/users/:id/activate-pro', (req, res, next) => {
  try {
    const months = parseInt(req.body.months, 10) || 1;
    const user = subscriptionService.activatePro(parseInt(req.params.id, 10), months);
    res.json({ ok: true, user });
  } catch (err) {
    next(err);
  }
});

router.post('/users/:id/cancel-pro', (req, res, next) => {
  try {
    const user = subscriptionService.cancel(parseInt(req.params.id, 10));
    res.json({ ok: true, user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
