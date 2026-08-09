const bcrypt = require('bcryptjs');
const migrate = require('./migrate');
const env = require('../config/env');
const userRepository = require('../repositories/userRepository');
const cooperativeRepository = require('../repositories/cooperativeRepository');
const cooperativesConfig = require('../config/cooperatives.json');
const logger = require('../utils/logger');

function bootstrap() {
  migrate();

  cooperativeRepository.seedFromConfig(cooperativesConfig);

  if (userRepository.count() === 0) {
    const passwordHash = bcrypt.hashSync(env.adminPassword, 10);
    userRepository.create({ username: env.adminUsername, passwordHash, role: 'admin' });
    logger.warn(
      `Usuario admin creado ("${env.adminUsername}"). Cambia ADMIN_PASSWORD en .env y vuelve a sembrar si es necesario.`
    );
  }
}

module.exports = bootstrap;
