const express = require('express');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const authService = require('../services/authService');
const subscriptionService = require('../services/subscriptionService');
const whatsappService = require('../services/whatsappService');
const userRepository = require('../repositories/userRepository');
const { canonicalDepartment } = require('../config/departments');
const authMiddleware = require('../middleware/authMiddleware');
const { loadUser } = require('../middleware/requirePlan');
const { loginRateLimit, signupRateLimit, passwordResetRateLimit } = require('../middleware/rateLimit');
const passwordResetService = require('../services/passwordResetService');

const router = express.Router();

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.cookieSecure,
  maxAge: 8 * 60 * 60 * 1000,
};

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * La app móvil no maneja cookies, así que recibe el token en el cuerpo. A la web no
 * se le entrega: allá vive solo en la cookie httpOnly, fuera del alcance de JS.
 */
function isMobile(req) {
  return req.get('X-Client') === 'mobile';
}

function tokenForClient(req, token) {
  return isMobile(req) ? { token } : {};
}

const MIN_AGE = 18;

/** Edad cumplida a hoy según 'YYYY-MM-DD'; null si la fecha no existe. */
function ageFromBirthDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!m) return null;
  const [, y, mo, d] = m.map(Number);
  const birth = new Date(Date.UTC(y, mo - 1, d));
  if (birth.getUTCFullYear() !== y || birth.getUTCMonth() !== mo - 1 || birth.getUTCDate() !== d) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - y;
  if (now.getUTCMonth() + 1 < mo || (now.getUTCMonth() + 1 === mo && now.getUTCDate() < d)) age -= 1;
  return age;
}

const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;

/** La app siempre recuerda la sesión; en la web solo si marcaron "Recordarme". */
function wantsRemember(req) {
  return isMobile(req) || req.body?.remember === true;
}

function setSessionCookie(res, token, remember) {
  res.cookie(authService.COOKIE_NAME, token, remember ? { ...cookieOptions, maxAge: REMEMBER_MS } : cookieOptions);
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    fullName: user.full_name,
    phone: user.phone,
    municipality: user.municipality,
    department: user.department,
    ...subscriptionService.describe(user),
  };
}

router.post('/signup', signupRateLimit, (req, res, next) => {
  try {
    if (!env.allowPublicSignup) {
      return res.status(403).json({ error: 'El registro público está desactivado' });
    }

    const { email, password, phone, fullName, municipality, department, birthDate } = req.body || {};

    // Verificación de edad (COPPA / Ley 1581): solo mayores de edad. La fecha NO se guarda,
    // solo la constancia de que se verificó (users.age_verified_at).
    const age = ageFromBirthDate(birthDate);
    if (age === null || age < 0 || age > 120) {
      return res.status(400).json({ error: 'Indica tu fecha de nacimiento' });
    }
    if (age < MIN_AGE) {
      return res.status(403).json({ error: `Debes tener al menos ${MIN_AGE} años para crear una cuenta` });
    }

    if (!password) {
      return res.status(400).json({ error: 'La contraseña es requerida' });
    }

    if (String(password).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` });
    }

    // El correo hace de usuario: es lo único que garantiza una identidad única sin
    // pedirle al caficultor que invente o recuerde un usuario aparte, y de paso es el
    // dato que necesita Mercado Pago como payer_email — antes se generaba uno técnico
    // (usuario@pagos.agrovalor.co) que no correspondía a nadie, y eso es justo lo que
    // hacía fallar el checkout con "el correo no coincide con la cuenta".
    const normalizedEmail = email ? String(email).trim().toLowerCase() : '';
    if (!normalizedEmail || !EMAIL_RE.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Escribe un correo válido' });
    }

    if (!phone) {
      return res.status(400).json({ error: 'El número de WhatsApp es requerido' });
    }

    const normalizedPhone = whatsappService.normalizePhone(phone);
    if (!normalizedPhone) {
      return res.status(400).json({ error: 'El número de WhatsApp no parece válido' });
    }

    if (userRepository.findByUsername(normalizedEmail)) {
      return res.status(409).json({ error: 'Ese correo ya está registrado' });
    }

    const created = userRepository.create({
      username: normalizedEmail,
      passwordHash: bcrypt.hashSync(String(password), 10),
      role: 'user',
      phone: normalizedPhone,
      fullName: fullName ? String(fullName).trim() : null,
      municipality: municipality ? String(municipality).trim() : null,
      department: canonicalDepartment(department),
      plan: 'free',
      ageVerified: true,
    });

    // Toda cuenta nueva arranca con 7 días de Pro de regalo (ver subscriptionService.startTrial).
    const user = subscriptionService.startTrial(created.id);

    const remember = wantsRemember(req);
    const result = authService.login(normalizedEmail, String(password), { remember });
    setSessionCookie(res, result.token, remember);
    res.status(201).json({ user: publicUser(user), ...tokenForClient(req, result.token) });
  } catch (err) {
    next(err);
  }
});

router.post('/login', loginRateLimit, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son requeridos' });
  }

  const remember = wantsRemember(req);
  const result = authService.login(String(username).trim().toLowerCase(), String(password), { remember });
  if (!result) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }

  setSessionCookie(res, result.token, remember);
  res.json({ user: publicUser(userRepository.findById(result.user.id)), ...tokenForClient(req, result.token) });
});

router.post('/logout', (req, res) => {
  res.clearCookie(authService.COOKIE_NAME);
  res.json({ ok: true });
});

router.get('/me', authMiddleware, loadUser, (req, res) => {
  res.json({ user: publicUser(req.fullUser) });
});

router.post('/password-reset/request', passwordResetRateLimit, async (req, res, next) => {
  try {
    const { username } = req.body || {};
    if (!username) {
      return res.status(400).json({ error: 'El correo es requerido' });
    }
    const result = await passwordResetService.requestReset(username);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/password-reset/confirm', passwordResetRateLimit, (req, res, next) => {
  try {
    const { username, code, newPassword } = req.body || {};
    if (!username || !code) {
      return res.status(400).json({ error: 'El correo y el código son requeridos' });
    }
    passwordResetService.confirmReset(username, code, newPassword);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
