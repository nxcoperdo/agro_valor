import { api } from '../services/api.js';
import { refreshUser } from '../services/auth.js';

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
                 <p><strong>¿Cómo activo Pro?</strong> Escríbenos por WhatsApp para activarte el plan.
                 Por ahora la activación se hace manualmente después del pago por Nequi o Daviplata.</p>
               </div>`
            : ''
        }
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
    `;

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
  } catch (err) {
    container.innerHTML = `<div class="panel"><p class="panel-error">${err.message}</p></div>`;
  }
}
