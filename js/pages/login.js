import { api } from '../services/api.js';

const COFFEE_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8Z" />
    <line x1="6" y1="1" x2="6" y2="4" />
    <line x1="10" y1="1" x2="10" y2="4" />
    <line x1="14" y1="1" x2="14" y2="4" />
  </svg>
`;

export function renderLogin(root) {
  root.innerHTML = `
    <div class="login-screen">
      <form class="login-card" id="login-form" novalidate>
        <div class="brand">
          <span class="brand-icon" aria-hidden="true">${COFFEE_ICON}</span>
          <h1>Agro Valor</h1>
        </div>
        <p class="login-subtitle">Precio del café en tiempo real, comparación de cooperativas y proyección de mercado</p>
        <label for="username">Usuario</label>
        <input type="text" id="username" name="username" autocomplete="username" required />
        <label for="password">Contraseña</label>
        <input type="password" id="password" name="password" autocomplete="current-password" required />
        <button type="submit">Ingresar</button>
        <p class="login-error" id="login-error" role="alert" aria-live="polite" hidden></p>
      </form>
    </div>
  `;

  const form = root.querySelector('#login-form');
  const errorEl = root.querySelector('#login-error');
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Ingresando…';

    const username = form.username.value.trim();
    const password = form.password.value;

    try {
      await api.login(username, password);
      window.location.hash = '#/dashboard';
    } catch (err) {
      errorEl.textContent = err.message || 'No se pudo iniciar sesión';
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Ingresar';
    }
  });
}
