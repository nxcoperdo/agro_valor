const feedbackRepository = require('../repositories/feedbackRepository');

const TYPES = ['sugerencia', 'error', 'otro'];
const STATUSES = ['nuevo', 'en_revision', 'resuelto'];
const MIN_LENGTH = 5;
const MAX_LENGTH = 1000;
/** Tope por usuario al día, para que el panel de administración no se llene de repeticiones. */
const MAX_PER_DAY = 5;

function badRequest(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function clip(value, max) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, max) : null;
}

function createFeedback(userId, { type, message, platform, appVersion } = {}) {
  const kind = TYPES.includes(type) ? type : null;
  if (!kind) throw badRequest('Elige si es una sugerencia, un error u otro tema.');

  const text = typeof message === 'string' ? message.trim() : '';
  if (text.length < MIN_LENGTH) throw badRequest('Cuéntanos un poco más para poder ayudarte.');
  if (text.length > MAX_LENGTH) throw badRequest(`El mensaje es muy largo (máximo ${MAX_LENGTH} caracteres).`);

  if (feedbackRepository.countToday(userId) >= MAX_PER_DAY) {
    throw badRequest('Ya enviaste varios mensajes hoy. Intenta de nuevo mañana.', 429);
  }

  return feedbackRepository.create({
    userId,
    type: kind,
    message: text,
    platform: clip(platform, 40),
    appVersion: clip(appVersion, 40),
  });
}

function getMyFeedback(userId) {
  return feedbackRepository.findByUser(userId);
}

function setStatus(id, status) {
  if (!STATUSES.includes(status)) throw badRequest('Estado no válido.');
  const updated = feedbackRepository.updateStatus(id, status);
  if (!updated) throw badRequest('Mensaje no encontrado.', 404);
  return updated;
}

module.exports = { TYPES, STATUSES, MAX_PER_DAY, createFeedback, getMyFeedback, setStatus };
