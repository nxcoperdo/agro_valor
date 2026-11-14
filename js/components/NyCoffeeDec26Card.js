/**
 * Tarjeta "Bolsa de NY · Coffee Dec 26" para la pantalla Precio: precio del contrato en
 * c/lb, variación del día, cierre anterior, rango y hora. Es independiente del resto de la
 * pantalla: si el endpoint falla solo esta tarjeta muestra "No disponible".
 */

const REFRESH_MS = 60000;
const CSS_HREF = 'css/nyCoffeeDec26Card.css';
const TZ = 'America/Bogota';

// Coma decimal como en Investing.com en español: 279,25.
const fmt = (value) => new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const signed = (value) => `${value >= 0 ? '+' : '−'}${fmt(Math.abs(value))}`;

function ensureStyles() {
  if (document.querySelector(`link[data-ny-coffee-card]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = CSS_HREF;
  link.dataset.nyCoffeeCard = '';
  document.head.appendChild(link);
}

function formatTime(iso) {
  if (!iso) return null;
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function cardHeader() {
  return `
    <div class="pv-row">
      <span class="pv-label">Bolsa de Nueva York · Café C Dic 2026</span>
      <span class="pv-pill pv-pill-gold pv-pill-caps">ICE</span>
    </div>`;
}

function renderUnavailable(card) {
  card.innerHTML = `${cardHeader()}<p class="pv-ny-unavailable">No disponible</p>`;
}

function render(card, d) {
  if (!d || !d.available || d.price == null) return renderUnavailable(card);

  const dir = d.change == null ? '' : d.change >= 0 ? 'is-up' : 'is-down';
  const time = formatTime(d.quotedAt);
  const range = d.dayLow != null && d.dayHigh != null ? `${fmt(d.dayLow)} - ${fmt(d.dayHigh)}` : '—';

  card.innerHTML = `
    ${cardHeader()}
    <div class="pv-ny-price">
      <span class="pv-mono pv-ny-price-value">${fmt(d.price)}</span>
      <span class="pv-ny-unit">c/lb</span>
      ${
        d.change != null
          ? `<span class="pv-ny-change ${dir}">${signed(d.change)}${
              d.changePct != null ? ` (${signed(d.changePct)}%)` : ''
            }</span>`
          : ''
      }
    </div>
    <div class="pv-ny-stats">
      <div><span class="pv-ny-stat-label">Cierre anterior</span><span class="pv-mono pv-ny-stat-value">${
        d.previousClose != null ? fmt(d.previousClose) : '—'
      }</span></div>
      <div><span class="pv-ny-stat-label">Rango del día</span><span class="pv-mono pv-ny-stat-value">${range}</span></div>
    </div>
    <p class="pv-meta">${time ? `Última cotización: ${time} (hora de Colombia)` : 'Última cotización no disponible'} · con unos minutos de retraso</p>
  `;
}

/**
 * Crea la tarjeta justo debajo de `afterEl` (la tarjeta "Mercado internacional") y la
 * mantiene actualizada. No hace nada en cacao. Devuelve una función para detener el refresco.
 */
export function mountNyCoffeeDec26Card(afterEl, market = 'coffee') {
  if (market !== 'coffee' || !afterEl) return () => {};

  ensureStyles();

  const card = document.createElement('article');
  card.className = 'pv-card pv-ny-card';
  card.innerHTML = `${cardHeader()}<span class="skeleton" style="display:block; width: 160px; height: 2rem; margin-top: 8px;"></span>`;
  afterEl.insertAdjacentElement('afterend', card);

  let stopped = false;

  async function load() {
    try {
      const res = await fetch('/api/ny-coffee/dec26', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!stopped) render(card, await res.json());
    } catch (_) {
      if (!stopped) renderUnavailable(card);
    }
  }

  load();
  const timer = setInterval(() => {
    // Si la pantalla se re-dibujó, esta tarjeta ya no está en el documento: se deja de refrescar.
    if (!card.isConnected) {
      stopped = true;
      clearInterval(timer);
      return;
    }
    load();
  }, REFRESH_MS);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
