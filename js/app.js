import { startRouter } from './router.js';
import { initPwa } from './services/pwa.js';

initPwa();

document.addEventListener('DOMContentLoaded', startRouter);
