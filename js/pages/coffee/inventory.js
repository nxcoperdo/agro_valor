import { api } from '../../services/api.js';
import { isPro } from '../../services/auth.js';
import { paywall } from '../../ui/shell.js';
import { escapeHtml, formatKg, formatCopValue } from '../../utils/format.js';
import { statusBadge } from './lots.js';

/** Inventario por lote: kg iniciales, vendidos, disponibles, costo unitario y estado. */
export async function renderInventory(container) {
  if (!isPro()) {
    container.innerHTML = paywall('Inventario', 'Controla el café disponible por lote, con su costo real por kg y por carga.');
    return;
  }
  container.innerHTML = '<div class="panel"><span class="skeleton" style="width:100%;height:120px;"></span></div>';
  let data;
  try { data = await api.inventory(); } catch (err) {
    container.innerHTML = `<div class="panel"><p class="panel-error">${escapeHtml(err.message)}</p></div>`;
    return;
  }
  const withCost = data.items.length && data.items[0].costoKg != null;
  container.innerHTML = `
    <div class="panel"><div class="panel-header"><h2>Inventario por lote</h2></div>
      <div class="summary-cards"><div class="summary-card highlight"><h3>Kg disponibles</h3><strong class="tabular-nums">${formatKg(data.totalKgDisponibles)}</strong></div></div>
      ${data.items.length ? `<div class="table-scroll"><table class="coop-table"><thead><tr><th>Lote</th><th>Kg iniciales</th><th>Kg vendidos</th><th>Kg disponibles</th>${withCost ? '<th>Costo/kg</th><th>Costo/carga</th>' : ''}<th>Ubicación</th><th>Estado</th></tr></thead><tbody>
        ${data.items.map((i) => `<tr><td data-label="Lote"><a href="#/lote?id=${i.lot.id}">${escapeHtml(i.lot.code)}</a></td>
          <td data-label="Kg iniciales" class="tabular-nums">${formatKg(i.kgIniciales)}</td><td data-label="Kg vendidos" class="tabular-nums">${formatKg(i.kgVendidos)}</td>
          <td data-label="Kg disponibles" class="tabular-nums"><strong>${formatKg(i.kgDisponibles)}</strong></td>
          ${withCost ? `<td data-label="Costo/kg" class="tabular-nums">${formatCopValue(i.costoKg)}</td><td data-label="Costo/carga" class="tabular-nums">${formatCopValue(i.costoCarga)}</td>` : ''}
          <td data-label="Ubicación">${escapeHtml(i.location || '—')}</td><td data-label="Estado">${statusBadge(i.status)}</td></tr>`).join('')}</tbody></table></div>`
        : '<p class="empty-state">Aún no hay lotes en inventario. Termina el secado de un lote y envíalo a inventario.</p>'}</div>`;
}
