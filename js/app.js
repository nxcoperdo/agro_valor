import { startRouter } from './router.js';
import { initPwa } from './services/pwa.js';
import { initCookieNotice } from './ui/cookieNotice.js';
import { initTheme } from './ui/theme.js';

initTheme();
initPwa();

document.addEventListener('DOMContentLoaded', () => {
  startRouter();
  initCookieNotice();
});
