import { api } from '../services/api.js';
import { refreshUser, setCachedUser } from '../services/auth.js';

function planCard(plan, current) {
  const isCurrent = plan.id === current.plan;

  return `
    <article class="plan-card ${plan.id === 'pro' ? 'plan-card-pro' : ''} ${isCurrent ? 'is-current' : ''}">
      <div class="plan-card-head">
        <h3>${plan.name}</h3>
        ${isCurrent ? '<span class="badge badge-real">Tu plan actual</span>' : ''}
      </div>
      <ul class="plan-features">
        ${plan.features.map((f) => `<li>${f}</li>`).join('')}
      </ul>
    </article>
  `;
}

export async function renderAccount(container) {
  container.innerHTML = '<div class="panel"><span class="skeleton" style="width:100%;height:160px;"></span></div>';

  try {
    const [profile, planInfo] = await Promise.all([api.profile(), api.plan()]);

    const expiry = profile.expiresAt
      ? new Date(profile.expiresAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
      : null;

    container.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <h2>Mi plan</h2>
          <span class="plan-chip ${profile.isPro ? 'plan-chip-pro' : ''}">${profile.isPro ? 'Pro' : 'Gratis'}</span>
        </div>
        ${
          profile.isPro && expiry
            ? `<p class="panel-intro">Tu plan Pro está activo hasta el <strong>${expiry}</strong>.</p>`
            : `<p class="panel-intro">
                 Estás en el plan gratis. Con AgroValor Pro recibes alertas por WhatsApp,
                 calculas tu precio neto real y ves la proyección del mercado.
               </p>`
        }
        <div class="plans-grid">
          ${planCard(planInfo.plans.free, profile)}
          ${planCard(planInfo.plans.pro, profile)}
        </div>
        ${
          !profile.isPro
            ? `<div class="notice notice-info upgrade-note">
                 ${
                   profile.mpSubscriptionPending
                     ? `<p><strong>Tu pago está en proceso.</strong> Si ya autorizaste el cobro en Mercado Pago, confirma aquí.</p>
                        <button type="button" class="btn-primary" id="mp-confirm-btn">Ya pagué, confirmar</button>`
                     : `<a class="btn-primary" href="#/pro">Ver todos los beneficios y suscribirme</a>`
                 }
                 <p class="disclaimer">
                   ¿Prefieres pagar por Nequi o Daviplata? Escríbenos por WhatsApp y te activamos el plan a mano.
                 </p>
               </div>`
            : ''
        }
        <p class="form-error" id="mp-error" role="alert" hidden></p>
      </div>

      <div class="panel">
        <div class="panel-header"><h2>Mis datos</h2></div>
        <p class="panel-intro">
          Lo que guardes aquí se usa por defecto en la calculadora, para que no tengas que
          escribir lo mismo cada vez. Tu número de WhatsApp es a donde llegan las alertas.
        </p>
        <form class="calc-form" id="profile-form">
          <div class="field">
            <label for="fullName">Nombre completo</label>
            <input type="text" id="fullName" name="fullName" value="${profile.fullName || ''}" autocomplete="name" />
          </div>
          <div class="field">
            <label for="phone">WhatsApp</label>
            <input type="tel" id="phone" name="phone" value="${profile.phone || ''}" inputmode="tel" placeholder="300 123 4567" />
          </div>
          <div class="field">
            <label for="municipality">Municipio</label>
            <input type="text" id="municipality" name="municipality" value="${profile.municipality || ''}" />
          </div>
          <div class="field">
            <label for="defaultFactor">Factor habitual de mi café</label>
            <input type="number" id="defaultFactor" name="defaultFactor" value="${profile.defaultFactor ?? ''}" step="0.1" placeholder="94" inputmode="decimal" />
          </div>
          <div class="field">
            <label for="defaultHumidity">Humedad habitual (%)</label>
            <input type="number" id="defaultHumidity" name="defaultHumidity" value="${profile.defaultHumidity ?? ''}" step="0.1" placeholder="12" inputmode="decimal" />
          </div>
          <div class="field">
            <label for="transportCostCopCarga">Transporte por carga (COP)</label>
            <input type="number" id="transportCostCopCarga" name="transportCostCopCarga" value="${profile.transportCostCopCarga ?? ''}" step="1000" placeholder="0" inputmode="numeric" />
          </div>
          <button type="submit" class="btn-primary">Guardar cambios</button>
        </form>
        <p class="form-error" id="profile-error" role="alert" hidden></p>
        <p class="form-success" id="profile-success" role="status" hidden></p>
      </div>

      <div class="panel">
        <div class="panel-header"><h2>Cambiar contraseña</h2></div>
        <form class="calc-form" id="password-form">
          <div class="field">
            <label for="currentPassword">Contraseña actual</label>
            <input type="password" id="currentPassword" name="currentPassword" autocomplete="current-password" required />
          </div>
          <div class="field">
            <label for="newPassword">Contraseña nueva</label>
            <input type="password" id="newPassword" name="newPassword" autocomplete="new-password" minlength="8" required />
          </div>
          <button type="submit" class="btn-primary">Cambiar contraseña</button>
        </form>
        <p class="form-error" id="password-error" role="alert" hidden></p>
        <p class="form-success" id="password-success" role="status" hidden></p>
      </div>

      <div class="panel">
        <div class="panel-header"><h2>Legal</h2></div>
        <p class="panel-intro">
          <a href="#/privacidad">Política de privacidad</a> ·
          <a href="#/terminos">Términos de uso</a> ·
          <a href="#/cookies">Política de cookies</a>
        </p>
      </div>

      <div class="panel">
        <div class="panel-header"><h2>Zona de peligro</h2></div>
        <p class="panel-intro">
          Eliminar tu cuenta borra tus datos, tus alertas y tu historial de ventas. Es
          irreversible. Tus reportes de precio se quedan, pero sin tu nombre.
        </p>
        <form class="calc-form" id="delete-account-form">
          <div class="field">
            <label for="deleteAccountPassword">Confirma tu contraseña</label>
            <input type="password" id="deleteAccountPassword" name="password" autocomplete="current-password" required />
          </div>
          <button type="submit" class="btn-danger">Eliminar mi cuenta</button>
        </form>
        <p class="form-error" id="delete-account-error" role="alert" hidden></p>
      </div>
    `;

    const mpErrorEl = container.querySelector('#mp-error');
    const mpConfirmBtn = container.querySelector('#mp-confirm-btn');

    // Si el usuario acaba de volver del checkout de Mercado Pago, se intenta confirmar
    // solo, sin que tenga que darle clic al botón de "Ya pagué".
    if (profile.mpSubscriptionPending) {
      api
        .mpConfirm()
        .then((updated) => {
          if (updated.isPro) renderAccount(container);
        })
        .catch(() => {});
    }

    mpConfirmBtn?.addEventListener('click', async () => {
      mpErrorEl.hidden = true;
      mpConfirmBtn.disabled = true;
      try {
        await api.mpConfirm();
        await renderAccount(container);
      } catch (err) {
        mpErrorEl.textContent = err.message;
        mpErrorEl.hidden = false;
        mpConfirmBtn.disabled = false;
      }
    });

    const form = container.querySelector('#profile-form');
    const errorEl = container.querySelector('#profile-error');
    const successEl = container.querySelector('#profile-success');
    const submitBtn = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.hidden = true;
      successEl.hidden = true;
      submitBtn.disabled = true;

      try {
        await api.updateProfile({
          fullName: form.fullName.value.trim(),
          phone: form.phone.value.trim(),
          municipality: form.municipality.value.trim(),
          defaultFactor: form.defaultFactor.value,
          defaultHumidity: form.defaultHumidity.value,
          transportCostCopCarga: form.transportCostCopCarga.value,
        });

        await refreshUser();
        successEl.textContent = 'Datos guardados.';
        successEl.hidden = false;
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      }

      submitBtn.disabled = false;
    });

    const passwordForm = container.querySelector('#password-form');
    const passwordErrorEl = container.querySelector('#password-error');
    const passwordSuccessEl = container.querySelector('#password-success');
    const passwordBtn = passwordForm.querySelector('button[type="submit"]');

    passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      passwordErrorEl.hidden = true;
      passwordSuccessEl.hidden = true;
      passwordBtn.disabled = true;

      try {
        await api.changePassword(passwordForm.currentPassword.value, passwordForm.newPassword.value);
        passwordForm.reset();
        passwordSuccessEl.textContent = 'Contraseña cambiada.';
        passwordSuccessEl.hidden = false;
      } catch (err) {
        passwordErrorEl.textContent = err.message;
        passwordErrorEl.hidden = false;
      }

      passwordBtn.disabled = false;
    });

    const deleteForm = container.querySelector('#delete-account-form');
    const deleteErrorEl = container.querySelector('#delete-account-error');
    const deleteBtn = deleteForm.querySelector('button[type="submit"]');

    deleteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      deleteErrorEl.hidden = true;

      if (!window.confirm('¿Seguro que quieres eliminar tu cuenta? Esto no se puede deshacer.')) {
        return;
      }

      deleteBtn.disabled = true;
      try {
        await api.deleteAccount(deleteForm.password.value);
        setCachedUser(null);
        window.location.hash = '#/';
      } catch (err) {
        deleteErrorEl.textContent = err.message;
        deleteErrorEl.hidden = false;
        deleteBtn.disabled = false;
      }
    });
  } catch (err) {
    container.innerHTML = `<div class="panel"><p class="panel-error">${err.message}</p></div>`;
  }
}
