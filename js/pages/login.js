import { api } from '../services/api.js';

export function renderLogin(root) {
  root.innerHTML = `
    <div class="login-screen">
      <form class="login-card" id="login-form" novalidate>
        <div class="brand-plate">
          <img src="img/logo-full.png" alt="AgroValor — Mercados que mueven el campo" />
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
