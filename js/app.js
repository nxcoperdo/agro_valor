import { startRouter } from './router.js';
import { initPwa } from './services/pwa.js';
import { initCookieNotice } from './ui/cookieNotice.js';

initPwa();

document.addEventListener('DOMContentLoaded', () => {
  startRouter();
  initCookieNotice();
});
