import { api } from '../services/api.js';
import { setCachedUser } from '../services/auth.js';

export function renderLogin(root) {
  root.innerHTML = `
    <div class="login-screen">
      <form class="login-card" id="login-form" novalidate>
        <a class="brand-plate" href="#/">
          <img src="img/logo-full.png" alt="AgroValor — Mercados que mueven el campo" />
        </a>
        <p class="login-subtitle">Precio del café en tiempo real, comparación de cooperativas y proyección de mercado</p>
        <label for="username">Usuario</label>
        <input type="text" id="username" name="username" autocomplete="username" required />
        <label for="password">Contraseña</label>
        <input type="password" id="password" name="password" autocomplete="current-password" required />
        <button type="submit">Ingresar</button>
        <p class="login-error" id="login-error" role="alert" aria-live="polite" hidden></p>
        <p class="form-footer">¿No tienes cuenta? <a href="#/registro">Crear una gratis</a></p>
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

    try {
      const { user } = await api.login(form.username.value.trim(), form.password.value);
      setCachedUser(user);
      window.location.hash = '#/dashboard';
    } catch (err) {
      errorEl.textContent = err.message || 'No se pudo iniciar sesión';
      errorEl.hidden = false;
      errorEl.classList.remove('av-fade-in');
      void errorEl.offsetWidth;
      errorEl.classList.add('av-fade-in');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Ingresar';
    }
  });
}
