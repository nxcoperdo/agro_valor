import { api } from '../../services/api.js';
import { isPro } from '../../services/auth.js';
import { paywall } from '../../ui/shell.js';
import { escapeHtml, formatKg, formatCopValue, formatPct } from '../../utils/format.js';

const card = (t, v, hl) => `<div class="summary-card ${hl ? 'highlight' : ''}"><h3>${t}</h3><strong class="tabular-nums">${v}</strong></div>`;
const money = (v) => (v == null ? '—' : formatCopValue(v));

/** Panel de café: indicadores del negocio. Costos y utilidad solo aparecen si el rol puede verlos. */
export async function renderCoffeeDashboard(container) {
  if (!isPro()) {
    container.innerHTML = paywall('Panel de café', 'Indicadores de compras, inventario, ventas y utilidad en un vistazo.');
    return;
  }
  container.innerHTML = '<div class="panel"><span class="skeleton" style="width:100%;height:120px;"></span></div>';
  let d;
  try { d = await api.coffeeDashboard(); } catch (err) {
    container.innerHTML = `<div class="panel"><p class="panel-error">${escapeHtml(err.message)}</p></div>`;
    return;
  }
  container.innerHTML = `
    <div class="panel"><div class="panel-header"><h2>Hoy</h2></div>
      <div class="summary-cards">${card('Compras hoy', d.comprasHoy)}${card('Kg comprados hoy', formatKg(d.kgCompradosHoy))}</div></div>
    <div class="panel"><div class="panel-header"><h2>Operación</h2></div>
      <div class="summary-cards">${card('Kg comprados', formatKg(d.kgComprados))}${card('Total invertido', money(d.totalInvertido))}
        ${card('Lotes activos', d.lotesActivos)}${card('Kg en inventario', formatKg(d.kgInventario), true)}${card('Ventas', money(d.ventas))}
        ${d.costoPromedioKg !== undefined ? card('Costo promedio por kg', money(d.costoPromedioKg)) + card('Costo promedio por carga', money(d.costoPromedioCarga)) : ''}
        ${d.utilidad !== undefined ? card('Utilidad', money(d.utilidad), true) + card('Margen', d.margen == null ? '—' : formatPct(d.margen), true) : ''}</div>
      <div class="rc-actions"><a class="btn-primary" href="#/compras">Nueva compra</a><a class="btn-ghost" href="#/lotes">Lotes</a>
        <a class="btn-ghost" href="#/inventario">Inventario</a><a class="btn-ghost" href="#/ventas-cafe">Ventas</a><a class="btn-ghost" href="#/reportes-cafe">Reportes</a></div></div>`;
}
