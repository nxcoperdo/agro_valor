import { api } from '../../services/api.js';
import { escapeHtml } from '../../utils/format.js';
import { consolidatedCards } from './purchases.js';

/** Resumen del día: tarjetas, imprimir y PDF. La fecha se elige con el selector. */
export async function renderDaySummary(container) {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  async function load(date) {
    container.innerHTML = '<div class="panel"><span class="skeleton" style="width:100%;height:160px;"></span></div>';
    let s;
    try { s = await api.daySummary(date); } catch (err) {
      container.innerHTML = `<div class="panel"><p class="panel-error">${escapeHtml(err.message)}</p></div>`;
      return;
    }
    container.innerHTML = `
      <div class="rc-actions"><a class="btn-ghost" href="#/compras">← Compras</a>
        <button type="button" class="btn-ghost" id="ds-print">Imprimir</button>
        <a class="btn-primary" href="/api/coffee/day-summary.pdf?date=${encodeURIComponent(s.date)}&download=1">Descargar PDF</a></div>
      <div class="panel"><div class="panel-header"><h2>Resumen del día</h2></div>
        <div class="field" style="max-width:220px"><label for="ds-date">Fecha</label><input type="date" id="ds-date" value="${escapeHtml(s.date)}" /></div>
        ${consolidatedCards(s)}</div>`;
    container.querySelector('#ds-date').addEventListener('change', (e) => e.target.value && load(e.target.value));
    container.querySelector('#ds-print').addEventListener('click', () => window.print());
  }
  await load(params.get('date') || undefined);
}
