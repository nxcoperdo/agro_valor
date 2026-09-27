import { api } from '../services/api.js';
import { formatCop } from '../utils/currency.js';

function metricTile(label, value) {
  return `
    <div class="metric-tile">
      <div class="metric-value tabular-nums">${value}</div>
      <div class="metric-label">${label}</div>
    </div>
  `;
}

function userRow(user) {
  const pro = user.plan === 'pro';
  const expiry = user.plan_expires_at
    ? new Date(user.plan_expires_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  return `
    <tr>
      <td>${user.username}</td>
      <td><span class="badge ${pro ? 'badge-pro' : ''}">${pro ? 'Pro' : 'Gratis'}</span></td>
      <td>${pro ? expiry : '—'}</td>
      <td>${user.phone || '—'}</td>
      <td>
        <div class="admin-row-actions">
          <input type="number" class="admin-months-input" data-months-for="${user.id}" value="1" min="1" max="24" />
          <button type="button" class="btn-primary" data-activate="${user.id}">Activar Pro</button>
          ${pro ? `<button type="button" class="btn-danger" data-cancel="${user.id}">Cancelar</button>` : ''}
        </div>
      </td>
      <td>
        <div class="admin-row-actions">
          <input
            type="text"
            class="admin-password-input"
            data-password-for="${user.id}"
            placeholder="Nueva contraseña"
            minlength="8"
          />
          <button type="button" class="btn-danger" data-reset-password="${user.id}">Restablecer</button>
        </div>
      </td>
    </tr>
  `;
}

function coopRow(coop) {
  return `
    <tr data-coop-row="${coop.id}">
      <td><input type="text" data-field="name" value="${coop.name}" /></td>
      <td><input type="text" data-field="region" value="${coop.region || ''}" /></td>
      <td><input type="text" data-field="municipality" value="${coop.municipality || ''}" /></td>
      <td><input type="number" step="0.001" data-field="differentialPct" value="${coop.differential_pct}" /></td>
      <td class="admin-active-cell"><input type="checkbox" data-field="active" ${coop.active ? 'checked' : ''} /></td>
      <td><button type="button" class="btn-primary" data-save-coop="${coop.id}">Guardar</button></td>
    </tr>
  `;
}

function reportRow(r) {
  return `
    <tr>
      <td>${r.reported_for_date}</td>
      <td>${r.username || '—'}</td>
      <td>${r.cooperative_name || '—'}</td>
      <td class="tabular-nums">${formatCop(r.price_cop_carga)}</td>
      <td class="tabular-nums">${r.factor ?? '—'}</td>
      <td class="tabular-nums">${r.humidity ?? '—'}</td>
      <td><button type="button" class="btn-danger" data-delete-report="${r.id}">Borrar</button></td>
    </tr>
  `;
}

export async function renderAdmin(container) {
  async function load() {
    container.innerHTML = '<div class="panel"><span class="skeleton" style="width:100%;height:160px;"></span></div>';

    try {
      const [metrics, usersRes, coopsRes, reportsRes] = await Promise.all([
        api.adminMetrics(),
        api.adminUsers(),
        api.adminCooperatives(),
        api.adminReports(),
      ]);

      const { users } = usersRes;
      const { cooperatives } = coopsRes;
      const { reports } = reportsRes;

      container.innerHTML = `
        <p class="form-error" id="admin-error" role="alert" hidden></p>

        <div class="panel">
          <div class="panel-header"><h2>Métricas</h2></div>
          <div class="metric-grid">
            ${metricTile('Usuarios', metrics.totalUsers)}
            ${metricTile('Pro', metrics.proUsers)}
            ${metricTile('Reportes hoy', metrics.reportsToday)}
            ${metricTile('Reportes 7 días', metrics.reportsLast7d)}
            ${metricTile('Cooperativas', metrics.cooperativesCount)}
            ${metricTile('Reportadas', metrics.reportedCooperativesCount)}
          </div>
        </div>

        <div class="panel">
          <div class="panel-header"><h2>Usuarios</h2></div>
          <div class="table-scroll">
            <table class="coop-table admin-table">
              <thead><tr><th>Usuario</th><th>Plan</th><th>Vence</th><th>Teléfono</th><th></th><th></th></tr></thead>
              <tbody>${users.map(userRow).join('')}</tbody>
            </table>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header"><h2>Cooperativas</h2></div>
          <div class="table-scroll">
            <table class="coop-table admin-table">
              <thead>
                <tr><th>Nombre</th><th>Región</th><th>Municipio</th><th>Diferencial</th><th>Activa</th><th></th></tr>
              </thead>
              <tbody>${cooperatives.map(coopRow).join('')}</tbody>
            </table>
          </div>
          <form class="calc-form" id="new-coop-form">
            <div class="field">
              <label for="newCoopName">Nombre</label>
              <input type="text" id="newCoopName" name="newCoopName" required />
            </div>
            <div class="field">
              <label for="newCoopRegion">Región</label>
              <input type="text" id="newCoopRegion" name="newCoopRegion" />
            </div>
            <div class="field">
              <label for="newCoopMunicipality">Municipio</label>
              <input type="text" id="newCoopMunicipality" name="newCoopMunicipality" />
            </div>
            <div class="field">
              <label for="newCoopDiff">Diferencial (decimal, ej. -0.02)</label>
              <input type="number" id="newCoopDiff" name="newCoopDiff" step="0.001" value="0" />
            </div>
            <button type="submit" class="btn-primary">Agregar cooperativa</button>
          </form>
        </div>

        <div class="panel">
          <div class="panel-header"><h2>Reportes de precio</h2></div>
          ${
            reports.length
              ? `<div class="table-scroll">
                   <table class="coop-table">
                     <thead>
                       <tr><th>Fecha</th><th>Usuario</th><th>Cooperativa</th><th>Precio</th><th>Factor</th><th>Humedad</th><th></th></tr>
                     </thead>
                     <tbody>${reports.map(reportRow).join('')}</tbody>
                   </table>
                 </div>`
              : '<p class="empty-state">No hay reportes todavía.</p>'
          }
        </div>
      `;

      const errorEl = container.querySelector('#admin-error');
      const showError = (err) => {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      };

      /** Ejecuta una acción admin, recarga toda la página si sale bien, o solo avisa el error. */
      const runAction = (btn, fn) => async () => {
        btn.disabled = true;
        errorEl.hidden = true;
        try {
          await fn();
          await load();
        } catch (err) {
          btn.disabled = false;
          showError(err);
        }
      };

      container.querySelectorAll('[data-activate]').forEach((btn) => {
        btn.addEventListener(
          'click',
          runAction(btn, () => {
            const months = container.querySelector(`[data-months-for="${btn.dataset.activate}"]`).value || 1;
            return api.activatePro(btn.dataset.activate, parseInt(months, 10));
          })
        );
      });

      container.querySelectorAll('[data-cancel]').forEach((btn) => {
        btn.addEventListener(
          'click',
          runAction(btn, () => api.cancelPro(btn.dataset.cancel))
        );
      });

      container.querySelectorAll('[data-reset-password]').forEach((btn) => {
        btn.addEventListener(
          'click',
          runAction(btn, () => {
            const input = container.querySelector(`[data-password-for="${btn.dataset.resetPassword}"]`);
            if (!input.value || input.value.length < 8) {
              return Promise.reject(new Error('La contraseña debe tener al menos 8 caracteres'));
            }
            return api.resetUserPassword(btn.dataset.resetPassword, input.value);
          })
        );
      });

      container.querySelectorAll('[data-save-coop]').forEach((btn) => {
        btn.addEventListener(
          'click',
          runAction(btn, () => {
            const row = container.querySelector(`[data-coop-row="${btn.dataset.saveCoop}"]`);
            return api.updateCooperative(btn.dataset.saveCoop, {
              name: row.querySelector('[data-field="name"]').value,
              region: row.querySelector('[data-field="region"]').value,
              municipality: row.querySelector('[data-field="municipality"]').value,
              differentialPct: row.querySelector('[data-field="differentialPct"]').value,
              active: row.querySelector('[data-field="active"]').checked,
            });
          })
        );
      });

      container.querySelectorAll('[data-delete-report]').forEach((btn) => {
        btn.addEventListener(
          'click',
          runAction(btn, () => api.deleteReport(btn.dataset.deleteReport))
        );
      });

      const newCoopForm = container.querySelector('#new-coop-form');
      const addCoopBtn = newCoopForm.querySelector('button[type="submit"]');
      newCoopForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await runAction(addCoopBtn, () =>
          api.createCooperative({
            name: newCoopForm.newCoopName.value,
            region: newCoopForm.newCoopRegion.value,
            municipality: newCoopForm.newCoopMunicipality.value,
            differentialPct: newCoopForm.newCoopDiff.value,
          })
        )();
      });
    } catch (err) {
      container.innerHTML = `<div class="panel"><p class="panel-error">${err.message}</p></div>`;
    }
  }

  await load();
}
