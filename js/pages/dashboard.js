import { getCachedUser, logout } from '../services/auth.js';
import { renderPriceChart } from './priceChart.js';
import { renderCooperativesTable } from './cooperativesTable.js';
import { renderForecastPanel } from './forecastPanel.js';

export function renderDashboard(root) {
  const user = getCachedUser();

  root.innerHTML = `
    <div class="dashboard">
      <header class="dashboard-header">
        <div class="brand">
          <img class="brand-icon-img" src="img/logo-icon.png" alt="" width="32" height="32" />
          <h1 class="brand-word"><span class="brand-agro">Agro</span><span class="brand-valor">Valor</span></h1>
        </div>
        <div class="dashboard-user">
          <span>${user ? user.username : ''}</span>
          <button id="logout-btn" type="button">Salir</button>
        </div>
      </header>
      <main class="dashboard-grid">
        <section id="price-section" class="av-fade-in" style="--av-delay: 0ms"></section>
        <section id="forecast-section" class="av-fade-in" style="--av-delay: 60ms"></section>
        <section id="coop-section" class="span-2 av-fade-in" style="--av-delay: 120ms"></section>
      </main>
    </div>
  `;

  root.querySelector('#logout-btn').addEventListener('click', logout);

  renderPriceChart(root.querySelector('#price-section'));
  renderForecastPanel(root.querySelector('#forecast-section'));
  renderCooperativesTable(root.querySelector('#coop-section'));
}
