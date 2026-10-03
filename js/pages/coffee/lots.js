import { api } from '../../services/api.js';
import { isPro } from '../../services/auth.js';
import { paywall } from '../../ui/shell.js';
import { renderProcessing } from './lotProcessing.js';
import { escapeHtml, formatKg, formatCopValue, formatDateTime } from '../../utils/format.js';

export const LOT_STATUS = {
  CREADO: 'Creado', EN_TRANSPORTE: 'En transporte', EN_SECADO: 'En secado', SECADO_FINALIZADO: 'Secado finalizado',
  DISPONIBLE_PARA_VENTA: 'Disponible para venta', PARCIALMENTE_VENDIDO: 'Parcialmente vendido', VENDIDO: 'Vendido', CERRADO: 'Cerrado',
};
export const statusBadge = (s) => `<span class="badge badge-real">${escapeHtml(LOT_STATUS[s] || s)}</span>`;
const card = (t, v, hl) => `<div class="summary-card ${hl ? 'highlight' : ''}"><h3>${t}</h3><strong class="tabular-nums">${v}</strong></div>`;
const NEXT = { CREADO: ['EN_TRANSPORTE', 'Enviar a transporte'], EN_TRANSPORTE: ['EN_SECADO', 'Iniciar secado'], VENDIDO: ['CERRADO', 'Cerrar lote'] };

/** Lotes: lista, y creación agrupando compras sin lote. */
export async function renderLots(container) {
  if (!isPro()) {
    container.innerHTML = paywall('Lotes y procesamiento', 'Agrupa compras en lotes y sigue el secado, el inventario y la rentabilidad.');
    return;
  }
  async function load() {
    container.innerHTML = '<div class="panel"><span class="skeleton" style="width:100%;height:120px;"></span></div>';
    let lots, free;
    try {
      [{ lots }, { purchases: free }] = await Promise.all([api.lots(), api.purchases({ noLot: '1', status: 'ACTIVA' })]);
    } catch (err) {
      container.innerHTML = `<div class="panel"><p class="panel-error">${escapeHtml(err.message)}</p></div>`;
      return;
    }
    container.innerHTML = `
      <div class="panel"><div class="panel-header"><h2>Crear lote</h2></div>
        ${free.length ? `<form id="lot-form"><div class="pick-grid">${free.map((p) => `
          <label class="pick-check"><input type="checkbox" name="purchase" value="${p.id}" />
            <span><strong>${escapeHtml(p.code)}</strong> · ${escapeHtml(p.supplier.name)}<br /><small>${formatKg(p.pesoPagable)} pagables · ${formatCopValue(p.totalCompra)}</small></span></label>`).join('')}</div>
          <div class="field"><label for="lot-notes">Observaciones</label><input id="lot-notes" name="notes" /></div>
          <button type="submit" class="btn-primary">Crear lote</button></form>`
          : '<p class="empty-state">No hay compras activas sin lote.</p>'}
        <p class="form-error" id="lot-error" role="alert" hidden></p></div>
      <div class="panel"><div class="panel-header"><h2>Lotes</h2></div>
        ${lots.length ? `<div class="table-scroll"><table class="coop-table"><thead><tr><th>Lote</th><th>Estado</th><th>Compras</th><th>Proveedores</th><th>Peso pagable</th><th>Peso proyectado</th><th>Total compra</th></tr></thead><tbody>
          ${lots.map((l) => `<tr><td data-label="Lote"><a href="#/lote?id=${l.id}">${escapeHtml(l.code)}</a></td><td data-label="Estado">${statusBadge(l.status)}</td>
            <td data-label="Compras" class="tabular-nums">${l.compras}</td><td data-label="Proveedores" class="tabular-nums">${l.proveedores}</td>
            <td data-label="Peso pagable" class="tabular-nums">${formatKg(l.pesoPagable)}</td><td data-label="Peso proyectado" class="tabular-nums">${formatKg(l.pesoProyectado)}</td>
            <td data-label="Total compra" class="tabular-nums">${formatCopValue(l.totalCompra)}</td></tr>`).join('')}</tbody></table></div>`
          : '<p class="empty-state">Aún no hay lotes.</p>'}</div>`;
    container.querySelector('#lot-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const purchaseIds = [...e.target.querySelectorAll('[name=purchase]:checked')].map((i) => Number(i.value));
      try {
        const lot = await api.createLot({ purchaseIds, notes: e.target.notes.value });
        window.location.hash = `#/lote?id=${lot.id}`;
      } catch (err) { const el = container.querySelector('#lot-error'); el.textContent = err.message; el.hidden = false; }
    });
  }
  await load();
}

/** Detalle del lote: trazabilidad Proveedor → Compra → Pesadas → Jornada → Lote. */
export async function renderLotDetail(container) {
  const id = new URLSearchParams(window.location.hash.split('?')[1] || '').get('id');
  async function load() {
    container.innerHTML = '<div class="panel"><span class="skeleton" style="width:100%;height:160px;"></span></div>';
    let l;
    try { l = await api.lot(id); } catch (err) {
      container.innerHTML = `<div class="panel"><p class="panel-error">${escapeHtml(err.message)}</p><a class="btn-ghost" href="#/lotes">Volver</a></div>`;
      return;
    }
    const next = NEXT[l.status];
    container.innerHTML = `
      <div class="rc-actions"><a class="btn-ghost" href="#/lotes">← Lotes</a>
        ${next ? `<button type="button" class="btn-primary" id="lot-next">${next[1]}</button>` : ''}</div>
      <div class="panel"><div class="panel-header"><h2>${escapeHtml(l.code)}</h2>${statusBadge(l.status)}</div>
        <p class="panel-intro">Creado ${formatDateTime(l.createdAt)}${l.notes ? ` · ${escapeHtml(l.notes)}` : ''}</p>
        <div class="summary-cards">${card('Compras', l.compras)}${card('Proveedores', l.proveedores)}${card('Peso pagable', formatKg(l.pesoPagable), true)}
          ${card('Peso proyectado', formatKg(l.pesoProyectado))}${card('Total compra', formatCopValue(l.totalCompra))}
          ${l.costosCompra != null ? card('Costos de compra', formatCopValue(l.costosCompra)) : ''}</div></div>
      <div class="panel"><div class="panel-header"><h2>Compras incluidas</h2></div>
        <div class="table-scroll"><table class="coop-table"><thead><tr><th>Compra</th><th>Proveedor</th><th>Jornada</th><th>Pesadas</th><th>Kg recibidos</th><th>Kg pagables</th><th>Total</th><th></th></tr></thead><tbody>
        ${l.purchases.map((p) => `<tr><td data-label="Compra"><a href="#/compra?id=${p.id}">${escapeHtml(p.code)}</a></td>
          <td data-label="Proveedor">${escapeHtml(p.supplier.name)}<br /><small>${escapeHtml(p.supplier.idType)} ${escapeHtml(p.supplier.idNumber)}</small></td>
          <td data-label="Jornada">${escapeHtml(p.workdayCode || '—')}</td>
          <td data-label="Pesadas">${p.weighings.map((w) => formatKg(w.pesoKg)).join(' + ')}</td>
          <td data-label="Kg recibidos" class="tabular-nums">${formatKg(p.pesoTotalCompra)}</td><td data-label="Kg pagables" class="tabular-nums">${formatKg(p.pesoPagable)}</td>
          <td data-label="Total" class="tabular-nums">${formatCopValue(p.totalCompra)}</td>
          <td>${l.status === 'CREADO' && l.purchases.length > 1 ? `<button type="button" class="btn-ghost" data-rm="${p.id}">Quitar</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div><p class="form-error" id="lot-error" role="alert" hidden></p></div>
      <div id="lot-extra"></div>`;
    const fail = (err) => { const el = container.querySelector('#lot-error'); el.textContent = err.message; el.hidden = false; };
    container.querySelector('#lot-next')?.addEventListener('click', async () => { try { await api.changeLotStatus(id, next[0]); await load(); } catch (err) { fail(err); } });
    container.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', async () => { try { await api.removeLotPurchase(id, b.dataset.rm); await load(); } catch (err) { fail(err); } }));
    await renderProcessing(container.querySelector('#lot-extra'), l, load);
  }
  await load();
}
