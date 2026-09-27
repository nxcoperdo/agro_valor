import { api } from '../services/api.js';
import { setCachedUser } from '../services/auth.js';

const ICONS = {
  user: '<path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />',
  lock: '<path d="M7 10V8a5 5 0 0 1 10 0v2M6 10h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />',
  eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" />',
  eyeOff:
    '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /><path d="m4 4 16 16" />',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5" />',
  trend: '<path d="m4 16 5-5 4 4 7-8M15 7h5v5" />',
};

const icon = (name) => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none">${ICONS[name]}</svg>`;

const SUBMIT_LABEL = `<span>Entrar a mi cuenta</span>${icon('arrow')}`;

export function renderLogin(root) {
  root.innerHTML = `
    <main class="lg-shell">
      <section class="lg-brand" aria-label="Presentación de AgroValor">
        <div class="lg-brand__glow"></div>
        <div class="lg-brand__content">
          <a class="lg-mark" href="#/">
            <span class="lg-mark__tile"><img src="img/logo-icon.png" alt="" /></span>
            <span>AgroValor</span>
          </a>

          <div class="lg-message">
            <p class="lg-eyebrow">Del campo a mejores decisiones</p>
            <h1>Tu café vale más cuando tienes la información correcta.</h1>
            <p>Consulta el precio de tu café por carga y lleva el control de tu producción, estés donde estés.</p>
          </div>

          <div class="lg-pill">
            <span class="lg-pill__icon">${icon('trend')}</span>
            <span>
              <strong>Información clara</strong>
              <small>para decisiones más rentables</small>
            </span>
          </div>
        </div>
      </section>

      <section class="lg-panel">
        <div class="lg-card">
          <a class="lg-mobile-brand" href="#/" aria-label="AgroValor">
            <img src="img/logo-icon.png" alt="" />
            <span>AgroValor</span>
          </a>

          <div class="lg-heading">
            <p class="lg-eyebrow">Bienvenido de nuevo</p>
            <h2>Inicia sesión</h2>
            <p>Ingresa tus datos para acceder a tu cuenta.</p>
          </div>

          <form id="login-form" novalidate>
            <label class="lg-field">
              <span>Correo</span>
              <span class="lg-input">
                <span class="lg-input__icon">${icon('user')}</span>
                <input type="text" name="username" autocomplete="username" placeholder="tu@correo.com" required />
              </span>
            </label>

            <label class="lg-field">
              <span>Contraseña</span>
              <span class="lg-input">
                <span class="lg-input__icon">${icon('lock')}</span>
                <input type="password" name="password" autocomplete="current-password" placeholder="Tu contraseña" required />
                <button class="lg-toggle" type="button" aria-label="Mostrar contraseña">${icon('eye')}</button>
              </span>
            </label>

            <div class="lg-options">
              <label class="lg-remember">
                <input type="checkbox" name="remember" checked />
                <span>Recordarme</span>
              </label>
              <a class="lg-link" href="#/recuperar">¿Olvidaste tu contraseña?</a>
            </div>

            <button class="lg-submit" type="submit">${SUBMIT_LABEL}</button>

            <p class="lg-error" id="login-error" role="alert" aria-live="polite" hidden></p>
          </form>

          <p class="lg-signup">¿Aún no tienes una cuenta? <a href="#/registro">Crear cuenta</a></p>
        </div>
      </section>
    </main>
  `;

  const form = root.querySelector('#login-form');
  const errorEl = root.querySelector('#login-error');
  const submitBtn = form.querySelector('.lg-submit');
  const toggle = form.querySelector('.lg-toggle');

  toggle.addEventListener('click', () => {
    const show = form.password.type === 'password';
    form.password.type = show ? 'text' : 'password';
    toggle.innerHTML = icon(show ? 'eyeOff' : 'eye');
    toggle.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    const username = form.username.value.trim();
    const password = form.password.value;
    if (!username || !password) {
      errorEl.textContent = 'Escribe tu correo y tu contraseña.';
      errorEl.hidden = false;
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Ingresando…</span>';

    try {
      const { user } = await api.login(username, password, form.remember.checked);
      setCachedUser(user);
      window.location.hash = '#/dashboard';
    } catch (err) {
      errorEl.textContent = err.message || 'No se pudo iniciar sesión';
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.innerHTML = SUBMIT_LABEL;
    }
  });
}
