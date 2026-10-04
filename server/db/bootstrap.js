const bcrypt = require('bcryptjs');
const migrate = require('./migrate');
const env = require('../config/env');
const userRepository = require('../repositories/userRepository');
const cooperativeRepository = require('../repositories/cooperativeRepository');
const fncReferenceRepository = require('../repositories/fncReferenceRepository');
const cooperativesConfig = require('../config/cooperatives.json');
const cocoaBuyersConfig = require('../config/cocoaBuyers.json');
const logger = require('../utils/logger');

function bootstrap() {
  migrate();

  cooperativeRepository.seedFromConfig(cooperativesConfig);
  cooperativeRepository.seedFromConfig(cocoaBuyersConfig, 'cocoa');

  if (userRepository.count() === 0) {
    const passwordHash = bcrypt.hashSync(env.adminPassword, 10);
    userRepository.create({ username: env.adminUsername, passwordHash, role: 'admin' });
    logger.warn(
      `Usuario admin creado ("${env.adminUsername}"). Cambia ADMIN_PASSWORD en .env y vuelve a sembrar si es necesario.`
    );
  }

  if (env.fncFallbackCopCarga && !fncReferenceRepository.latest()) {
    fncReferenceRepository.insert({
      priceCopCarga: env.fncFallbackCopCarga,
      sourceUrl: 'manual (FNC_FALLBACK_COP_CARGA en .env)',
      rawLabel: 'Valor inicial puesto a mano mientras el scraping automático no logra conectarse.',
    });
    logger.warn(
      `No había precio de referencia FNC guardado; se sembró un valor manual desde FNC_FALLBACK_COP_CARGA (${env.fncFallbackCopCarga}). Se reemplazará automáticamente en cuanto el scraping real funcione.`
    );
  }
}

module.exports = bootstrap;
