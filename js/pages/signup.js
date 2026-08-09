import { api } from '../services/api.js';
import { setCachedUser } from '../services/auth.js';

export function renderSignup(root) {
  root.innerHTML = `
    <div class="login-screen">
      <form class="login-card" id="signup-form" novalidate>
        <div class="brand-plate">
          <img src="img/logo-full.png" alt="AgroValor — Mercados que mueven el campo" />
        </div>
        <p class="login-subtitle">Crea tu cuenta gratis y empieza a comparar precios del café.</p>

        <label for="fullName">Nombre completo</label>
        <input type="text" id="fullName" name="fullName" autocomplete="name" />

        <label for="username">Usuario</label>
        <input type="text" id="username" name="username" autocomplete="username" required />

        <label for="phone">WhatsApp <span class="label-hint">(para tus alertas)</span></label>
        <input type="tel" id="phone" name="phone" inputmode="tel" autocomplete="tel" placeholder="300 123 4567" />

        <label for="municipality">Municipio</label>
        <input type="text" id="municipality" name="municipality" placeholder="Pitalito" />

        <label for="password">Contraseña <span class="label-hint">(mínimo 8 caracteres)</span></label>
        <input type="password" id="password" name="password" autocomplete="new-password" required minlength="8" />

        <button type="submit">Crear cuenta</button>
        <p class="login-error" id="signup-error" role="alert" aria-live="polite" hidden></p>
        <p class="form-footer">¿Ya tienes cuenta? <a href="#/login">Entrar</a></p>
      </form>
    </div>
  `;

  const form = root.querySelector('#signup-form');
  const errorEl = root.querySelector('#signup-error');
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creando cuenta…';

    try {
      const { user } = await api.signup({
        fullName: form.fullName.value.trim(),
        username: form.username.value.trim(),
        phone: form.phone.value.trim(),
        municipality: form.municipality.value.trim(),
        password: form.password.value,
      });

      setCachedUser(user);
      window.location.hash = '#/dashboard';
    } catch (err) {
      errorEl.textContent = err.message || 'No se pudo crear la cuenta';
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Crear cuenta';
    }
  });
}
