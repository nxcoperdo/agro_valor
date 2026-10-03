import { getCachedUser, logout } from '../services/auth.js';

const BASE_NAV_ITEMS = [
  { hash: '#/dashboard', label: 'Mercado' },
  { hash: '#/calculadora', label: 'Calculadora' },
  { hash: '#/alertas', label: 'Alertas' },
  { hash: '#/panel-cafe', label: 'Panel de café' },
  { hash: '#/compras', label: 'Compras de café' },
  { hash: '#/lotes', label: 'Lotes' },
  { hash: '#/inventario', label: 'Inventario' },
  { hash: '#/ventas-cafe', label: 'Ventas de café' },
  { hash: '#/rentabilidad', label: 'Rentabilidad' },
  { hash: '#/reportes-cafe', label: 'Reportes de café' },
  { hash: '#/calculadora-rapida', label: 'Calculadora rápida' },
  { hash: '#/ventas', label: 'Mis ventas' },
  { hash: '#/reportar', label: 'Reportar precio' },
  { hash: '#/pro', label: 'Plan Pro' },
  { hash: '#/cuenta', label: 'Mi cuenta' },
];

function navItemsFor(user) {
  if (user && user.role === 'admin') {
    return [...BASE_NAV_ITEMS, { hash: '#/admin', label: 'Admin' }];
  }
  return BASE_NAV_ITEMS;
}

function navLinks(activeHash, linkClass, user) {
  return navItemsFor(user).map(
    (item) => `
      <a href="${item.hash}" class="${linkClass} ${item.hash === activeHash ? 'is-active' : ''}"
         ${item.hash === activeHash ? 'aria-current="page"' : ''}>${item.label}</a>
    `
  ).join('');
}

/**
 * En móvil la navegación vive en un panel lateral. El cierre espera a que termine
 * la transición antes de marcarlo `inert`, para no cortar la animación de salida.
 */
function setupDrawer(root) {
  const toggle = root.querySelector('#nav-toggle');
  const drawer = root.querySelector('#app-drawer');
  const scrim = root.querySelector('#nav-scrim');
  const closeBtn = root.querySelector('#drawer-close');

  function openDrawer() {
    drawer.removeAttribute('inert');
    drawer.classList.add('is-open');
    scrim.hidden = false;
    requestAnimationFrame(() => scrim.classList.add('is-visible'));
    toggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('nav-locked');
    closeBtn.focus();
  }

  function closeDrawer() {
    if (!drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open');
    scrim.classList.remove('is-visible');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-locked');
    toggle.focus();

    drawer.addEventListener(
      'transitionend',
      () => {
        if (!drawer.classList.contains('is-open')) {
          drawer.setAttribute('inert', '');
          scrim.hidden = true;
        }
      },
      { once: true }
    );
  }

  toggle.addEventListener('click', openDrawer);
  closeBtn.addEventListener('click', closeDrawer);
  scrim.addEventListener('click', closeDrawer);
  drawer.addEventListener('click', (e) => {
    if (e.target.closest('a')) closeDrawer();
  });
  // El foco entra al panel al abrirlo, así que basta escuchar aquí; el marco se
  // vuelve a dibujar en cada navegación y un listener en `document` se acumularía.
  drawer.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });
}

/**
 * Marco común de las pantallas con sesión: encabezado, navegación y contenedor.
 * Devuelve el elemento donde cada página pinta su contenido.
 */
export function renderShell(root, activeHash) {
  const user = getCachedUser();
  const isPro = Boolean(user && user.isPro);

  root.innerHTML = `
    <div class="app-shell">
      <div class="app-topbar">
        <header class="dashboard-header">
          <a class="brand" href="#/dashboard">
            <img class="brand-icon-img" src="img/logo-icon.png" alt="" width="32" height="32" />
            <span class="brand-word"><span class="brand-agro">Agro</span><span class="brand-valor">Valor</span></span>
          </a>
          <div class="dashboard-user">
            <span class="plan-chip ${isPro ? 'plan-chip-pro' : ''}">${isPro ? 'Pro' : 'Gratis'}</span>
            <span class="user-name">${user ? user.username : ''}</span>
            <button id="logout-btn" type="button">Salir</button>
            <button id="nav-toggle" type="button" class="nav-toggle" aria-label="Abrir menú"
              aria-expanded="false" aria-controls="app-drawer">
              <span class="nav-toggle-bars" aria-hidden="true"></span>
            </button>
          </div>
        </header>

        <nav class="app-nav" aria-label="Secciones">
          ${navLinks(activeHash, 'app-nav-link', user)}
        </nav>
      </div>

      <div class="nav-scrim" id="nav-scrim" hidden></div>

      <nav class="app-drawer" id="app-drawer" aria-label="Secciones" inert>
        <div class="app-drawer-header">
          <span class="brand-word"><span class="brand-agro">Agro</span><span class="brand-valor">Valor</span></span>
          <button type="button" class="nav-toggle" id="drawer-close" aria-label="Cerrar menú">✕</button>
        </div>
        ${navLinks(activeHash, 'app-drawer-link', user)}
      </nav>

      <main class="app-main" id="page-content"></main>
    </div>
  `;

  root.querySelector('#logout-btn').addEventListener('click', logout);
  setupDrawer(root);

  return root.querySelector('#page-content');
}

/** Bloque que se muestra cuando una función requiere plan Pro. */
export function paywall(featureName, description) {
  return `
    <div class="panel paywall">
      <span class="badge badge-pro">AgroValor Pro</span>
      <h2>${featureName}</h2>
      <p>${description}</p>
      <a class="btn-primary" href="#/pro">Ver plan Pro</a>
    </div>
  `;
}

export function panelError(message) {
  return `<div class="panel"><p class="panel-error">${message}</p></div>`;
}
