import { refreshUser, getCachedUser } from './services/auth.js';
import { renderShell } from './ui/shell.js';

import { renderLanding } from './pages/landing.js';
import { renderLogin } from './pages/login.js';
import { renderSignup } from './pages/signup.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderCalculator } from './pages/calculator.js';
import { renderAlerts } from './pages/alerts.js';
import { renderSales } from './pages/sales.js';
import { renderPurchases } from './pages/coffee/purchases.js';
import { renderPurchaseDetail } from './pages/coffee/purchaseDetail.js';
import { renderQuickCalc } from './pages/coffee/quickCalc.js';
import { renderDaySummary } from './pages/coffee/daySummary.js';
import { renderLots, renderLotDetail } from './pages/coffee/lots.js';
import { renderInventory } from './pages/coffee/inventory.js';
import { renderTradeSales } from './pages/coffee/sales.js';
import { renderReceipt } from './pages/coffee/receipt.js';
import { renderReport } from './pages/report.js';
import { renderAccount } from './pages/account.js';
import { renderAdmin } from './pages/admin.js';
import { renderPasswordReset } from './pages/reset-password.js';
import { renderPrivacyPolicy, renderTermsOfService, renderCookiePolicy } from './pages/legal.js';
import { renderProPlan } from './pages/pro.js';

/**
 * `shell: true` = pantalla con sesión, se dibuja dentro del marco de navegación.
 * `guestOnly` = si ya hay sesión, no tiene sentido mostrarla (login/registro).
 * `adminOnly` = además de sesión, exige `role === 'admin'`.
 */
const ROUTES = {
  '#/': { render: renderLanding },
  '#/privacidad': { render: renderPrivacyPolicy },
  '#/terminos': { render: renderTermsOfService },
  '#/cookies': { render: renderCookiePolicy },
  '#/login': { render: renderLogin, guestOnly: true },
  '#/registro': { render: renderSignup, guestOnly: true },
  '#/recuperar': { render: renderPasswordReset, guestOnly: true },
  '#/dashboard': { render: renderDashboard, shell: true },
  '#/calculadora': { render: renderCalculator, shell: true },
  '#/alertas': { render: renderAlerts, shell: true },
  '#/ventas': { render: renderSales, shell: true },
  '#/compras': { render: renderPurchases, shell: true },
  '#/compra': { render: renderPurchaseDetail, shell: true },
  '#/calculadora-rapida': { render: renderQuickCalc, shell: true },
  '#/resumen-dia': { render: renderDaySummary, shell: true },
  '#/lotes': { render: renderLots, shell: true },
  '#/lote': { render: renderLotDetail, shell: true },
  '#/inventario': { render: renderInventory, shell: true },
  '#/ventas-cafe': { render: renderTradeSales, shell: true },
  '#/comprobante': { render: renderReceipt, shell: true },
  '#/reportar': { render: renderReport, shell: true },
  '#/cuenta': { render: renderAccount, shell: true },
  '#/pro': { render: renderProPlan, shell: true },
  '#/admin': { render: renderAdmin, shell: true, adminOnly: true },
};

const DEFAULT_ROUTE = '#/';

function resolve(hash) {
  // Los parámetros van tras '?', p. ej. #/comprobante?id=3; la ruta es lo que está antes.
  const path = hash.split('?')[0];
  return ROUTES[path] ? path : DEFAULT_ROUTE;
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

  if (route.adminOnly && (!user || user.role !== 'admin')) {
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
