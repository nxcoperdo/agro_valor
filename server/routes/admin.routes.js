const express = require('express');
const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/userRepository');
const cooperativeRepository = require('../repositories/cooperativeRepository');
const priceReportRepository = require('../repositories/priceReportRepository');
const subscriptionService = require('../services/subscriptionService');
const cooperativeService = require('../services/cooperativeService');

const MIN_PASSWORD_LENGTH = 8;

const router = express.Router();

router.get('/users', (req, res) => {
  res.json({ users: userRepository.listAll() });
});

/**
 * Fallback manual de "olvidé mi contraseña": para usuarios sin WhatsApp registrado,
 * o mientras la plantilla de WhatsApp de recuperación no esté aprobada por Meta.
 */
router.post('/users/:id/reset-password', (req, res, next) => {
  try {
    const { newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` });
    }
    const user = userRepository.setPasswordHash(parseInt(req.params.id, 10), bcrypt.hashSync(String(newPassword), 10));
    res.json({ ok: true, user });
  } catch (err) {
    next(err);
  }
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

router.get('/cooperatives', (req, res) => {
  res.json({ cooperatives: cooperativeRepository.findAll() });
});

router.post('/cooperatives', (req, res, next) => {
  try {
    const { name, region, municipality, differentialPct } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'El nombre de la cooperativa es requerido' });
    }
    const coop = cooperativeRepository.create({
      name: String(name).trim(),
      region,
      municipality,
      differentialPct: differentialPct != null ? parseFloat(differentialPct) : 0,
    });
    res.status(201).json({ cooperative: coop });
  } catch (err) {
    next(err);
  }
});

router.put('/cooperatives/:id', (req, res, next) => {
  try {
    const { name, region, municipality, differentialPct, active } = req.body || {};
    const coop = cooperativeRepository.update(parseInt(req.params.id, 10), {
      name: name != null ? String(name).trim() : null,
      region,
      municipality,
      differentialPct: differentialPct != null && differentialPct !== '' ? parseFloat(differentialPct) : null,
      active: active == null ? null : Boolean(active),
    });
    if (!coop) {
      return res.status(404).json({ error: 'Cooperativa no encontrada' });
    }
    res.json({ cooperative: coop });
  } catch (err) {
    next(err);
  }
});

router.get('/reports', (req, res) => {
  res.json({ reports: priceReportRepository.findRecent(100) });
});

router.delete('/reports/:id', (req, res, next) => {
  try {
    priceReportRepository.deleteById(parseInt(req.params.id, 10));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/metrics', (req, res) => {
  const users = userRepository.listAll(1000);
  const comparison = cooperativeService.getComparison();

  res.json({
    totalUsers: users.length,
    proUsers: users.filter((u) => u.plan === 'pro').length,
    reportsToday: priceReportRepository.countAllToday(),
    reportsLast7d: priceReportRepository.countAllRecent(7),
    cooperativesCount: comparison.cooperatives.length,
    reportedCooperativesCount: comparison.reportedCount || 0,
  });
});

module.exports = router;
