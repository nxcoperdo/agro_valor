import { api } from '../services/api.js';
import { paywall } from '../ui/shell.js';
import { formatCop } from '../utils/currency.js';

const LABELS = { '1d': 'Mañana', '7d': 'En una semana', '30d': 'En un mes' };

export async function renderForecastPanel(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h2>Proyección del precio</h2>
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
      <p class="disclaimer" id="forecast-note"></p>
    </div>
  `;

  const cardsEl = container.querySelector('#forecast-cards');
  const noteEl = container.querySelector('#forecast-note');

  try {
    const { forecasts, note } = await api.forecast();

    if (!forecasts.length) {
      cardsEl.innerHTML =
        '<p class="empty-state">Aún no hay suficiente historial de precios para proyectar. Se necesitan al menos dos días de datos.</p>';
      return;
    }

    cardsEl.innerHTML = forecasts
      .map((f) => {
        const up = f.changePct != null && f.changePct >= 0;
        return `
          <div class="forecast-card">
            <h3>${LABELS[f.horizon] || f.horizon}</h3>
            ${
              f.changePct != null
                ? `<div class="forecast-change ${up ? 'delta-up' : 'delta-down'} tabular-nums">
                     ${up ? '▲' : '▼'} ${up ? '+' : ''}${f.changePct.toFixed(1)}%
                   </div>`
                : ''
            }
            ${
              f.impliedInternalCopPerCarga != null
                ? `<div class="forecast-price tabular-nums">${formatCop(f.impliedInternalCopPerCarga)}</div>
                   <div class="forecast-price-secondary">por carga, si el interno se mueve igual</div>`
                : ''
            }
            <div class="forecast-date">US$ ${f.usdPerLb.toFixed(2)}/lb · ${f.predictedForDate}</div>
          </div>
        `;
      })
      .join('');

    noteEl.textContent = note;
    cardsEl.classList.add('av-fade-in');
  } catch (err) {
    if (err.upgradeRequired) {
      container.innerHTML = paywall(
        'Proyección del precio',
        'Estima cómo puede moverse el precio del café mañana, en una semana y en un mes, para decidir si vender ahora o esperar.'
      );
      return;
    }
    cardsEl.innerHTML = `<p class="panel-error">No se pudo cargar la proyección: ${err.message}</p>`;
  }
}
