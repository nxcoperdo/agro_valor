import { api } from '../../services/api.js';
import { escapeHtml, formatKg, formatCopValue, formatPct, formatDateTime } from '../../utils/format.js';

const PAYMENTS = { efectivo: 'Efectivo', transferencia: 'Transferencia', credito: 'Crédito', otro: 'Otro' };

const row = (k, v, strong) => `<div class="rc-row ${strong ? 'is-strong' : ''}"><span>${k}</span><span class="tabular-nums">${v ?? '—'}</span></div>`;

/** Comprobante imprimible del proveedor. Solo muestra lo que devuelve /receipt (sin datos internos). */
export async function renderReceipt(container) {
  const params = new URLSearchParams((window.location.hash.split('?')[1]) || '');
  const id = params.get('id');
  container.innerHTML = '<div class="panel"><span class="skeleton" style="width:100%;height:160px;"></span></div>';
  let r;
  try {
    r = await api.receipt(id);
  } catch (err) {
    container.innerHTML = `<div class="panel"><p class="panel-error">${escapeHtml(err.message)}</p><a class="btn-ghost" href="#/compras">Volver</a></div>`;
    return;
  }
  container.innerHTML = `
    <div class="rc-actions">
      <a class="btn-ghost" href="#/compras">← Compras</a>
      <button type="button" class="btn-ghost" id="rc-print">Imprimir</button>
      <a class="btn-primary" href="/api/coffee/purchases/${Number(id)}/receipt.pdf?download=1">Descargar PDF</a>
    </div>
    <article class="panel receipt" aria-label="Comprobante ${escapeHtml(r.code)}">
      <header class="rc-head"><div><h2>${escapeHtml(r.business.name)}</h2>
        <p>${[r.business.nit && `NIT ${escapeHtml(r.business.nit)}`, escapeHtml(r.business.address), r.business.phone && `Tel. ${escapeHtml(r.business.phone)}`].filter(Boolean).join(' · ')}</p></div>
        <div class="rc-code"><strong>${escapeHtml(r.code)}</strong>${r.status === 'ANULADA' ? '<span class="badge badge-stale">ANULADA</span>' : ''}</div></header>
      ${row('Proveedor', escapeHtml(r.supplier.name))}
      ${row('Identificación', `${escapeHtml(r.supplier.idType)} ${escapeHtml(r.supplier.idNumber)}`)}
      ${row('Fecha y hora', formatDateTime(r.purchasedAt))}
      ${row('Tipo de producto', escapeHtml(r.productLabel || r.coffeeType))}
      <h3>Pesadas</h3>
      ${r.weighings.map((w, i) => row(`Pesada ${i + 1} · ${formatDateTime(w.at)}`, formatKg(w.pesoKg))).join('')}
      <hr />
      ${row('Kg recibidos', formatKg(r.pesoTotalCompra))}
      ${row(`Merma (${formatPct(r.porcentajeMermaInicial)})`, formatKg(r.kgDescontados))}
      ${row('Kg pagables', formatKg(r.pesoPagable), true)}
      ${row('Precio por carga (125 kg)', formatCopValue(r.precioCarga))}
      ${row('Precio por kg', formatCopValue(r.precioKg))}
      ${row('TOTAL PAGADO', formatCopValue(r.totalCompra), true)}
      ${row('Forma de pago', escapeHtml(PAYMENTS[r.paymentMethod] || r.paymentMethod))}
      ${r.paymentReference ? row('Referencia', escapeHtml(r.paymentReference)) : ''}
      ${r.notes ? row('Observaciones', escapeHtml(r.notes)) : ''}
      <div class="rc-sign"><div>Firma del proveedor</div><div>Firma de quien recibe</div></div>
    </article>`;
  container.querySelector('#rc-print').addEventListener('click', () => window.print());
  if (params.get('print')) setTimeout(() => window.print(), 300);
}
