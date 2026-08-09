/* Script CLI: node server/db/seed.js <username> <password> [role] */
const bcrypt = require('bcryptjs');
const migrate = require('./migrate');
const userRepository = require('../repositories/userRepository');
const logger = require('../utils/logger');

function main() {
  const [, , username, password, role = 'admin'] = process.argv;

  if (!username || !password) {
    logger.error('Uso: node server/db/seed.js <username> <password> [role]');
    process.exit(1);
  }

  migrate();

  if (userRepository.findByUsername(username)) {
    logger.error(`El usuario "${username}" ya existe.`);
    process.exit(1);
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  userRepository.create({ username, passwordHash, role });
  logger.info(`Usuario "${username}" creado con rol "${role}".`);
}

main();
