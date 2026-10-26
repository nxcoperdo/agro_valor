const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth.routes');
const publicRoutes = require('./routes/public.routes');
const healthService = require('./services/healthService');
const pricesRoutes = require('./routes/prices.routes');
const cooperativesRoutes = require('./routes/cooperatives.routes');
const forecastRoutes = require('./routes/forecast.routes');
const accountRoutes = require('./routes/account.routes');
const alertsRoutes = require('./routes/alerts.routes');
const calculatorRoutes = require('./routes/calculator.routes');
const reportsRoutes = require('./routes/reports.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const salesRoutes = require('./routes/sales.routes');
const coffeeRoutes = require('./routes/coffee.routes');
const { requireBusiness } = require('./middleware/requireBusiness');
const adminRoutes = require('./routes/admin.routes');
const internalRoutes = require('./routes/internal.routes');
const seoRoutes = require('./routes/seo.routes');
const env = require('./config/env');

const authMiddleware = require('./middleware/authMiddleware');
const { loadUser, requirePro, requireAdmin } = require('./middleware/requirePlan');
const errorHandler = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json());
  app.use(cookieParser());

  // www.agrovalor.tech y agrovalor.tech servirían lo mismo: para Google eso es contenido
  // duplicado. Se deja una sola versión canónica (sin www).
  app.use((req, res, next) => {
    if ((req.method === 'GET' || req.method === 'HEAD') && req.hostname && req.hostname.startsWith('www.')) {
      return res.redirect(301, `${env.publicBaseUrl}${req.originalUrl}`);
    }
    next();
  });

  // Para vigilancia externa: 200 si la base responde (aunque haya datos viejos), 503 si no.
  app.get('/api/health', (req, res) => {
    const result = healthService.check();
    res.status(result.status === 'error' ? 503 : 200).json(result);
  });

  // Páginas públicas renderizadas en el servidor (precio del día, sitemap) para Google.
  app.use(seoRoutes);

  // Abierto: la vitrina pública del producto.
  app.use('/api/auth', authRoutes);
  app.use('/api/public', publicRoutes);

  // Sin cookie de sesión: lo llama el workflow de GitHub Actions, protegido por token propio.
  app.use('/api/internal', internalRoutes);

  // Requiere cuenta (plan gratis incluido).
  app.use('/api/prices', authMiddleware, pricesRoutes);
  app.use('/api/cooperatives', authMiddleware, cooperativesRoutes);
  app.use('/api/account', authMiddleware, loadUser, accountRoutes);
  app.use('/api/reports', authMiddleware, loadUser, reportsRoutes);
  app.use('/api/feedback', authMiddleware, loadUser, feedbackRoutes);

  // Vista previa gratis, cálculo/detalle completo requiere Pro (ver gating dentro de la ruta).
  app.use('/api/forecast', authMiddleware, loadUser, forecastRoutes);

  // Requiere plan Pro.
  app.use('/api/calculator', authMiddleware, loadUser, requirePro, calculatorRoutes);
  app.use('/api/alerts', authMiddleware, loadUser, requirePro, alertsRoutes);
  app.use('/api/sales', authMiddleware, loadUser, requirePro, salesRoutes);
  app.use('/api/coffee', authMiddleware, loadUser, requirePro, requireBusiness, coffeeRoutes);

  app.use('/api/admin', authMiddleware, requireAdmin, adminRoutes);

  const distPath = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distPath)) {
    // El service worker nunca debe quedarse pegado en la caché del navegador, o el
    // usuario se queda con una versión vieja de la app y no recibe las correcciones.
    app.get('/sw.js', (req, res, next) => {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      next();
    });

    app.use(express.static(distPath));
  }

  app.use(errorHandler);

  return app;
}

module.exports = createApp;
