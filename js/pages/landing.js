import { api } from '../services/api.js';
import { formatCop } from '../utils/currency.js';
import { createThemeToggle } from '../ui/theme.js';
import { canInstall, promptInstall, onInstallAvailabilityChange, isStandalone } from '../services/pwa.js';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=co.agrovalor.app';

/**
 * En Android se manda a la ficha de Google Play (la app nativa es mejor que la PWA:
 * push real, más fluida). En iPhone no existe instalador: Safari solo deja agregar a
 * la pantalla de inicio a mano, así que se explica el paso a paso. En todo lo demás
 * (escritorio) se muestra también el enlace a Google Play (para abrirlo desde el celular)
 * junto al instalador de PWA de siempre, que ahí sí tiene sentido.
 */
function setupInstallButtons(root) {
  if (isStandalone()) return;

  root.querySelector('#landing-theme').replaceWith(createThemeToggle('btn-ghost'));
  const playBtn = root.querySelector('#play-store-btn');
  const iosBtn = root.querySelector('#ios-install-btn');
  const iosSteps = root.querySelector('#ios-install-steps');
  const pwaBtn = root.querySelector('#install-btn');
  const note = root.querySelector('#install-note');

  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;

  if (isAndroid) {
    playBtn.hidden = false;
    note.hidden = false;
    note.textContent = 'Ya está disponible en Google Play. Tiene alertas push y va más fluida que la web.';
    return;
  }

  if (isIOS) {
    iosBtn.hidden = false;
    iosBtn.addEventListener('click', () => {
      const opening = iosSteps.hidden;
      iosSteps.hidden = !opening;
      iosBtn.setAttribute('aria-expanded', String(opening));
    });
    return;
  }

  playBtn.hidden = false;
  if (!pwaBtn) return;

  const sync = (available) => {
    pwaBtn.hidden = !available;
    note.hidden = !available;
    note.textContent = 'Descárgala en tu celular Android desde Google Play, o instálala en este equipo y ábrela aunque estés sin señal.';
  };

  sync(canInstall());
  const unsubscribe = onInstallAvailabilityChange(sync);

  pwaBtn.addEventListener('click', async () => {
    pwaBtn.disabled = true;
    await promptInstall();
    pwaBtn.disabled = false;
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
      <td data-label="#" class="cell-rank">${coop.rank}</td>
      <td data-label="Cooperativa" class="cell-name">${coop.name} ${source}</td>
      <td data-label="Región">${coop.region || '—'}</td>
      <td data-label="Precio por carga" class="tabular-nums">${formatCop(coop.estimatedPriceCopCarga)}</td>
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
          <span id="landing-theme"></span>
          <a class="btn-ghost" href="#/login">Entrar</a>
          <a class="btn-primary" href="#/registro">Crear cuenta</a>
        </div>
      </header>

      <section class="hero">
        <h1>Precio del café hoy y qué cooperativa paga mejor</h1>
        <p class="hero-sub">
          ¿Cuánto puede valer tu café mañana? Consulta el mercado, compara cuánto paga cada cooperativa y calcula
          cuánta plata te queda realmente a ti. <a href="/precio-cafe-hoy">Ver el precio del café hoy por carga, arroba y kilo</a>.
        </p>
        <div class="hero-price" id="hero-price">
          <span class="skeleton" style="width: 260px; height: 3rem;"></span>
        </div>
        <p class="hero-meta" id="hero-meta"></p>
        <div class="hero-cta">
          <a class="btn-primary btn-lg" href="#/registro">Empieza gratis</a>
          <a class="btn-ghost btn-lg" id="play-store-btn" href="${PLAY_STORE_URL}" target="_blank" rel="noopener" hidden>Descargar en Google Play</a>
          <button
            type="button"
            class="btn-ghost btn-lg"
            id="ios-install-btn"
            aria-expanded="false"
            aria-controls="ios-install-steps"
            hidden
          >
            Instalar en iPhone
          </button>
          <button type="button" class="btn-ghost btn-lg" id="install-btn" hidden>Instalar la app</button>
        </div>
        <p class="hero-install-note" id="install-note" hidden></p>
        <div class="ios-install-steps" id="ios-install-steps" hidden>
          <ol>
            <li>Abre esta página en <strong>Safari</strong> (los pasos no funcionan desde otro navegador).</li>
            <li>Toca el ícono de <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba), en la barra inferior.</li>
            <li>Baja en la lista y toca <strong>«Agregar a pantalla de inicio»</strong>.</li>
            <li>Toca <strong>«Agregar»</strong> arriba a la derecha. Listo, queda como una app más.</li>
          </ol>
        </div>
      </section>

      <section class="panel landing-panel">
        <div class="panel-header"><h2>Qué cooperativa paga mejor el café hoy</h2></div>
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
        <p class="landing-legal-links">
          <a href="/precio-cafe-hoy">Precio del café hoy</a> ·
          <a href="#/privacidad">Política de privacidad</a> ·
          <a href="#/terminos">Términos de uso</a> ·
          <a href="#/cookies">Política de cookies</a> ·
          <a href="#/dmca">Derechos de autor (DMCA)</a>
        </p>
      </footer>
    </div>
  `;

  const priceEl = root.querySelector('#hero-price');
  const metaEl = root.querySelector('#hero-meta');
  const tbody = root.querySelector('#landing-coops');
  const disclaimerEl = root.querySelector('#landing-disclaimer');

  setupInstallButtons(root);

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
