import { api } from '../services/api.js';
import { formatCop, formatUsd, LB_PER_CARGA } from '../utils/currency.js';

function formatUsdPerCarga(usdPerLb) {
  return `US$ ${formatUsd(usdPerLb * LB_PER_CARGA)}`;
}

/** Cacao: sin estimaciones. Muestra la referencia de Agronet y el precio solo de quien tenga reportes. */
async function renderCocoaBuyers(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="panel-header"><h2>Compradores de cacao</h2></div>
      <div id="cocoa-ref"><span class="skeleton" style="width: 220px; height: 16px;"></span></div>
      <div class="table-scroll">
        <table class="coop-table">
          <thead><tr><th>#</th><th>Comprador</th><th>Región</th><th>Precio reportado (por kilo)</th></tr></thead>
          <tbody id="cocoa-tbody"></tbody>
        </table>
      </div>
      <p class="highlight-note">¿Vendiste cacao? <a href="#/reportar">Reporta lo que te pagaron</a>: con 2 productores distintos el precio de ese comprador aparece aquí.</p>
      <p class="disclaimer" id="cocoa-disclaimer"></p>
    </div>
  `;

  const refEl = container.querySelector('#cocoa-ref');
  const tbody = container.querySelector('#cocoa-tbody');

  try {
    const data = await api.cooperatives('cocoa');
    container.querySelector('#cocoa-disclaimer').textContent = data.disclaimer;

    refEl.innerHTML = data.reference
      ? `<p>Referencia semanal de la industria (Agronet, semana del ${data.reference.weekLabel}): <strong class="tabular-nums">${formatCop(
          data.reference.priceCopKg
        )}</strong> por kilo ${
          data.reference.isStale ? '<span class="badge badge-stale">Desactualizado</span>' : '<span class="badge badge-real">Dato real</span>'
        }</p>`
      : `<p class="panel-error">${data.error || 'Sin datos disponibles todavía.'}</p>`;

    tbody.innerHTML = data.cooperatives.length
      ? data.cooperatives
          .map(
            (c) => `
          <tr class="${c.isHighestBuyer ? 'row-highest' : ''} ${c.isLowestBuyer ? 'row-lowest' : ''}">
            <td data-label="#" class="cell-rank">${c.rank ?? '—'}</td>
            <td data-label="Comprador" class="cell-name">${c.name} ${
              c.isHighestBuyer ? '<span class="tag tag-best">Paga más</span>' : ''
            }${c.isLowestBuyer ? '<span class="tag tag-worst">Paga menos</span>' : ''}</td>
            <td data-label="Región">${c.region || '—'}</td>
            <td data-label="Precio por kilo" class="tabular-nums">${
              c.priceCopKg != null
                ? `<span class="cop">${formatCop(c.priceCopKg)}</span> <span class="tag tag-reported">Reportado</span>`
                : '<span class="price-secondary">Sin reportes aún</span>'
            }</td>
          </tr>`
          )
          .join('')
      : '<tr><td colspan="4">Todavía no hay compradores registrados.</td></tr>';
    tbody.classList.add('av-fade-in');
  } catch (err) {
    refEl.innerHTML = `<p class="panel-error">No se pudo cargar la comparación: ${err.message}</p>`;
  }
}

export async function renderCooperativesTable(container, market = 'coffee') {
  if (market === 'cocoa') return renderCocoaBuyers(container);

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
            <td data-label="#" class="cell-rank">${c.rank}</td>
            <td data-label="Cooperativa" class="cell-name">${c.name} ${
          c.isHighestBuyer ? '<span class="tag tag-best">Paga más</span>' : ''
        }${c.isLowestBuyer ? '<span class="tag tag-worst">Paga menos</span>' : ''}</td>
            <td data-label="Región">${c.region || '—'}</td>
            <td data-label="Precio por carga" class="tabular-nums">
              <span class="cop">${formatCop(c.estimatedPriceCopCarga)}</span>
              ${c.estimatedPriceUsdPerLb != null ? `<span class="usd">${formatUsdPerCarga(c.estimatedPriceUsdPerLb)}</span>` : ''}
            </td>
            <td data-label="Diferencial" class="tabular-nums">${(c.differentialPct * 100).toFixed(1)}%</td>
          </tr>
        `
      )
      .join('');

    statusEl.classList.add('av-fade-in');
    tbody.classList.add('av-fade-in');
  } catch (err) {
    statusEl.innerHTML = `<p class="panel-error">No se pudo cargar la comparación: ${err.message}</p>`;
  }
}
