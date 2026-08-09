const env = require('../config/env');
const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Error interno del servidor' : err.message,
    ...(env.isProd ? {} : { stack: err.stack }),
  });
}

module.exports = errorHandler;
