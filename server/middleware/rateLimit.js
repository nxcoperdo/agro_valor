const rateLimit = require('express-rate-limit');

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Intenta de nuevo más tarde.' },
});

const signupRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados registros desde esta conexión. Intenta de nuevo más tarde.' },
});

/** Enviar WhatsApp cuesta, así que el mensaje de prueba se limita aparte. */
const testMessageRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Ya enviaste varios mensajes de prueba. Espera un momento.' },
});

/** Enviar el código de recuperación por WhatsApp también cuesta, mismo límite que el mensaje de prueba. */
const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Ya pediste varios códigos de recuperación. Espera un momento e intenta de nuevo.' },
});

module.exports = { loginRateLimit, signupRateLimit, testMessageRateLimit, passwordResetRateLimit };
