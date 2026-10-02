import { api } from '../services/api.js';

const dateFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

export async function renderProPlan(container) {
  container.innerHTML = '<div class="panel"><span class="skeleton" style="width:100%;height:220px;display:block;"></span></div>';

  try {
    const info = await api.plan();
    const pro = info.plans.pro;
    const expiry = info.expiresAt ? dateFmt.format(new Date(info.expiresAt)) : null;

    container.innerHTML = `
      <div class="panel pro-hero">
        <span class="badge badge-pro">AgroValor Pro</span>
        <h1 class="pro-hero-title">Todo lo que necesitas para vender mejor tu café</h1>
        <p class="pro-price"><span class="pro-price-amount">$150.000</span><span class="pro-price-period">COP / año</span></p>
        ${
          info.isPro
            ? `<p class="panel-intro">Ya eres Pro. Tu plan está activo${expiry ? ` hasta el <strong>${expiry}</strong>` : ''}.</p>`
            : `<button type="button" id="pro-subscribe-btn" class="btn-primary btn-lg">Pagar ahora</button>
               <p class="disclaimer">Pago único por Mercado Pago, válido por 1 año. No se renueva sola.</p>`
        }
        <p class="form-error" id="pro-error" role="alert" hidden></p>
      </div>

      <div class="panel">
        <div class="panel-header"><h2>Qué incluye ${pro.name}</h2></div>
        <ul class="plan-features pro-features-list">
          ${pro.features.map((f) => `<li>${f}</li>`).join('')}
        </ul>
      </div>

      ${
        !info.isPro
          ? `<div class="panel">
               <p class="disclaimer">
                 ¿Prefieres pagar por Nequi o Daviplata? Escríbenos por WhatsApp y te activamos el plan a mano
                 desde <a href="#/cuenta">tu cuenta</a>.
               </p>
             </div>`
          : ''
      }
    `;

    const btn = container.querySelector('#pro-subscribe-btn');
    const errorEl = container.querySelector('#pro-error');

    btn?.addEventListener('click', async () => {
      errorEl.hidden = true;
      btn.disabled = true;
      btn.textContent = 'Redirigiendo…';
      try {
        const { initPoint } = await api.mpPay();
        window.location.href = initPoint;
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
        btn.disabled = false;
        btn.textContent = 'Pagar ahora';
      }
    });
  } catch (err) {
    container.innerHTML = `<div class="panel"><p class="panel-error">${err.message}</p></div>`;
  }
}
