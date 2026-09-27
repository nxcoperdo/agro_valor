const path = require('path');
require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';

const env = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd,

  jwtSecret: process.env.JWT_SECRET || 'reemplaza-esto-por-una-cadena-larga-y-aleatoria',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  // Con "Recordarme" en la web, y siempre en la app: nadie quiere volver a escribir la clave en el celular.
  jwtRememberExpiresIn: process.env.JWT_REMEMBER_EXPIRES_IN || '30d',
  cookieSecure: process.env.COOKIE_SECURE === 'true',

  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'changeme123',

  sqliteDbPath: path.resolve(process.cwd(), process.env.SQLITE_DB_PATH || './data/agro_valor.sqlite'),

  twelveDataApiKey: process.env.TWELVE_DATA_API_KEY || '',
  alphaVantageApiKey: process.env.ALPHA_VANTAGE_API_KEY || '',

  coffeeBasePriceCents: parseFloat(process.env.COFFEE_BASE_PRICE_CENTS || '380'),
  exchangeRateFallbackCop: parseFloat(process.env.EXCHANGE_RATE_FALLBACK_COP || '4000'),
  // Los suaves colombianos se cotizan por encima del contrato "C" de Nueva York.
  colombiaPremiumUsdPerLb: parseFloat(process.env.COLOMBIA_PREMIUM_USD_PER_LB || '0.40'),

  priceRefreshCron: process.env.PRICE_REFRESH_CRON || '*/5 * * * *',
  fncReferenceCron: process.env.FNC_REFERENCE_CRON || '0 8,14 * * 1-5',
  forecastRefreshCron: process.env.FORECAST_REFRESH_CRON || '0 15 * * *',

  fncSourceUrl: process.env.FNC_SOURCE_URL || 'https://federaciondecafeteros.org/estadisticas-cafeteras/',
  fncFallbackCopCarga: process.env.FNC_FALLBACK_COP_CARGA ? parseFloat(process.env.FNC_FALLBACK_COP_CARGA) : null,
  // Token compartido con el workflow de GitHub Actions que scrapea la FNC desde afuera
  // del VPS y empuja el precio al endpoint POST /api/internal/fnc-price.
  fncIngestToken: process.env.FNC_INGEST_TOKEN || '',

  // Meta WhatsApp Business Cloud API (https://developers.facebook.com/docs/whatsapp/cloud-api).
  // Los mensajes proactivos (no iniciados por el usuario) solo pueden ser plantillas
  // ya aprobadas por Meta, no texto libre — por eso hay un nombre de plantilla por caso.
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  whatsappApiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
  whatsappTemplateLang: process.env.WHATSAPP_TEMPLATE_LANG || 'es',
  whatsappTemplateAlert: process.env.WHATSAPP_TEMPLATE_ALERT || 'agrovalor_alerta_precio',
  whatsappTemplateDigest: process.env.WHATSAPP_TEMPLATE_DIGEST || 'agrovalor_resumen_mercado',
  whatsappTemplateWelcome: process.env.WHATSAPP_TEMPLATE_WELCOME || 'agrovalor_bienvenida',
  whatsappTemplateReset: process.env.WHATSAPP_TEMPLATE_RESET || 'agrovalor_recuperacion',

  // Notificaciones push a la app (Firebase Cloud Messaging): ruta al JSON de la cuenta de servicio.
  firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    ? path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
    : '',

  // Dominio público canónico: lo usan las páginas de SEO, el sitemap y las etiquetas canonical/og.
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || 'https://agrovalor.tech').replace(/\/$/, ''),

  // Cobro de Pro vía Mercado Pago Suscripciones (Preapproval), tanto en la web (redirección)
  // como en la app (WebView embebido con la misma URL de checkout).
  mpAccessToken: process.env.MP_ACCESS_TOKEN || '',
  mpPublicKey: process.env.MP_PUBLIC_KEY || '',
  mpWebhookSecret: process.env.MP_WEBHOOK_SECRET || '',
  mpProAmountCop: Number(process.env.MP_PRO_AMOUNT_COP || 12000),
  mpBackUrl: process.env.MP_BACK_URL || 'https://agrovalor.tech/#/cuenta',
  mpPollCron: process.env.MP_POLL_CRON || '0 8 * * *',

  dailyDigestCron: process.env.DAILY_DIGEST_CRON || '0 6 * * *',
  weeklyDigestCron: process.env.WEEKLY_DIGEST_CRON || '0 6 * * 1',
  // Los horarios de los jobs se interpretan en esta zona, sin depender de cómo esté
  // configurado el reloj del servidor: "las 6 de la mañana" son las 6 en Colombia.
  timezone: process.env.TZ_APP || 'America/Bogota',

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
