import { refreshUser, getCachedUser } from './services/auth.js';
import { renderShell } from './ui/shell.js';

import { renderLanding } from './pages/landing.js';
import { renderLogin } from './pages/login.js';
import { renderSignup } from './pages/signup.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderCalculator } from './pages/calculator.js';
import { renderAlerts } from './pages/alerts.js';
import { renderSales } from './pages/sales.js';
import { renderReport } from './pages/report.js';
import { renderAccount } from './pages/account.js';

/**
 * `shell: true` = pantalla con sesión, se dibuja dentro del marco de navegación.
 * `guestOnly` = si ya hay sesión, no tiene sentido mostrarla (login/registro).
 */
const ROUTES = {
  '#/': { render: renderLanding },
  '#/login': { render: renderLogin, guestOnly: true },
  '#/registro': { render: renderSignup, guestOnly: true },
  '#/dashboard': { render: renderDashboard, shell: true },
  '#/calculadora': { render: renderCalculator, shell: true },
  '#/alertas': { render: renderAlerts, shell: true },
  '#/ventas': { render: renderSales, shell: true },
  '#/reportar': { render: renderReport, shell: true },
  '#/cuenta': { render: renderAccount, shell: true },
};

const DEFAULT_ROUTE = '#/';

function resolve(hash) {
  return ROUTES[hash] ? hash : DEFAULT_ROUTE;
}

async function handleRoute() {
  const root = document.getElementById('app');
  const hash = resolve(window.location.hash || DEFAULT_ROUTE);
  const route = ROUTES[hash];

  // Solo se consulta la sesión si hace falta para decidir, para no pedirla en cada clic.
  const needsSession = route.shell || route.guestOnly;
  const user = needsSession ? getCachedUser() || (await refreshUser()) : getCachedUser();

  if (route.shell && !user) {
    window.location.hash = '#/login';
    return;
  }

  if (route.guestOnly && user) {
    window.location.hash = '#/dashboard';
    return;
  }

  window.scrollTo(0, 0);

  // Cada página pinta un elemento raíz nuevo, así que la animación se reinicia sola.
  if (route.shell) {
    const content = renderShell(root, hash);
    await route.render(content);
    content.firstElementChild?.classList.add('av-fade-in');
  } else {
    await route.render(root);
    root.firstElementChild?.classList.add('av-fade-in');
  }
}

export function startRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
