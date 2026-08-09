const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth.routes');
const pricesRoutes = require('./routes/prices.routes');
const cooperativesRoutes = require('./routes/cooperatives.routes');
const forecastRoutes = require('./routes/forecast.routes');
const authMiddleware = require('./middleware/authMiddleware');
const errorHandler = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json());
  app.use(cookieParser());

  app.use('/api/auth', authRoutes);
  app.use('/api/prices', authMiddleware, pricesRoutes);
  app.use('/api/cooperatives', authMiddleware, cooperativesRoutes);
  app.use('/api/forecast', authMiddleware, forecastRoutes);

  const distPath = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
  }

  app.use(errorHandler);

  return app;
}

module.exports = createApp;
