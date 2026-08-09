import { getCachedUser, logout } from '../services/auth.js';

const NAV_ITEMS = [
  { hash: '#/dashboard', label: 'Mercado' },
  { hash: '#/calculadora', label: 'Calculadora' },
  { hash: '#/alertas', label: 'Alertas' },
  { hash: '#/ventas', label: 'Mis ventas' },
  { hash: '#/reportar', label: 'Reportar precio' },
  { hash: '#/cuenta', label: 'Mi cuenta' },
];

/**
 * Marco común de las pantallas con sesión: encabezado, navegación y contenedor.
 * Devuelve el elemento donde cada página pinta su contenido.
 */
export function renderShell(root, activeHash) {
  const user = getCachedUser();
  const isPro = Boolean(user && user.isPro);

  root.innerHTML = `
    <div class="app-shell">
      <header class="dashboard-header">
        <a class="brand" href="#/dashboard">
          <img class="brand-icon-img" src="img/logo-icon.png" alt="" width="32" height="32" />
          <span class="brand-word"><span class="brand-agro">Agro</span><span class="brand-valor">Valor</span></span>
        </a>
        <div class="dashboard-user">
          <span class="plan-chip ${isPro ? 'plan-chip-pro' : ''}">${isPro ? 'Pro' : 'Gratis'}</span>
          <span class="user-name">${user ? user.username : ''}</span>
          <button id="logout-btn" type="button">Salir</button>
        </div>
      </header>

      <nav class="app-nav" aria-label="Secciones">
        ${NAV_ITEMS.map(
          (item) => `
            <a href="${item.hash}" class="app-nav-link ${item.hash === activeHash ? 'is-active' : ''}"
               ${item.hash === activeHash ? 'aria-current="page"' : ''}>${item.label}</a>
          `
        ).join('')}
      </nav>

      <main class="app-main" id="page-content"></main>
    </div>
  `;

  root.querySelector('#logout-btn').addEventListener('click', logout);

  return root.querySelector('#page-content');
}

/** Bloque que se muestra cuando una función requiere plan Pro. */
export function paywall(featureName, description) {
  return `
    <div class="panel paywall">
      <span class="badge badge-pro">AgroValor Pro</span>
      <h2>${featureName}</h2>
      <p>${description}</p>
      <a class="btn-primary" href="#/cuenta">Ver cómo activar Pro</a>
    </div>
  `;
}

export function panelError(message) {
  return `<div class="panel"><p class="panel-error">${message}</p></div>`;
}
