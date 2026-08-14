import { api } from '../services/api.js';
import { formatCop } from '../utils/currency.js';
import { canInstall, promptInstall, onInstallAvailabilityChange, isStandalone } from '../services/pwa.js';

/** El navegador solo deja instalar cuando él lo decide, así que el botón aparece y desaparece solo. */
function setupInstallButton(root) {
  const btn = root.querySelector('#install-btn');
  const note = root.querySelector('#install-note');
  if (!btn) return;

  const sync = (available) => {
    const show = available && !isStandalone();
    btn.hidden = !show;
    note.hidden = !show;
  };

  sync(canInstall());
  const unsubscribe = onInstallAvailabilityChange(sync);

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    await promptInstall();
    btn.disabled = false;
  });

  // Al salir de la landing el nodo se destruye; se suelta el listener para no acumularlos.
  window.addEventListener('hashchange', unsubscribe, { once: true });
}

function priceRow(coop) {
  const source =
    coop.priceSource === 'reported'
      ? `<span class="tag tag-reported">Reportado por ${coop.reportInfo.reporterCount} caficultores</span>`
      : '<span class="tag tag-estimated">Estimado</span>';

  return `
    <tr class="${coop.isHighestBuyer ? 'row-highest' : ''}">
      <td>${coop.rank}</td>
      <td>${coop.name} ${source}</td>
      <td>${coop.region || '—'}</td>
      <td class="tabular-nums">${formatCop(coop.estimatedPriceCopCarga)}</td>
    </tr>
  `;
}

export async function renderLanding(root) {
  root.innerHTML = `
    <div class="landing">
      <header class="landing-header">
        <div class="brand">
          <img class="brand-icon-img" src="img/logo-icon.png" alt="" width="32" height="32" />
          <span class="brand-word"><span class="brand-agro">Agro</span><span class="brand-valor">Valor</span></span>
        </div>
        <div class="landing-actions">
          <a class="btn-ghost" href="#/login">Entrar</a>
          <a class="btn-primary" href="#/registro">Crear cuenta</a>
        </div>
      </header>

      <section class="hero">
        <h1>¿Cuánto puede valer tu café mañana?</h1>
        <p class="hero-sub">
          Consulta el mercado, compara cuánto paga cada cooperativa y calcula
          cuánta plata te queda realmente a ti. Mercados que mueven el campo.
        </p>
        <div class="hero-price" id="hero-price">
          <span class="skeleton" style="width: 260px; height: 3rem;"></span>
        </div>
        <p class="hero-meta" id="hero-meta"></p>
        <div class="hero-cta">
          <a class="btn-primary btn-lg" href="#/registro">Empieza gratis</a>
          <button type="button" class="btn-ghost btn-lg" id="install-btn" hidden>Instalar la app</button>
        </div>
        <p class="hero-install-note" id="install-note" hidden>
          Instálala en tu celular y ábrela aunque estés sin señal.
        </p>
      </section>

      <section class="panel landing-panel">
        <div class="panel-header"><h2>Quién está pagando mejor hoy</h2></div>
        <div class="table-scroll">
          <table class="coop-table">
            <thead>
              <tr><th>#</th><th>Cooperativa</th><th>Región</th><th>Precio por carga (125 kg)</th></tr>
            </thead>
            <tbody id="landing-coops"></tbody>
          </table>
        </div>
        <p class="disclaimer" id="landing-disclaimer"></p>
      </section>

      <section class="value-grid">
        <article class="value-card">
          <h3>Alertas por WhatsApp</h3>
          <p>Te avisamos cuando el precio llegue a la meta que tú pongas. No tienes que estar revisando nada.</p>
        </article>
        <article class="value-card">
          <h3>Tu precio real, no el de referencia</h3>
          <p>Calcula cuánto te pagan según tu factor de rendimiento, tu humedad y lo que te cuesta el transporte.</p>
        </article>
        <article class="value-card">
          <h3>Proyección del precio</h3>
          <p>Calendario día a día, semana a semana y mes a mes de cómo puede moverse el precio.</p>
        </article>
        <article class="value-card">
          <h3>Precios reales del campo</h3>
          <p>Los mismos caficultores reportan cuánto les pagaron. Entre más reportes, más exacto para todos.</p>
        </article>
      </section>

      <footer class="landing-footer">
        <p>AgroValor · Mercados que mueven el campo</p>
        <p class="disclaimer">
          La información es de carácter informativo y no constituye asesoría financiera ni
          garantía de precio de compra.
        </p>
      </footer>
    </div>
  `;

  const priceEl = root.querySelector('#hero-price');
  const metaEl = root.querySelector('#hero-meta');
  const tbody = root.querySelector('#landing-coops');
  const disclaimerEl = root.querySelector('#landing-disclaimer');

  setupInstallButton(root);

  try {
    const market = await api.market();

    if (market.fncReference) {
      priceEl.innerHTML = `
        <span class="tabular-nums">${formatCop(market.fncReference.priceCopCarga)}</span>
        <span class="hero-price-unit">por carga de 125 kg</span>
      `;
      metaEl.textContent = `Precio interno de referencia de la Federación Nacional de Cafeteros · ${new Date(
        market.fncReference.scrapedAt
      ).toLocaleDateString('es-CO')}`;
    } else {
      priceEl.textContent = 'Precio no disponible en este momento';
    }

    tbody.innerHTML = market.cooperatives.map(priceRow).join('');
    disclaimerEl.textContent = market.disclaimer;
  } catch (err) {
    priceEl.textContent = '—';
    metaEl.textContent = 'No se pudo cargar el precio en este momento.';
  }
}
