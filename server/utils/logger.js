const env = require('../config/env');

/**
 * Los logs se escriben en la hora local de la aplicación (Colombia por defecto),
 * no en UTC, para que al revisar `pm2 logs` la hora coincida con la del reloj de
 * quien está mirando.
 */
const formatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: env.timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function ts() {
  // 'sv-SE' da el formato "YYYY-MM-DD HH:MM:SS", que es legible y ordenable.
  return formatter.format(new Date());
}

module.exports = {
  info: (...args) => console.log(`[${ts()}] [info]`, ...args),
  warn: (...args) => console.warn(`[${ts()}] [warn]`, ...args),
  error: (...args) => console.error(`[${ts()}] [error]`, ...args),
};
