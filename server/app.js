const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth.routes');
const publicRoutes = require('./routes/public.routes');
const pricesRoutes = require('./routes/prices.routes');
const cooperativesRoutes = require('./routes/cooperatives.routes');
const forecastRoutes = require('./routes/forecast.routes');
const accountRoutes = require('./routes/account.routes');
const alertsRoutes = require('./routes/alerts.routes');
const calculatorRoutes = require('./routes/calculator.routes');
const reportsRoutes = require('./routes/reports.routes');
const salesRoutes = require('./routes/sales.routes');
const adminRoutes = require('./routes/admin.routes');

const authMiddleware = require('./middleware/authMiddleware');
const { loadUser, requirePro, requireAdmin } = require('./middleware/requirePlan');
const errorHandler = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json());
  app.use(cookieParser());

  // Abierto: la vitrina pública del producto.
  app.use('/api/auth', authRoutes);
  app.use('/api/public', publicRoutes);

  // Requiere cuenta (plan gratis incluido).
  app.use('/api/prices', authMiddleware, pricesRoutes);
  app.use('/api/cooperatives', authMiddleware, cooperativesRoutes);
  app.use('/api/account', authMiddleware, loadUser, accountRoutes);
  app.use('/api/reports', authMiddleware, loadUser, reportsRoutes);

  // Requiere plan Pro.
  app.use('/api/forecast', authMiddleware, loadUser, requirePro, forecastRoutes);
  app.use('/api/alerts', authMiddleware, loadUser, requirePro, alertsRoutes);
  app.use('/api/calculator', authMiddleware, loadUser, requirePro, calculatorRoutes);
  app.use('/api/sales', authMiddleware, loadUser, requirePro, salesRoutes);

  app.use('/api/admin', authMiddleware, requireAdmin, adminRoutes);

  const distPath = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
  }

  app.use(errorHandler);

  return app;
}

module.exports = createApp;
