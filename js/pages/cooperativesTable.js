import { api } from '../services/api.js';
import { formatCop, formatUsd, LB_PER_CARGA } from '../utils/currency.js';

function formatUsdPerCarga(usdPerLb) {
  return `US$ ${formatUsd(usdPerLb * LB_PER_CARGA)}`;
}

export async function renderCooperativesTable(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h2>Comparación de cooperativas</h2>
      </div>
      <div id="fnc-status">
        <span class="skeleton" style="width: 220px; height: 16px;"></span>
      </div>
      <div class="table-scroll">
        <table class="coop-table">
          <thead>
            <tr><th>#</th><th>Cooperativa</th><th>Región</th><th>Precio estimado (por carga de 125kg)</th><th>Diferencial</th></tr>
          </thead>
          <tbody id="coop-tbody"></tbody>
        </table>
      </div>
      <p class="disclaimer" id="coop-disclaimer"></p>
    </div>
  `;

  const statusEl = container.querySelector('#fnc-status');
  const tbody = container.querySelector('#coop-tbody');
  const disclaimerEl = container.querySelector('#coop-disclaimer');

  try {
    const data = await api.cooperatives();
    disclaimerEl.textContent = data.disclaimer;

    if (!data.fncReference) {
      statusEl.innerHTML = `<p class="panel-error">${data.error || 'Sin datos disponibles todavía.'}</p>`;
      return;
    }

    const staleBadge = data.fncReference.isStale
      ? `<span class="badge badge-stale">Dato FNC desactualizado desde ${new Date(
          data.fncReference.scrapedAt
        ).toLocaleString()}</span>`
      : `<span class="badge badge-real">Base FNC real · ${new Date(
          data.fncReference.scrapedAt
        ).toLocaleString()}</span>`;

    const fncUsd =
      data.fncReference.priceUsdPerLb != null
        ? ` <span class="price-secondary">(${formatUsdPerCarga(data.fncReference.priceUsdPerLb)})</span>`
        : '';

    statusEl.innerHTML = `<p>Precio interno de referencia FNC (por carga de 125kg): <strong class="tabular-nums">${formatCop(
      data.fncReference.priceCopCarga
    )}</strong>${fncUsd} ${staleBadge}</p>`;

    tbody.innerHTML = data.cooperatives
      .map(
        (c) => `
          <tr class="${c.isHighestBuyer ? 'row-highest' : ''} ${c.isLowestBuyer ? 'row-lowest' : ''}">
            <td>${c.rank}</td>
            <td>${c.name} ${c.isHighestBuyer ? '<span class="tag tag-best">Paga más</span>' : ''}${
          c.isLowestBuyer ? '<span class="tag tag-worst">Paga menos</span>' : ''
        }</td>
            <td>${c.region || '—'}</td>
            <td class="tabular-nums">
              <span class="cop">${formatCop(c.estimatedPriceCopCarga)}</span>
              ${c.estimatedPriceUsdPerLb != null ? `<span class="usd">${formatUsdPerCarga(c.estimatedPriceUsdPerLb)}</span>` : ''}
            </td>
            <td class="tabular-nums">${(c.differentialPct * 100).toFixed(1)}%</td>
          </tr>
        `
      )
      .join('');
  } catch (err) {
    statusEl.innerHTML = `<p class="panel-error">No se pudo cargar la comparación: ${err.message}</p>`;
  }
}
