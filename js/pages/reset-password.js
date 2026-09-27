import { api } from '../services/api.js';

const ICONS = {
  user: '<path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />',
  lock: '<path d="M7 10V8a5 5 0 0 1 10 0v2M6 10h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />',
  key: '<path d="M14.5 3a5.5 5.5 0 1 0 3.6 9.6L21 15.5 19 17.5l-2-1.5-1.5 1.5-2-1.5-1.9 1.9A5.5 5.5 0 0 1 14.5 3Z" />',
  trend: '<path d="m4 16 5-5 4 4 7-8M15 7h5v5" />',
};

const icon = (name) => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none">${ICONS[name]}</svg>`;

const NO_PHONE_MESSAGE =
  'No tienes un WhatsApp registrado para recibir el código. Escríbele al equipo de AgroValor con tu correo y te ayudamos a mano.';
const NOT_FOUND_MESSAGE = 'Ese correo no existe.';

function shell(cardHtml) {
  return `
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
            <h1>Recupera el acceso a tu cuenta.</h1>
            <p>Te mandamos un código por WhatsApp al número que tienes registrado.</p>
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
          ${cardHtml}
        </div>
      </section>
    </main>
  `;
}

function requestStepHtml() {
  return `
    <div class="lg-heading">
      <p class="lg-eyebrow">¿Olvidaste tu contraseña?</p>
      <h2>Recupera tu cuenta</h2>
      <p>Escribe tu correo y te mandamos un código por WhatsApp.</p>
    </div>

    <form id="request-form" novalidate>
      <label class="lg-field">
        <span>Correo</span>
        <span class="lg-input">
          <span class="lg-input__icon">${icon('user')}</span>
          <input type="text" name="username" autocomplete="username" placeholder="tu@correo.com" required />
        </span>
      </label>

      <button class="lg-submit" type="submit"><span>Enviar código</span>${icon('key')}</button>

      <p class="lg-note" id="request-note" hidden></p>
      <p class="lg-error" id="request-error" role="alert" aria-live="polite" hidden></p>
    </form>

    <p class="lg-signup"><a href="#/login">Volver a iniciar sesión</a></p>
  `;
}

function confirmStepHtml(username) {
  return `
    <div class="lg-heading">
      <p class="lg-eyebrow">Revisa tu WhatsApp</p>
      <h2>Escribe el código</h2>
      <p>Te llegó un código de 6 dígitos. Vence en 15 minutos.</p>
    </div>

    <form id="confirm-form" novalidate>
      <input type="hidden" name="username" value="${username}" />
      <label class="lg-field">
        <span>Código</span>
        <span class="lg-input">
          <span class="lg-input__icon">${icon('key')}</span>
          <input type="text" name="code" inputmode="numeric" maxlength="6" placeholder="123456" required />
        </span>
      </label>

      <label class="lg-field">
        <span>Nueva contraseña</span>
        <span class="lg-input">
          <span class="lg-input__icon">${icon('lock')}</span>
          <input
            type="password"
            name="newPassword"
            autocomplete="new-password"
            placeholder="Mínimo 8 caracteres"
            minlength="8"
            required
          />
        </span>
      </label>

      <button class="lg-submit" type="submit"><span>Cambiar contraseña</span>${icon('key')}</button>

      <p class="lg-error" id="confirm-error" role="alert" aria-live="polite" hidden></p>
    </form>

    <p class="lg-signup"><button class="lg-link" type="button" id="back-to-request">Pedir otro código</button></p>
  `;
}

function successStepHtml() {
  return `
    <div class="lg-heading">
      <p class="lg-eyebrow">Listo</p>
      <h2>Tu contraseña se cambió</h2>
      <p>Ya puedes iniciar sesión con tu nueva contraseña.</p>
    </div>
    <a class="lg-submit" href="#/login" style="text-decoration: none;"><span>Ir a iniciar sesión</span>${icon('key')}</a>
  `;
}

export function renderPasswordReset(root) {
  function renderRequestStep() {
    root.innerHTML = shell(requestStepHtml());

    const form = root.querySelector('#request-form');
    const noteEl = root.querySelector('#request-note');
    const errorEl = root.querySelector('#request-error');
    const submitBtn = form.querySelector('.lg-submit');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      noteEl.hidden = true;
      errorEl.hidden = true;

      const username = form.username.value.trim();
      if (!username) return;

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Enviando…</span>';

      try {
        const result = await api.requestPasswordReset(username);

        if (result.sent) {
          renderConfirmStep(username);
          return;
        }

        noteEl.textContent = result.reason === 'no_phone' ? NO_PHONE_MESSAGE : NOT_FOUND_MESSAGE;
        noteEl.hidden = false;
      } catch (err) {
        errorEl.textContent = err.message || 'No se pudo enviar el código';
        errorEl.hidden = false;
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Enviar código</span>${icon('key')}`;
      }
    });
  }

  function renderConfirmStep(username) {
    root.innerHTML = shell(confirmStepHtml(username));

    const form = root.querySelector('#confirm-form');
    const errorEl = root.querySelector('#confirm-error');
    const submitBtn = form.querySelector('.lg-submit');

    root.querySelector('#back-to-request').addEventListener('click', renderRequestStep);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.hidden = true;

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Cambiando…</span>';

      try {
        await api.confirmPasswordReset({
          username: form.username.value,
          code: form.code.value.trim(),
          newPassword: form.newPassword.value,
        });
        root.innerHTML = shell(successStepHtml());
      } catch (err) {
        errorEl.textContent = err.message || 'No se pudo cambiar la contraseña';
        errorEl.hidden = false;
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Cambiar contraseña</span>${icon('key')}`;
      }
    });
  }

  renderRequestStep();
}
