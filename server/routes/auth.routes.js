const express = require('express');
const env = require('../config/env');
const authService = require('../services/authService');
const authMiddleware = require('../middleware/authMiddleware');
const { loginRateLimit } = require('../middleware/rateLimit');

const router = express.Router();

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.cookieSecure,
  maxAge: 8 * 60 * 60 * 1000,
};

router.post('/login', loginRateLimit, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }

  const result = authService.login(username, password);
  if (!result) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  res.cookie(authService.COOKIE_NAME, result.token, cookieOptions);
  res.json({ user: result.user });
});

router.post('/logout', (req, res) => {
  res.clearCookie(authService.COOKIE_NAME);
  res.json({ ok: true });
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
