import { api } from '../services/api.js';
import { isPro } from '../services/auth.js';
import { paywall } from '../ui/shell.js';
import { formatCop } from '../utils/currency.js';

function saleRow(sale) {
  const vs =
    sale.vsReference == null
      ? '—'
      : `<span class="${sale.vsReference >= 0 ? 'delta-up' : 'delta-down'}">
           ${sale.vsReference >= 0 ? '+' : ''}${formatCop(sale.vsReference)}
           (${sale.vsReferencePct >= 0 ? '+' : ''}${sale.vsReferencePct.toFixed(1)}%)
         </span>`;

  return `
    <tr>
      <td>${sale.soldOn}</td>
      <td>${sale.cooperativeName || '—'}</td>
      <td class="tabular-nums">${sale.cargas}</td>
      <td class="tabular-nums">${formatCop(sale.priceCopCarga)}</td>
      <td class="tabular-nums">${formatCop(sale.total)}</td>
      <td class="tabular-nums">${vs}</td>
      <td><button type="button" class="btn-danger" data-delete="${sale.id}">Borrar</button></td>
    </tr>
  `;
}

export async function renderSales(container) {
  if (!isPro()) {
    container.innerHTML = paywall(
      'Historial de tus ventas',
      'Lleva el registro de lo que has vendido y compara cada venta contra el precio de mercado de ese día, para saber si estás vendiendo bien.'
    );
    return;
  }

  async function load() {
    container.innerHTML = '<div class="panel"><span class="skeleton" style="width:100%;height:120px;"></span></div>';

    try {
      const { sales, summary } = await api.sales();
      const coops = await api.cooperatives();

      container.innerHTML = `
        <div class="panel">
          <div class="panel-header"><h2>Registrar una venta</h2></div>
          <form class="calc-form" id="sale-form">
            <div class="field">
              <label for="soldOn">Fecha</label>
              <input type="date" id="soldOn" name="soldOn" value="${new Date().toISOString().slice(0, 10)}" />
            </div>
            <div class="field">
              <label for="cooperativeId">Cooperativa</label>
              <select id="cooperativeId" name="cooperativeId">
                <option value="">Otra / no listada</option>
                ${coops.cooperatives.map((c) => `<option value="${c.id}">${c.name}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label for="cargas">Cargas</label>
              <input type="number" id="cargas" name="cargas" min="0.1" step="0.1" required inputmode="decimal" />
            </div>
            <div class="field">
              <label for="priceCopCarga">Precio por carga (COP)</label>
              <input type="number" id="priceCopCarga" name="priceCopCarga" min="1" step="1000" required inputmode="numeric" />
            </div>
            <div class="field">
              <label for="factor">Factor</label>
              <input type="number" id="factor" name="factor" step="0.1" inputmode="decimal" />
            </div>
            <div class="field">
              <label for="humidity">Humedad (%)</label>
              <input type="number" id="humidity" name="humidity" step="0.1" inputmode="decimal" />
            </div>
            <button type="submit" class="btn-primary">Guardar venta</button>
          </form>
          <p class="form-error" id="sale-error" role="alert" hidden></p>
        </div>

        <div class="panel">
          <div class="panel-header"><h2>Mis ventas</h2></div>
          <div class="summary-cards">
            <div class="summary-card"><h3>Ventas</h3><strong>${summary.salesCount}</strong></div>
            <div class="summary-card"><h3>Cargas vendidas</h3><strong>${summary.totalCargas}</strong></div>
            <div class="summary-card"><h3>Ingreso total</h3><strong>${formatCop(summary.totalIncome)}</strong></div>
            <div class="summary-card">
              <h3>Frente al mercado</h3>
              <strong class="${summary.totalVsReference >= 0 ? 'delta-up' : 'delta-down'}">
                ${summary.totalVsReference >= 0 ? '+' : ''}${formatCop(summary.totalVsReference)}
              </strong>
            </div>
          </div>
          ${
            sales.length
              ? `<div class="table-scroll">
                   <table class="coop-table">
                     <thead>
                       <tr><th>Fecha</th><th>Cooperativa</th><th>Cargas</th><th>Precio/carga</th><th>Total</th><th>vs. referencia</th><th></th></tr>
                     </thead>
                     <tbody>${sales.map(saleRow).join('')}</tbody>
                   </table>
                 </div>`
              : '<p class="empty-state">Todavía no has registrado ventas.</p>'
          }
        </div>
      `;

      const form = container.querySelector('#sale-form');
      const errorEl = container.querySelector('#sale-error');

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorEl.hidden = true;
        try {
          await api.createSale({
            soldOn: form.soldOn.value,
            cooperativeId: form.cooperativeId.value || null,
            cargas: form.cargas.value,
            priceCopCarga: form.priceCopCarga.value,
            factor: form.factor.value,
            humidity: form.humidity.value,
          });
          await load();
        } catch (err) {
          errorEl.textContent = err.message;
          errorEl.hidden = false;
        }
      });

      container.querySelectorAll('[data-delete]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          await api.deleteSale(btn.dataset.delete);
          await load();
        });
      });
    } catch (err) {
      container.innerHTML = `<div class="panel"><p class="panel-error">${err.message}</p></div>`;
    }
  }

  await load();
}
