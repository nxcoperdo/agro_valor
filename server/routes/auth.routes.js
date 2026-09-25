const express = require('express');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const authService = require('../services/authService');
const subscriptionService = require('../services/subscriptionService');
const whatsappService = require('../services/whatsappService');
const userRepository = require('../repositories/userRepository');
const authMiddleware = require('../middleware/authMiddleware');
const { loadUser } = require('../middleware/requirePlan');
const { loginRateLimit, signupRateLimit } = require('../middleware/rateLimit');

const router = express.Router();

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.cookieSecure,
  maxAge: 8 * 60 * 60 * 1000,
};

const MIN_PASSWORD_LENGTH = 8;

/**
 * La app móvil no maneja cookies, así que recibe el token en el cuerpo. A la web no
 * se le entrega: allá vive solo en la cookie httpOnly, fuera del alcance de JS.
 */
function tokenForClient(req, token) {
  return req.get('X-Client') === 'mobile' ? { token } : {};
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    fullName: user.full_name,
    phone: user.phone,
    municipality: user.municipality,
    ...subscriptionService.describe(user),
  };
}

router.post('/signup', signupRateLimit, (req, res, next) => {
  try {
    if (!env.allowPublicSignup) {
      return res.status(403).json({ error: 'El registro público está desactivado' });
    }

    const { username, password, phone, fullName, municipality } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    if (String(password).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` });
    }

    const normalizedUsername = String(username).trim().toLowerCase();

    if (userRepository.findByUsername(normalizedUsername)) {
      return res.status(409).json({ error: 'Ese usuario ya está registrado' });
    }

    const normalizedPhone = phone ? whatsappService.normalizePhone(phone) : null;

    const user = userRepository.create({
      username: normalizedUsername,
      passwordHash: bcrypt.hashSync(String(password), 10),
      role: 'user',
      phone: normalizedPhone,
      fullName: fullName ? String(fullName).trim() : null,
      municipality: municipality ? String(municipality).trim() : null,
      plan: 'free',
    });

    const result = authService.login(normalizedUsername, String(password));
    res.cookie(authService.COOKIE_NAME, result.token, cookieOptions);
    res.status(201).json({ user: publicUser(user), ...tokenForClient(req, result.token) });
  } catch (err) {
    next(err);
  }
});

router.post('/login', loginRateLimit, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }

  const result = authService.login(String(username).trim().toLowerCase(), String(password));
  if (!result) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  res.cookie(authService.COOKIE_NAME, result.token, cookieOptions);
  res.json({ user: publicUser(userRepository.findById(result.user.id)), ...tokenForClient(req, result.token) });
});

router.post('/logout', (req, res) => {
  res.clearCookie(authService.COOKIE_NAME);
  res.json({ ok: true });
});

router.get('/me', authMiddleware, loadUser, (req, res) => {
  res.json({ user: publicUser(req.fullUser) });
});

module.exports = router;
