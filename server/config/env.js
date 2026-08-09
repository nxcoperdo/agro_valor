const path = require('path');
require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';

const env = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd,

  jwtSecret: process.env.JWT_SECRET || 'reemplaza-esto-por-una-cadena-larga-y-aleatoria',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  cookieSecure: process.env.COOKIE_SECURE === 'true',

  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'changeme123',

  sqliteDbPath: path.resolve(process.cwd(), process.env.SQLITE_DB_PATH || './data/agro_valor.sqlite'),

  twelveDataApiKey: process.env.TWELVE_DATA_API_KEY || '',
  alphaVantageApiKey: process.env.ALPHA_VANTAGE_API_KEY || '',

  coffeeBasePriceCents: parseFloat(process.env.COFFEE_BASE_PRICE_CENTS || '380'),
  exchangeRateFallbackCop: parseFloat(process.env.EXCHANGE_RATE_FALLBACK_COP || '4000'),

  priceRefreshCron: process.env.PRICE_REFRESH_CRON || '*/30 * * * *',
  fncReferenceCron: process.env.FNC_REFERENCE_CRON || '0 8,14 * * 1-5',
  forecastRefreshCron: process.env.FORECAST_REFRESH_CRON || '0 15 * * *',

  fncSourceUrl: process.env.FNC_SOURCE_URL || 'https://federaciondecafeteros.org/estadisticas-cafeteras/',
  fncFallbackCopCarga: process.env.FNC_FALLBACK_COP_CARGA ? parseFloat(process.env.FNC_FALLBACK_COP_CARGA) : null,

  // Se delega el envío al proyecto de WhatsApp que ya corre en el mismo servidor.
  whatsappApiUrl: process.env.WHATSAPP_API_URL || '',
  whatsappApiToken: process.env.WHATSAPP_API_TOKEN || '',

  dailyDigestCron: process.env.DAILY_DIGEST_CRON || '0 6 * * *',
  weeklyDigestCron: process.env.WEEKLY_DIGEST_CRON || '0 6 * * 1',

  allowPublicSignup: process.env.ALLOW_PUBLIC_SIGNUP !== 'false',
};

if (isProd && env.jwtSecret === 'reemplaza-esto-por-una-cadena-larga-y-aleatoria') {
  // eslint-disable-next-line no-console
  console.warn('[env] ADVERTENCIA: JWT_SECRET no fue configurado con un valor propio en producción.');
}

if (!env.twelveDataApiKey && !env.alphaVantageApiKey) {
  // eslint-disable-next-line no-console
  console.warn('[env] No hay API keys de precios configuradas (TWELVE_DATA_API_KEY / ALPHA_VANTAGE_API_KEY). El precio del café arrancará en modo simulado.');
}

module.exports = env;
