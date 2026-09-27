import { api } from '../services/api.js';
import { setCachedUser } from '../services/auth.js';

const ICONS = {
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" />',
  lock: '<path d="M7 10V8a5 5 0 0 1 10 0v2M6 10h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M10 18h4" />',
  eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" />',
  eyeOff:
    '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /><path d="m4 4 16 16" />',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5" />',
  trend: '<path d="m4 16 5-5 4 4 7-8M15 7h5v5" />',
};

const icon = (name) => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none">${ICONS[name]}</svg>`;

const SUBMIT_LABEL = `<span>Crear mi cuenta</span>${icon('arrow')}`;

export function renderSignup(root) {
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
            <p class="lg-eyebrow">Empieza gratis</p>
            <h2>Crea tu cuenta</h2>
            <p>Con tu correo, tu WhatsApp y una contraseña ya puedes entrar.</p>
          </div>

          <form id="signup-form" novalidate>
            <label class="lg-field">
              <span>Correo</span>
              <span class="lg-input">
                <span class="lg-input__icon">${icon('mail')}</span>
                <input
                  type="email"
                  name="email"
                  autocomplete="email"
                  placeholder="tu@correo.com"
                  required
                />
              </span>
            </label>

            <label class="lg-field">
              <span>Celular (WhatsApp)</span>
              <span class="lg-input">
                <span class="lg-input__icon">${icon('phone')}</span>
                <input
                  type="tel"
                  name="phone"
                  inputmode="tel"
                  autocomplete="tel"
                  placeholder="300 123 4567"
                  required
                />
              </span>
            </label>

            <label class="lg-field">
              <span>Contraseña</span>
              <span class="lg-input">
                <span class="lg-input__icon">${icon('lock')}</span>
                <input
                  type="password"
                  name="password"
                  autocomplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  minlength="8"
                  required
                />
                <button class="lg-toggle" type="button" aria-label="Mostrar contraseña">${icon('eye')}</button>
              </span>
            </label>

            <label class="lg-check">
              <input type="checkbox" name="acceptTerms" id="accept-terms" />
              <span>
                Acepto los <a href="#/terminos" target="_blank">términos de uso</a> y la
                <a href="#/privacidad" target="_blank">política de privacidad</a>.
              </span>
            </label>

            <button class="lg-submit" type="submit">${SUBMIT_LABEL}</button>

            <p class="lg-error" id="signup-error" role="alert" aria-live="polite" hidden></p>
          </form>

          <p class="lg-signup">¿Ya tienes una cuenta? <a href="#/login">Entrar</a></p>
        </div>
      </section>
    </main>
  `;

  const form = root.querySelector('#signup-form');
  const errorEl = root.querySelector('#signup-error');
  const submitBtn = form.querySelector('.lg-submit');
  const toggle = form.querySelector('.lg-toggle');

  toggle.addEventListener('click', () => {
    const show = form.password.type === 'password';
    form.password.type = show ? 'text' : 'password';
    toggle.innerHTML = icon(show ? 'eyeOff' : 'eye');
    toggle.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });

  // Sin esto, el clic en los links también marca/desmarca el checkbox (están dentro del <label>).
  form.querySelectorAll('.lg-check a').forEach((a) => a.addEventListener('click', (e) => e.stopPropagation()));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    const email = form.email.value.trim();
    const phone = form.phone.value.trim();
    const password = form.password.value;

    if (!email || !phone || !password) {
      errorEl.textContent = 'Completa tu correo, tu WhatsApp y una contraseña.';
      errorEl.hidden = false;
      return;
    }

    if (!form.acceptTerms.checked) {
      errorEl.textContent = 'Debes aceptar los términos de uso y la política de privacidad.';
      errorEl.hidden = false;
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Creando cuenta…</span>';

    try {
      const { user } = await api.signup({ email, phone, password });
      setCachedUser(user);
      window.location.hash = '#/dashboard';
    } catch (err) {
      errorEl.textContent = err.message || 'No se pudo crear la cuenta';
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.innerHTML = SUBMIT_LABEL;
    }
  });
}
