import { api } from '../services/api.js';

const dateFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

const ICONS = {
  check: '<path d="m5 12.5 4.25 4.25L19 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />',
  bell: '<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM9.7 21h4.6" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />',
  calculator:
    '<rect height="19" rx="2.5" stroke-width="1.8" width="16" x="4" y="2.5" /><path d="M7.5 6h9v3h-9V6Zm.5 7h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" stroke-linecap="round" stroke-width="2" />',
  compare:
    '<path d="M7 20V10m5 10V4m5 16v-7" stroke-linecap="round" stroke-width="2" /><path d="M4 20h16" stroke-linecap="round" stroke-width="1.8" />',
  shield:
    '<path d="M12 3 5 6v5c0 4.6 2.9 8.3 7 10 4.1-1.7 7-5.4 7-10V6l-7-3Z" stroke-linejoin="round" stroke-width="1.8" /><path d="m9 12 2 2 4-4" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />',
};

const icon = (name, cls = '') =>
  `<svg aria-hidden="true" class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor">${ICONS[name]}</svg>`;

const BENEFITS = [
  {
    icon: 'bell',
    title: 'Vende en el momento indicado',
    body: 'Recibe alertas por WhatsApp cuando el precio llegue al valor que te conviene.',
  },
  {
    icon: 'calculator',
    title: 'Conoce cuánto recibirás',
    body: 'Calcula tu precio neto con factor y humedad. Sin cuentas confusas ni sorpresas.',
  },
  {
    icon: 'compare',
    title: 'Compara antes de decidir',
    body: 'Revisa cuánto te queda en cada cooperativa y elige con información clara.',
  },
];

const STEPS = [
  ['1', 'Activa tu plan', 'Haz un único pago seguro.'],
  ['2', 'Configura tus datos', 'Define tu factor, humedad y transporte habituales.'],
  ['3', 'Decide con claridad', 'Compara cooperativas y elige cuándo vender.'],
];

const FAQS = [
  ['¿Se renueva automáticamente?', 'No. Pagas una sola vez y tienes AgroValor Pro activo durante 1 año.'],
  ['¿Cuándo puedo empezar a usarlo?', 'Tu acceso se activa apenas se confirma el pago.'],
  ['¿Cómo se realiza el pago?', 'Con el checkout de Mercado Pago: tarjeta, PSE o el medio que prefieras ahí.'],
  ['¿Prefieres Nequi o Daviplata?', 'Escríbenos por WhatsApp y te ayudamos con la activación manual.'],
];

function priceCard(pro, { badgeLabel, buttonLabel, fineNote }) {
  return `
    <aside class="pro2-price-card">
      <span class="pro2-price-tag">${badgeLabel}</span>
      <p class="pro2-price-eyebrow">Un año para vender con más información</p>
      <p class="pro2-price"><span class="pro2-price-amount">$150.000</span><span class="pro2-price-period">COP</span></p>
      <p class="pro2-price-note">Pago único · equivale a $12.500 al mes</p>
      <hr class="pro2-divider" />
      <p class="pro2-price-includes">Tu plan incluye:</p>
      <ul class="pro2-feature-list">
        ${pro.features.map((f) => `<li>${icon('check', 'pro2-check pro2-check-plain')}<span>${f}</span></li>`).join('')}
      </ul>
      <button type="button" class="btn-primary btn-lg pro2-price-btn" data-pay-btn>${buttonLabel}</button>
      <p class="pro2-price-secure">${icon('shield', 'pro2-shield')}Pago seguro con Mercado Pago</p>
      <p class="pro2-price-fine">${fineNote}</p>
      <p class="form-error" id="pro-error" role="alert" hidden></p>
    </aside>
  `;
}

function benefitsGrid() {
  return `
    <div class="value-grid pro2-benefits">
      ${BENEFITS.map(
        (b) => `
          <article class="value-card pro2-benefit-card">
            <span class="pro2-icon">${icon(b.icon)}</span>
            <h3>${b.title}</h3>
            <p>${b.body}</p>
          </article>
        `
      ).join('')}
    </div>
  `;
}

function freeStateMarkup(pro) {
  return `
    <div class="panel pro2-hero pro2-hero--sell">
      <div class="pro2-hero-copy">
        <span class="pro2-eyebrow-badge">AgroValor Pro · 1 año</span>
        <h1 class="pro2-title">Vende tu café con más certeza y <span class="pro2-title-accent">mejores decisiones</span></h1>
        <p class="panel-intro">
          Convierte precios, factor y humedad en información útil para saber cuándo vender,
          dónde te conviene y cuánto recibirás.
        </p>
        <ul class="pro2-check-list">
          ${['Alertas por WhatsApp', 'Cálculo de precio neto', 'Comparación entre cooperativas']
            .map((item) => `<li>${icon('check', 'pro2-check pro2-check-circle')}${item}</li>`)
            .join('')}
        </ul>
      </div>
      ${priceCard(pro, {
        badgeLabel: 'Acceso inmediato',
        buttonLabel: 'Quiero vender mejor',
        fineNote: 'No se renueva automáticamente',
      })}
    </div>

    <div class="panel">
      <div class="panel-header-centered">
        <p class="pro2-eyebrow">Menos dudas. Más control.</p>
        <h2>Todo lo que necesitas antes de decir «vendo»</h2>
        <p class="panel-intro">
          No se trata de mirar más datos, sino de entenderlos y usarlos para proteger el valor de tu cosecha.
        </p>
      </div>
      ${benefitsGrid()}
    </div>

    <div class="panel pro2-howto">
      <div class="pro2-howto-copy">
        <p class="pro2-eyebrow">Una inversión simple</p>
        <h2>Una buena decisión puede hacer la diferencia</h2>
        <p class="panel-intro">
          AgroValor Pro te acompaña durante 1 año para que cada venta esté respaldada por
          números claros, no por suposiciones.
        </p>
      </div>
      <ol class="pro2-steps">
        ${STEPS.map(
          ([n, title, body]) => `
            <li>
              <span class="pro2-step-num">${n}</span>
              <h3>${title}</h3>
              <p>${body}</p>
            </li>
          `
        ).join('')}
      </ol>
    </div>

    <div class="panel">
      <div class="panel-header-centered"><h2>Antes de activar tu plan</h2></div>
      <div class="value-grid pro2-faq">
        ${FAQS.map(([q, a]) => `<article class="value-card"><h3>${q}</h3><p>${a}</p></article>`).join('')}
      </div>
    </div>

    <div class="panel pro2-cta">
      <p class="pro2-eyebrow">Tu próxima venta empieza con una mejor decisión</p>
      <h2>Ten la información lista cuando llegue el momento de vender</h2>
      <button type="button" class="btn-primary btn-lg pro2-cta-btn" data-pay-btn>Activar AgroValor Pro</button>
      <p class="pro2-cta-fine">$150.000 COP por 1 año · Pago único</p>
    </div>

    <div class="panel">
      <p class="disclaimer">
        ¿Prefieres pagar por Nequi o Daviplata? Escríbenos por WhatsApp y te activamos el plan a mano
        desde <a href="#/cuenta">tu cuenta</a>.
      </p>
    </div>
  `;
}

function trialStateMarkup(pro, expiry) {
  return `
    <div class="panel pro2-hero pro2-hero--trial">
      <div class="pro2-hero-copy">
        <span class="badge badge-pro">Prueba gratis activa</span>
        <h1 class="pro2-title">Ya tienes acceso a AgroValor Pro</h1>
        <p class="panel-intro">
          Tu prueba gratis de 7 días está activa${expiry ? ` hasta el <strong>${expiry}</strong>` : ''}.
          Paga ahora para seguir con Pro sin interrupciones cuando termine.
        </p>
      </div>
      ${priceCard(pro, {
        badgeLabel: 'Asegura tu Pro',
        buttonLabel: 'Pagar ahora',
        fineNote: 'No se renueva automáticamente',
      })}
    </div>

    <div class="panel">
      <div class="panel-header-centered"><h2>Lo que perderías si no activas tu plan</h2></div>
      ${benefitsGrid()}
    </div>

    <div class="panel">
      <p class="disclaimer">
        ¿Prefieres pagar por Nequi o Daviplata? Escríbenos por WhatsApp y te activamos el plan a mano
        desde <a href="#/cuenta">tu cuenta</a>.
      </p>
    </div>
  `;
}

function paidStateMarkup(pro, expiry) {
  return `
    <div class="panel pro2-hero pro2-hero--done">
      <span class="badge badge-pro">AgroValor Pro</span>
      <h1 class="pro2-title">Ya eres Pro</h1>
      <p class="panel-intro">Tu plan está activo${expiry ? ` hasta el <strong>${expiry}</strong>` : ''}.</p>
    </div>

    <div class="panel">
      <div class="panel-header"><h2>Qué incluye ${pro.name}</h2></div>
      <ul class="plan-features pro-features-list">
        ${pro.features.map((f) => `<li>${f}</li>`).join('')}
      </ul>
    </div>
  `;
}

export async function renderProPlan(container) {
  container.innerHTML = '<div class="panel"><span class="skeleton" style="width:100%;height:220px;display:block;"></span></div>';

  try {
    const info = await api.plan();
    const pro = info.plans.pro;
    const expiry = info.expiresAt ? dateFmt.format(new Date(info.expiresAt)) : null;

    const state = info.isTrialing ? 'trial' : info.isPro ? 'paid' : 'free';

    container.innerHTML =
      state === 'paid'
        ? paidStateMarkup(pro, expiry)
        : state === 'trial'
          ? trialStateMarkup(pro, expiry)
          : freeStateMarkup(pro);

    const errorEl = container.querySelector('#pro-error');
    const payButtons = container.querySelectorAll('[data-pay-btn]');

    payButtons.forEach((btn) => {
      const originalLabel = btn.textContent;
      btn.addEventListener('click', async () => {
        if (errorEl) errorEl.hidden = true;
        payButtons.forEach((b) => (b.disabled = true));
        btn.textContent = 'Redirigiendo…';
        try {
          const { initPoint } = await api.mpPay();
          window.location.href = initPoint;
        } catch (err) {
          if (errorEl) {
            errorEl.textContent = err.message;
            errorEl.hidden = false;
          }
          payButtons.forEach((b) => (b.disabled = false));
          btn.textContent = originalLabel;
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="panel"><p class="panel-error">${err.message}</p></div>`;
  }
}
