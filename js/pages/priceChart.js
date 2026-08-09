import { Chart } from 'chart.js/auto';
import { api } from '../services/api.js';
import { formatUsd, formatCop, copPerLbToCarga } from '../utils/currency.js';

export async function renderPriceChart(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h2>Precio del café (futuros)</h2>
        <span id="price-badge" class="badge skeleton" style="width: 120px; height: 20px;"></span>
      </div>
      <div class="price-current"><span class="skeleton" style="width: 160px; height: 2.25rem;"></span></div>
      <div class="price-meta" id="price-meta"></div>
      <canvas id="price-canvas" height="140"></canvas>
    </div>
  `;

  const badge = container.querySelector('#price-badge');
  const currentEl = container.querySelector('.price-current');
  const metaEl = container.querySelector('#price-meta');
  const canvas = container.querySelector('#price-canvas');

  try {
    const [current, history] = await Promise.all([api.currentPrice(), api.priceHistory(30)]);

    currentEl.innerHTML = `
      <span class="tabular-nums">US$ ${formatUsd(current.price / 100)}/lb</span>
      ${current.copPerLb != null ? `<span class="price-secondary tabular-nums">≈ ${formatCop(copPerLbToCarga(current.copPerLb))}/carga (125kg)</span>` : ''}
    `;

    if (current.source === 'real') {
      badge.textContent = `Precio real · ${current.provider}`;
      badge.className = 'badge badge-real';
    } else {
      badge.textContent = 'Precio simulado';
      badge.className = 'badge badge-simulated';
    }

    if (current.exchangeRate) {
      const fxLabel = current.exchangeRate.source === 'real' ? 'tasa real' : 'tasa simulada';
      metaEl.textContent = `Cotización internacional (NY ICE), convertida a carga de 125kg para comparar con las cooperativas. 1 USD ≈ ${formatCop(current.exchangeRate.rate)} (${fxLabel})`;
    }

    // eslint-disable-next-line no-new
    new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: history.map((h) => new Date(h.fetched_at).toLocaleDateString()),
        datasets: [
          {
            label: 'Precio (¢/lb)',
            data: history.map((h) => h.price),
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56,189,248,0.14)',
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
            backgroundColor: '#1e293b',
            borderColor: '#334155',
            borderWidth: 1,
            titleColor: '#f8fafc',
            bodyColor: '#f8fafc',
            padding: 10,
          },
        },
        scales: {
          x: { grid: { color: 'rgba(51,65,85,0.4)' }, ticks: { color: '#94a3b8' } },
          y: { beginAtZero: false, grid: { color: 'rgba(51,65,85,0.4)' }, ticks: { color: '#94a3b8' } },
        },
      },
    });
  } catch (err) {
    badge.className = 'badge';
    badge.textContent = '';
    currentEl.textContent = '—';
    container.querySelector('.panel').insertAdjacentHTML(
      'beforeend',
      `<p class="panel-error">No se pudo cargar el precio: ${err.message}</p>`
    );
  }
}
