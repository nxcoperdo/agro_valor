/* Script CLI: node server/db/setPassword.js <username> <nueva-contraseña> */
const bcrypt = require('bcryptjs');
const migrate = require('./migrate');
const db = require('./connection');
const userRepository = require('../repositories/userRepository');
const logger = require('../utils/logger');

const MIN_LENGTH = 8;

function main() {
  const [, , username, password] = process.argv;

  if (!username || !password) {
    logger.error('Uso: node server/db/setPassword.js <username> <nueva-contraseña>');
    process.exit(1);
  }

  if (password.length < MIN_LENGTH) {
    logger.error(`La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`);
    process.exit(1);
  }

  migrate();

  const user = userRepository.findByUsername(username.trim().toLowerCase());
  if (!user) {
    logger.error(`No existe el usuario "${username}".`);
    process.exit(1);
  }

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), user.id);
  logger.info(`Contraseña actualizada para "${user.username}". Cierra sesión y vuelve a entrar.`);
}

main();
