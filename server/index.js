const env = require('./config/env');
const bootstrap = require('./db/bootstrap');
const createApp = require('./app');
const scheduler = require('./jobs/scheduler');
const logger = require('./utils/logger');

bootstrap();

const app = createApp();

app.listen(env.port, () => {
  logger.info(`Servidor escuchando en http://localhost:${env.port}`);
  scheduler.start();
  scheduler.runOnStartup();
});
