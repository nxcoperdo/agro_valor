import { Chart } from 'chart.js/auto';
import { api } from '../services/api.js';
import { formatCop } from '../utils/currency.js';

/** Cada cuánto el navegador vuelve a pedir la cotización sin recargar la página. */
const REFRESH_MS = 60000;

function formatUsdPerLb(value) {
  return `US$ ${value.toFixed(2)}`;
}

function timeAgo(iso) {
  if (!iso) return '';
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'hace un momento';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

function renderBadge(badge, international) {
  if (international && international.source === 'real') {
    const monthly = international.granularity === 'mensual';
    badge.textContent = monthly ? `Dato mensual · ${international.provider}` : `En vivo · ${international.provider}`;
    badge.className = `badge ${monthly ? 'badge-simulated' : 'badge-real'}`;
  } else {
    badge.textContent = 'Precio simulado';
    badge.className = 'badge badge-simulated';
  }
}

function renderPrices(bodyEl, market) {
  const { internal, international, exportParity } = market;
  const changeClass = international && international.changePct >= 0 ? 'delta-up' : 'delta-down';

  bodyEl.innerHTML = `
    ${
      internal
        ? `<div class="price-block">
             <span class="price-block-label">Lo que le pagan al caficultor</span>
             <div class="price-current">
               <span class="tabular-nums">${formatCop(internal.copPerCarga)}</span>
               <span class="price-secondary">por carga de ${internal.cargaKg} kg</span>
             </div>
             <p class="price-meta">${internal.label} · ${new Date(internal.scrapedAt).toLocaleDateString('es-CO')}</p>
           </div>`
        : ''
    }

    ${
      international
        ? `<div class="price-block price-block-secondary">
             <span class="price-block-label">Mercado internacional${international.contract ? ` · ${international.contract}` : ''}</span>
             <div class="price-international">
               <span class="tabular-nums">${formatUsdPerLb(international.usdPerLb)}</span>
               <span class="price-unit">por libra de café excelso</span>
               ${
                 international.changePct != null
                   ? `<span class="price-change ${changeClass} tabular-nums">
                        ${international.changePct >= 0 ? '+' : ''}${international.changePct.toFixed(2)}%
                      </span>`
                   : ''
               }
             </div>
             <p class="price-meta">
               ${international.exchange || 'Bolsa'}
               ${international.quotedAt ? ` · cotización ${timeAgo(international.quotedAt)}` : ''}
               ${international.granularity === 'mensual' ? ' · <strong>promedio del mes, no cotización viva</strong>' : ''}
             </p>
           </div>`
        : ''
    }

    ${
      exportParity
        ? `<details class="parity">
             <summary>
               Paridad de exportación: <strong class="tabular-nums">${formatCop(exportParity.copPerCarga)}</strong> por carga
             </summary>
             <p class="disclaimer">${exportParity.note}</p>
             <p class="disclaimer">
               Una carga de 125 kg de pergamino rinde ${exportParity.excelsoLbPerCarga.toFixed(0)} libras de excelso
               (factor ${exportParity.factor}), no 275. Por eso este número no se calcula sobre el peso del pergamino.
             </p>
           </details>`
        : ''
    }
  `;
}

export async function renderPriceChart(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h2>Precio del café</h2>
        <span id="price-badge" class="badge skeleton" style="width: 130px; height: 20px;"></span>
      </div>
      <div id="price-body">
        <span class="skeleton" style="width: 220px; height: 2.6rem;"></span>
      </div>
      <canvas id="price-canvas" height="140"></canvas>
      <p class="chart-caption" id="chart-caption"></p>
    </div>
  `;

  const badge = container.querySelector('#price-badge');
  const bodyEl = container.querySelector('#price-body');
  const canvas = container.querySelector('#price-canvas');
  const captionEl = container.querySelector('#chart-caption');

  let chart = null;

  try {
    const [market, history] = await Promise.all([api.currentPrice(), api.priceHistory(30)]);

    renderBadge(badge, market.international);
    renderPrices(bodyEl, market);

    chart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: history.map((h) => new Date(h.quotedAt || h.fetchedAt).toLocaleDateString('es-CO')),
        datasets: [
          {
            label: 'US$ por libra',
            data: history.map((h) => h.usdPerLb),
            borderColor: '#d4a017',
            backgroundColor: 'rgba(212,160,23,0.16)',
            pointRadius: 0,
            borderWidth: 2,
            tension: 0.3,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        animation: { duration: 400, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#123526',
            borderColor: '#2f5c47',
            borderWidth: 1,
            titleColor: '#f2e9db',
            bodyColor: '#f2e9db',
            padding: 10,
            callbacks: { label: (ctx) => `US$ ${ctx.parsed.y.toFixed(2)} por libra` },
          },
        },
        scales: {
          x: { grid: { color: 'rgba(47,92,71,0.5)' }, ticks: { color: '#a9c2b3', maxTicksLimit: 6 } },
          y: { beginAtZero: false, grid: { color: 'rgba(47,92,71,0.5)' }, ticks: { color: '#a9c2b3' } },
        },
      },
    });

    captionEl.textContent = 'Evolución de la cotización internacional, en dólares por libra.';
    startAutoRefresh();
  } catch (err) {
    badge.className = 'badge';
    badge.textContent = '';
    bodyEl.innerHTML = `<p class="panel-error">No se pudo cargar el precio: ${err.message}</p>`;
  }

  /** Repinta solo los números; el gráfico se deja quieto para no parpadear. */
  function startAutoRefresh() {
    let stopped = false;

    async function refresh() {
      try {
        const market = await api.currentPrice();
        renderBadge(badge, market.international);
        renderPrices(bodyEl, market);
      } catch (err) {
        // Un fallo puntual de red no debe romper la pantalla: se reintenta al siguiente ciclo.
      }
    }

    function stop() {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      if (chart) chart.destroy();
    }

    // Al volver a la app el usuario ve el dato fresco de una vez, sin esperar el ciclo.
    function onVisible() {
      if (stopped || document.hidden) return;
      if (!document.body.contains(container)) return stop();
      refresh();
    }

    const timer = setInterval(() => {
      // Al cambiar de pantalla el nodo deja de existir: se corta el ciclo.
      if (!document.body.contains(container)) return stop();

      // Con la pestaña en segundo plano no tiene sentido gastar los datos del usuario.
      if (document.hidden) return;

      refresh();
    }, REFRESH_MS);

    document.addEventListener('visibilitychange', onVisible);
  }
}
