import { api } from '../services/api.js';
import { formatCop } from '../utils/currency.js';

/**
 * Reportar precios es gratis a propósito: entre más caficultores reporten, más exacta
 * queda la comparación para todos, y eso es lo que hace valioso al producto.
 */
export async function renderReport(container) {
  container.innerHTML = '<div class="panel"><span class="skeleton" style="width:100%;height:120px;"></span></div>';

  async function load() {
    try {
      const [coops, mine] = await Promise.all([api.cooperatives(), api.myReports()]);

      container.innerHTML = `
        <div class="panel">
          <div class="panel-header"><h2>¿Cuánto te pagaron?</h2></div>
          <p class="panel-intro">
            Cuéntanos cuánto está pagando realmente tu cooperativa. Cuando varios caficultores
            reportan el mismo punto de compra, ese precio deja de ser una estimación y pasa a
            ser un dato real para toda la comunidad.
          </p>
          <form class="calc-form" id="report-form">
            <div class="field">
              <label for="cooperativeId">Cooperativa</label>
              <select id="cooperativeId" name="cooperativeId" required>
                ${coops.cooperatives.map((c) => `<option value="${c.id}">${c.name}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label for="priceCopCarga">Precio por carga (COP)</label>
              <input type="number" id="priceCopCarga" name="priceCopCarga" min="1" step="1" required inputmode="numeric" placeholder="2350000" />
            </div>
            <div class="field">
              <label for="municipality">Municipio</label>
              <input type="text" id="municipality" name="municipality" placeholder="Pitalito" />
            </div>
            <div class="field">
              <label for="factor">Factor <span class="label-hint">(opcional)</span></label>
              <input type="number" id="factor" name="factor" step="0.1" inputmode="decimal" />
            </div>
            <button type="submit" class="btn-primary">Enviar reporte</button>
          </form>
          <p class="form-error" id="report-error" role="alert" hidden></p>
          <p class="form-success" id="report-success" role="status" hidden></p>
        </div>

        <div class="panel">
          <div class="panel-header"><h2>Mis reportes</h2></div>
          ${
            mine.reports.length
              ? `<div class="table-scroll">
                   <table class="coop-table">
                     <thead><tr><th>Fecha</th><th>Cooperativa</th><th>Precio reportado</th></tr></thead>
                     <tbody>
                       ${mine.reports
                         .map(
                           (r) => `
                             <tr>
                               <td>${r.reported_for_date}</td>
                               <td>${r.cooperative_name || '—'}</td>
                               <td class="tabular-nums">${formatCop(r.price_cop_carga)}</td>
                             </tr>`
                         )
                         .join('')}
                     </tbody>
                   </table>
                 </div>`
              : '<p class="empty-state">Todavía no has enviado reportes.</p>'
          }
        </div>
      `;

      const form = container.querySelector('#report-form');
      const errorEl = container.querySelector('#report-error');
      const successEl = container.querySelector('#report-success');

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorEl.hidden = true;
        successEl.hidden = true;

        try {
          const res = await api.createReport({
            cooperativeId: form.cooperativeId.value,
            priceCopCarga: form.priceCopCarga.value,
            municipality: form.municipality.value,
            factor: form.factor.value,
          });
          successEl.textContent = res.message;
          successEl.hidden = false;
          form.priceCopCarga.value = '';
          await load();
        } catch (err) {
          errorEl.textContent = err.message;
          errorEl.hidden = false;
        }
      });
    } catch (err) {
      container.innerHTML = `<div class="panel"><p class="panel-error">${err.message}</p></div>`;
    }
  }

  await load();
}
