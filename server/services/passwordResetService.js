const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/userRepository');
const passwordResetRepository = require('../repositories/passwordResetRepository');
const whatsappService = require('../services/whatsappService');
const env = require('../config/env');

const CODE_TTL_MS = 15 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * No hay email en el modelo de usuario, así que el código viaja por WhatsApp al
 * teléfono guardado en el perfil. Si no hay teléfono (es opcional en el signup),
 * no hay canal automático: se avisa para que lo resuelvan a mano desde el panel admin.
 */
async function requestReset(username) {
  const user = userRepository.findByUsername(String(username || '').trim().toLowerCase());
  if (!user) {
    return { sent: false, reason: 'not_found' };
  }
  if (!user.phone) {
    return { sent: false, reason: 'no_phone' };
  }

  passwordResetRepository.deleteActiveByUser(user.id);

  const code = generateCode();
  const codeHash = bcrypt.hashSync(code, 10);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString().replace('T', ' ').slice(0, 19);

  passwordResetRepository.create({ userId: user.id, codeHash, expiresAt });

  await whatsappService.sendTemplateMessage(user.phone, env.whatsappTemplateReset, [code]);

  return { sent: true };
}

function confirmReset(username, code, newPassword) {
  if (!newPassword || String(newPassword).length < MIN_PASSWORD_LENGTH) {
    throw Object.assign(new Error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`), {
      status: 400,
    });
  }

  const user = userRepository.findByUsername(String(username || '').trim().toLowerCase());
  const reset = user ? passwordResetRepository.findActiveByUser(user.id) : null;

  if (!reset || !bcrypt.compareSync(String(code || ''), reset.code_hash)) {
    throw Object.assign(new Error('Código inválido o vencido'), { status: 400 });
  }

  userRepository.setPasswordHash(user.id, bcrypt.hashSync(String(newPassword), 10));
  passwordResetRepository.markUsed(reset.id);
}

module.exports = { requestReset, confirmReset };
