import { api } from '../../services/api.js';
import { isPro } from '../../services/auth.js';
import { paywall } from '../../ui/shell.js';
import { askReason } from '../../ui/confirm.js';
import { escapeHtml, formatKg, formatCopValue, formatFactor, parseNumber } from '../../utils/format.js';

const PAYMENTS = { efectivo: 'Efectivo', transferencia: 'Transferencia', credito: 'Crédito', otro: 'Otro' };

/** Ventas de café: vender un lote, parte de un lote o varios lotes, con comprobante PDF. */
export async function renderTradeSales(container) {
  if (!isPro()) {
    container.innerHTML = paywall('Ventas de café', 'Vende lotes completos o por partes, con comprobante y trazabilidad.');
    return;
  }
  async function load() {
    container.innerHTML = '<div class="panel"><span class="skeleton" style="width:100%;height:120px;"></span></div>';
    let inv, sales;
    try { [inv, { sales }] = await Promise.all([api.inventory(true), api.tradeSales()]); } catch (err) {
      container.innerHTML = `<div class="panel"><p class="panel-error">${escapeHtml(err.message)}</p></div>`;
      return;
    }
    const lotOptions = inv.items.map((i) => `<option value="${i.id}">${escapeHtml(i.lot.code)} · ${formatKg(i.kgDisponibles)} disp.</option>`).join('');
    container.innerHTML = `
      <div class="panel"><div class="panel-header"><h2>Nueva venta</h2></div>
        ${inv.items.length ? `<form id="sale-form">
          <div class="calc-form">
            <div class="field"><label for="cu-q">Buscar cliente</label><input id="cu-q" type="search" autocomplete="off" placeholder="Nombre o identificación" /><ul class="pick-list" id="cu-results"></ul></div>
            <div class="field"><label for="cu-type">Tipo identificación</label><select id="cu-type"><option>NIT</option><option>CC</option><option>CE</option><option>PASAPORTE</option><option>OTRO</option></select></div>
            <div class="field"><label for="cu-num">Número</label><input id="cu-num" inputmode="numeric" /></div>
            <div class="field"><label for="cu-name">Nombre del cliente</label><input id="cu-name" /></div>
          </div>
          <p class="form-hint" id="cu-selected"></p>
          <div id="sale-lines"></div>
          <button type="button" class="btn-ghost" id="add-line">+ Agregar lote</button>
          <div class="calc-form">
            <div class="field"><label for="sv-date">Fecha</label><input type="date" id="sv-date" value="${new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })}" /></div>
            <div class="field"><label for="sv-pay">Forma de pago</label><select id="sv-pay">${Object.entries(PAYMENTS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
            <div class="field"><label for="sv-ref">Referencia</label><input id="sv-ref" /></div>
          </div>
          <div class="summary-cards"><div class="summary-card highlight"><h3>Total de la venta</h3><strong class="tabular-nums" id="sale-total">${formatCopValue(0)}</strong></div></div>
          <button type="submit" class="btn-primary">Registrar venta</button></form>`
          : '<p class="empty-state">No hay inventario disponible para vender.</p>'}
        <p class="form-error" id="sale-error" role="alert" hidden></p></div>
      <div class="panel"><div class="panel-header"><h2>Ventas</h2></div>
        ${sales.length ? `<div class="table-scroll"><table class="coop-table"><thead><tr><th>Venta</th><th>Fecha</th><th>Cliente</th><th>Lotes</th><th>Kg</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
          ${sales.map((s) => `<tr class="${s.status === 'ANULADA' ? 'row-voided' : ''}"><td data-label="Venta">${escapeHtml(s.code)}</td><td data-label="Fecha">${escapeHtml(s.soldOn)}</td>
            <td data-label="Cliente">${escapeHtml(s.customer.name)}</td>
            <td data-label="Lotes">${s.items.map((i) => `${escapeHtml(i.lotCode)}${i.factor != null ? ` (${formatFactor(i.factor)})` : ''}`).join(', ')}</td>
            <td data-label="Kg" class="tabular-nums">${formatKg(s.items.reduce((a, i) => a + i.kg, 0))}</td><td data-label="Total" class="tabular-nums">${formatCopValue(s.total)}</td>
            <td data-label="Estado"><span class="badge ${s.status === 'ANULADA' ? 'badge-stale' : 'badge-real'}">${s.status}</span></td>
            <td data-label="Acciones" class="row-actions"><a class="btn-ghost" href="/api/coffee/sales/${s.id}/receipt.pdf" target="_blank" rel="noopener">PDF</a>
              <a class="btn-ghost" href="/api/coffee/sales/${s.id}/receipt.pdf?download=1">Descargar</a>
              ${s.status === 'ACTIVA' ? `<button type="button" class="btn-danger" data-void="${s.id}">Anular</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
          : '<p class="empty-state">Aún no hay ventas.</p>'}</div>`;

    const form = container.querySelector('#sale-form');
    const err = (m) => { const e = container.querySelector('#sale-error'); e.textContent = m; e.hidden = !m; };
    container.querySelectorAll('[data-void]').forEach((b) => b.addEventListener('click', async () => {
      const reason = await askReason({ title: 'Anular venta', message: 'La venta no se borra: queda anulada y el inventario vuelve a estar disponible.', label: 'Motivo de la anulación', confirmLabel: 'Anular venta', danger: true });
      if (!reason) return;
      try { await api.voidTradeSale(b.dataset.void, reason); await load(); } catch (e) { err(e.message); }
    }));
    if (!form) return;

    let customerId = null;
    const lines = container.querySelector('#sale-lines');
    const total = () => {
      const t = [...lines.querySelectorAll('.sale-line')].reduce((a, l) => {
        const kg = parseNumber(l.querySelector('[data-f=kg]').value) || 0;
        const precio = parseNumber(l.querySelector('[data-f=precio]').value) || 0;
        return a + Math.round((kg * precio) / 125);
      }, 0);
      container.querySelector('#sale-total').textContent = formatCopValue(t);
    };
    const addLine = () => {
      const d = document.createElement('div');
      d.className = 'calc-form sale-line';
      d.innerHTML = `<div class="field"><label>Lote</label><select data-f="lot">${lotOptions}</select></div>
        <div class="field"><label>Kg a vender</label><input data-f="kg" inputmode="decimal" /></div>
        <div class="field"><label>Factor</label><input data-f="factor" inputmode="decimal" /></div>
        <div class="field"><label>Precio por carga</label><input data-f="precio" inputmode="numeric" /></div>
        <button type="button" class="btn-ghost" data-rm>Quitar</button>`;
      d.querySelector('[data-rm]').addEventListener('click', () => { d.remove(); total(); });
      d.querySelectorAll('input').forEach((i) => i.addEventListener('input', total));
      lines.appendChild(d);
    };
    addLine();
    container.querySelector('#add-line').addEventListener('click', addLine);

    const q = container.querySelector('#cu-q');
    const results = container.querySelector('#cu-results');
    let timer;
    q.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (q.value.trim().length < 2) { results.innerHTML = ''; return; }
        const { customers } = await api.searchCustomers(q.value.trim());
        results.innerHTML = customers.map((c) => `<li><button type="button" class="pick" data-id="${c.id}" data-name="${escapeHtml(c.name)}">${escapeHtml(c.name)} <small>${escapeHtml(c.idType)} ${escapeHtml(c.idNumber)}</small></button></li>`).join('') || '<li class="form-hint">Sin resultados: completa los datos para crearlo</li>';
      }, 250);
    });
    results.addEventListener('click', (e) => {
      const b = e.target.closest('.pick');
      if (!b) return;
      customerId = Number(b.dataset.id);
      container.querySelector('#cu-selected').innerHTML = `Cliente: <strong>${escapeHtml(b.dataset.name)}</strong>`;
      results.innerHTML = '';
    });
    ['#cu-num', '#cu-name'].forEach((s) => container.querySelector(s).addEventListener('input', () => { customerId = null; container.querySelector('#cu-selected').textContent = ''; }));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err('');
      const payload = {
        soldOn: form.querySelector('#sv-date').value,
        paymentMethod: form.querySelector('#sv-pay').value,
        paymentReference: form.querySelector('#sv-ref').value,
        items: [...lines.querySelectorAll('.sale-line')].map((l) => ({
          inventoryLotId: Number(l.querySelector('[data-f=lot]').value),
          kg: parseNumber(l.querySelector('[data-f=kg]').value),
          factor: l.querySelector('[data-f=factor]').value.trim() ? parseNumber(l.querySelector('[data-f=factor]').value) : null,
          precioCarga: parseNumber(l.querySelector('[data-f=precio]').value),
        })),
      };
      if (customerId) payload.customerId = customerId;
      else payload.customer = { idType: form.querySelector('#cu-type').value, idNumber: form.querySelector('#cu-num').value, name: form.querySelector('#cu-name').value };
      try { await api.createTradeSale(payload); await load(); } catch (ex) { err(ex.message); }
    });
  }
  await load();
}
