import { renderPriceChart } from './priceChart.js';
import { renderCooperativesTable } from './cooperativesTable.js';
import { renderForecastPanel } from './forecastPanel.js';

/** El encabezado y la navegación los pinta el shell; aquí solo van los paneles. */
export function renderDashboard(container) {
  container.innerHTML = `
    <div class="dashboard-grid">
      <section id="price-section" class="av-fade-in" style="--av-delay: 0ms"></section>
      <section id="forecast-section" class="av-fade-in" style="--av-delay: 60ms"></section>
      <section id="coop-section" class="span-2 av-fade-in" style="--av-delay: 120ms"></section>
    </div>
  `;

  renderPriceChart(container.querySelector('#price-section'));
  renderForecastPanel(container.querySelector('#forecast-section'));
  renderCooperativesTable(container.querySelector('#coop-section'));
}
