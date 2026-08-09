import { getCachedUser, logout } from '../services/auth.js';
import { renderPriceChart } from './priceChart.js';
import { renderCooperativesTable } from './cooperativesTable.js';
import { renderForecastPanel } from './forecastPanel.js';

const COFFEE_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8Z" />
    <line x1="6" y1="1" x2="6" y2="4" />
    <line x1="10" y1="1" x2="10" y2="4" />
    <line x1="14" y1="1" x2="14" y2="4" />
  </svg>
`;

export function renderDashboard(root) {
  const user = getCachedUser();

  root.innerHTML = `
    <div class="dashboard">
      <header class="dashboard-header">
        <div class="brand">
          <span class="brand-icon" aria-hidden="true">${COFFEE_ICON}</span>
          <h1>Agro Valor</h1>
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
