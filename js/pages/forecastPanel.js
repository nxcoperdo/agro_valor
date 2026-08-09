import { api } from '../services/api.js';
import { formatUsd, formatCop, copPerLbToCarga, usdPerLbToCarga } from '../utils/currency.js';

const LABELS = { '1d': 'Mañana', '7d': 'En una semana', '30d': 'En un mes' };

export async function renderForecastPanel(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h2>Proyección del precio (carga de 125kg)</h2>
      </div>
      <div class="forecast-cards" id="forecast-cards">
        ${['a', 'b', 'c']
          .map(
            () => `
              <div class="forecast-card">
                <span class="skeleton" style="width: 70%; height: 12px; margin-bottom: 10px;"></span>
                <span class="skeleton" style="width: 90%; height: 22px;"></span>
              </div>
            `
          )
          .join('')}
      </div>
    </div>
  `;

  const cardsEl = container.querySelector('#forecast-cards');

  try {
    const { forecasts } = await api.forecast();

    if (!forecasts.length) {
      cardsEl.innerHTML = '<p class="panel-error">Aún no hay suficiente historial de precios para proyectar.</p>';
      return;
    }

    cardsEl.innerHTML = forecasts
      .map(
        (f) => `
          <div class="forecast-card">
            <h3>${LABELS[f.horizon] || f.horizon}</h3>
            <div class="forecast-price tabular-nums">US$ ${formatUsd(usdPerLbToCarga(f.predictedPrice / 100))}</div>
            ${f.copPerLb != null ? `<div class="forecast-price-secondary tabular-nums">≈ ${formatCop(copPerLbToCarga(f.copPerLb))}</div>` : ''}
            <div class="forecast-date">${f.predictedForDate}</div>
            <div class="forecast-model">Modelo: ${f.modelParams.method || 'holt'}</div>
          </div>
        `
      )
      .join('');
  } catch (err) {
    cardsEl.innerHTML = `<p class="panel-error">No se pudo cargar la proyección: ${err.message}</p>`;
  }
}
