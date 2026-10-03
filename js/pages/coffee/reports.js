import { api } from '../../services/api.js';
import { isPro } from '../../services/auth.js';
import { paywall } from '../../ui/shell.js';
import { escapeHtml, formatKg, formatCopValue, formatPct } from '../../utils/format.js';

const TYPES = {
  diario: 'Diario', semanal: 'Semanal', mensual: 'Mensual', proveedor: 'Por proveedor', comprador: 'Por comprador', lote: 'Por lote',
  factor: 'Por factor', 'tipo-cafe': 'Por tipo de café', jornada: 'Por jornada', ventas: 'Por ventas', rentabilidad: 'Por rentabilidad',
};
const HEAD = {
  label: 'Detalle', compras: 'Compras', kgRecibidos: 'Kg recibidos', kgPagables: 'Kg pagables', totalPagado: 'Total pagado', precioCargaPromedio: 'Precio carga promedio',
  mermaPromedio: 'Merma promedio', rendimientoLotes: 'Rendimiento de lotes', estado: 'Estado', compraOriginal: 'Compra original', pesoPagable: 'Peso pagable',
  proyeccionKgSecos: 'Proyección (kg secos)', realKgSecos: 'Real (kg secos)', inventarioKg: 'Inventario (kg)', vendidosKg: 'Vendidos (kg)', costoRealTotal: 'Costo real',
  utilidadRealizada: 'Utilidad realizada', utilidadPendiente: 'Utilidad pendiente', ventas: 'Ventas', kgVendidos: 'Kg vendidos', precioPromedioKg: 'Precio promedio/kg',
  ingreso: 'Ingreso', fecha: 'Fecha', cliente: 'Cliente', kg: 'Kg', total: 'Total', inversion: 'Inversión', costos: 'Costos', margen: 'Margen',
};
const KG = new Set(['kgRecibidos', 'kgPagables', 'pesoPagable', 'proyeccionKgSecos', 'realKgSecos', 'inventarioKg', 'vendidosKg', 'kgVendidos', 'kg']);
const PCT = new Set(['mermaPromedio', 'rendimientoLotes', 'margen']);
const COP = new Set(['totalPagado', 'precioCargaPromedio', 'compraOriginal', 'costoRealTotal', 'utilidadRealizada', 'utilidadPendiente', 'precioPromedioKg', 'ingreso', 'total', 'inversion', 'costos']);

function cell(type, key, v) {
  if (v == null) return '—';
  if (key === 'ventas' && type !== 'factor') return formatCopValue(v);
  if (KG.has(key)) return formatKg(v);
  if (PCT.has(key)) return formatPct(v);
  if (COP.has(key)) return formatCopValue(v);
  return escapeHtml(v);
}

/** Reportes generales con tabla genérica y PDF. Los campos que el rol no puede ver llegan ya recortados del servidor. */
export async function renderCoffeeReports(container) {
  if (!isPro()) {
    container.innerHTML = paywall('Reportes de café', 'Reportes por periodo, proveedor, lote, factor, jornada, ventas y rentabilidad, con PDF.');
    return;
  }
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  let type = TYPES[params.get('type')] ? params.get('type') : 'diario';
  container.innerHTML = `
    <div class="panel"><div class="panel-header"><h2>Reportes</h2></div>
      <form class="calc-form" id="rp-form">
        <div class="field"><label for="rp-type">Reporte</label><select id="rp-type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${k === type ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="field"><label for="rp-from">Desde</label><input type="date" id="rp-from" /></div>
        <div class="field"><label for="rp-to">Hasta</label><input type="date" id="rp-to" /></div>
        <button type="submit" class="btn-primary">Ver reporte</button>
      </form>
      <div id="rp-actions" class="rc-actions" hidden><button type="button" class="btn-ghost" id="rp-print">Imprimir</button><a class="btn-primary" id="rp-pdf" href="#">Descargar PDF</a></div>
      <p class="form-error" id="rp-error" role="alert" hidden></p><div id="rp-result"></div></div>`;
  const q = (s) => container.querySelector(s);
  async function run() {
    type = q('#rp-type').value;
    const p = {};
    if (q('#rp-from').value) p.from = q('#rp-from').value;
    if (q('#rp-to').value) p.to = q('#rp-to').value;
    q('#rp-error').hidden = true;
    try {
      const r = await api.coffeeReport(type, p);
      const keys = r.rows.length ? Object.keys(r.rows[0]) : [];
      q('#rp-result').innerHTML = r.rows.length ? `<div class="table-scroll"><table class="coop-table"><thead><tr>${keys.map((k) => `<th>${escapeHtml(HEAD[k] || k)}</th>`).join('')}</tr></thead><tbody>
        ${r.rows.map((row) => `<tr>${keys.map((k) => `<td data-label="${escapeHtml(HEAD[k] || k)}" class="tabular-nums">${cell(type, k, row[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="empty-state">Sin datos para este periodo.</p>';
      q('#rp-actions').hidden = false;
      q('#rp-pdf').href = `/api/coffee/reports/${type}/pdf?${new URLSearchParams({ ...p, download: 1 })}`;
    } catch (err) { q('#rp-error').textContent = err.status === 403 ? 'Tu rol no tiene acceso a este reporte.' : err.message; q('#rp-error').hidden = false; q('#rp-result').innerHTML = ''; q('#rp-actions').hidden = true; }
  }
  q('#rp-form').addEventListener('submit', (e) => { e.preventDefault(); run(); });
  q('#rp-print').addEventListener('click', () => window.print());
  await run();
}
