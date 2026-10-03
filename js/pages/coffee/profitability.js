import { api } from '../../services/api.js';
import { isPro } from '../../services/auth.js';
import { paywall } from '../../ui/shell.js';
import { escapeHtml, formatKg, formatCopValue, formatPct } from '../../utils/format.js';

const card = (t, v, hl) => `<div class="summary-card ${hl ? 'highlight' : ''}"><h3>${t}</h3><strong class="tabular-nums">${v}</strong></div>`;
const money = (v) => (v == null ? '—' : formatCopValue(v));
const signed = (v) => (v == null ? '—' : `<span class="${v >= 0 ? 'delta-up' : 'delta-down'}">${formatCopValue(v)}</span>`);

/** Rentabilidad real: global y por lote. Solo roles con permiso de rentabilidad. */
export async function renderProfitability(container) {
  if (!isPro()) {
    container.innerHTML = paywall('Rentabilidad', 'Mide ingreso, costo real, utilidad y margen de cada lote.');
    return;
  }
  container.innerHTML = '<div class="panel"><span class="skeleton" style="width:100%;height:120px;"></span></div>';
  let d;
  try { d = await api.profitability(); } catch (err) {
    container.innerHTML = `<div class="panel"><p class="panel-error">${escapeHtml(err.status === 403 ? 'Tu rol no tiene acceso a la rentabilidad.' : err.message)}</p></div>`;
    return;
  }
  const o = d.overall;
  container.innerHTML = `
    <div class="panel"><div class="panel-header"><h2>Rentabilidad real</h2></div>
      <div class="summary-cards">${card('Ingreso por ventas', money(o.ingresoVenta))}${card('Costo de la mercancía vendida', money(o.costoMercanciaVendida))}
        ${card('Utilidad real', money(o.utilidadReal), true)}${card('Margen real', o.margenReal == null ? '—' : formatPct(o.margenReal), true)}${card('Kg vendidos', formatKg(o.kgVendidos))}</div></div>
    <div class="panel"><div class="panel-header"><h2>Utilidad por lote</h2></div>
      ${d.lots.length ? `<div class="table-scroll"><table class="coop-table"><thead><tr><th>Lote</th><th>Inversión</th><th>Costos</th><th>Ventas</th><th>Inventario pendiente</th><th>Utilidad realizada</th><th>Utilidad pendiente</th><th>Margen</th></tr></thead><tbody>
        ${d.lots.map((l) => `<tr><td data-label="Lote"><a href="#/lote?id=${l.lot.id}">${escapeHtml(l.lot.code)}</a></td>
          <td data-label="Inversión" class="tabular-nums">${money(l.inversion)}</td><td data-label="Costos" class="tabular-nums">${money(l.costos)}</td>
          <td data-label="Ventas" class="tabular-nums">${money(l.ventas)}</td>
          <td data-label="Inventario pendiente" class="tabular-nums">${formatKg(l.kgInventarioPendiente)} · ${money(l.inventarioPendienteACosto)}</td>
          <td data-label="Utilidad realizada" class="tabular-nums">${signed(l.utilidadRealizada)}</td><td data-label="Utilidad pendiente" class="tabular-nums">${signed(l.utilidadPendiente)}</td>
          <td data-label="Margen" class="tabular-nums">${l.margen == null ? '—' : formatPct(l.margen)}</td></tr>`).join('')}</tbody></table></div>`
        : '<p class="empty-state">Aún no hay lotes.</p>'}</div>`;
}
