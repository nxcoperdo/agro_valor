import { renderPriceChart } from './priceChart.js';
import { renderCooperativesTable } from './cooperativesTable.js';
import { renderForecastPanel } from './forecastPanel.js';
import { renderMarketSelector, getSelectedMarket } from '../ui/marketSelector.js';

/**
 * Cuerpo del dashboard para un mercado. Se pinta sobre nodos nuevos en cada cambio de mercado
 * para que los temporizadores del mercado anterior (que se detienen al ver que su nodo ya no
 * está en el documento) no sigan escribiendo encima.
 * La tabla de compradores va en ambos mercados; en cacao no hay estimaciones, solo precios reportados.
 */
function renderBody(grid, market) {
  grid.innerHTML = `
    <section id="price-section" class="av-fade-in" style="--av-delay: 0ms"></section>
    <section id="forecast-section" class="av-fade-in" style="--av-delay: 60ms"></section>
    <section id="coop-section" class="span-2 av-fade-in" style="--av-delay: 120ms"></section>
  `;

  renderPriceChart(grid.querySelector('#price-section'), market);
  renderForecastPanel(grid.querySelector('#forecast-section'), market);
  renderCooperativesTable(grid.querySelector('#coop-section'), market);
}

/** El encabezado y la navegación los pinta el shell; aquí solo van el selector de mercado y los paneles. */
export function renderDashboard(container) {
  container.innerHTML = `
    <div class="market-bar" id="market-bar"></div>
    <div class="dashboard-grid" id="dashboard-grid"></div>
  `;

  const grid = container.querySelector('#dashboard-grid');
  const initial = getSelectedMarket();

  renderMarketSelector(container.querySelector('#market-bar'), {
    value: initial,
    onChange: (market) => renderBody(grid, market),
  });
  renderBody(grid, initial);
}
