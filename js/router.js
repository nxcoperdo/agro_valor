import { requireAuth } from './services/auth.js';
import { renderLogin } from './pages/login.js';
import { renderDashboard } from './pages/dashboard.js';

const routes = {
  '#/login': { render: renderLogin, protected: false },
  '#/dashboard': { render: renderDashboard, protected: true },
};

async function handleRoute() {
  const root = document.getElementById('app');
  const hash = window.location.hash || '#/dashboard';
  const route = routes[hash] || routes['#/dashboard'];

  if (route.protected) {
    const user = await requireAuth();
    if (!user) {
      window.location.hash = '#/login';
      return;
    }
  }

  route.render(root);
}

export function startRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
