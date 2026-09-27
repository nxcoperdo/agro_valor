import { api } from '../services/api.js';
import { isPro } from '../services/auth.js';
import { paywall } from '../ui/shell.js';
import { formatCop } from '../utils/currency.js';

const TYPE_LABELS = {
  above: 'Cuando suba de',
  below: 'Cuando baje de',
  daily: 'Resumen diario',
  weekly: 'Resumen semanal',
};

function alertRow(alert) {
  const detail = alert.thresholdCopCarga ? formatCop(alert.thresholdCopCarga) : 'Cada semana por la mañana';
  const last = alert.lastTriggeredAt
    ? `Último aviso: ${new Date(alert.lastTriggeredAt).toLocaleString('es-CO')}`
    : 'Todavía no se ha disparado';

  return `
    <li class="alert-row ${alert.active ? '' : 'is-inactive'}">
      <div>
        <strong>${TYPE_LABELS[alert.type] || alert.type} ${alert.thresholdCopCarga ? detail : ''}</strong>
        <small>${alert.type === 'daily' || alert.type === 'weekly' ? detail : ''} ${last}</small>
      </div>
      <div class="alert-actions">
        <button type="button" class="btn-ghost" data-toggle="${alert.id}" data-active="${alert.active}">
          ${alert.active ? 'Pausar' : 'Activar'}
        </button>
        <button type="button" class="btn-danger" data-delete="${alert.id}">Eliminar</button>
      </div>
    </li>
  `;
}

export async function renderAlerts(container) {
  if (!isPro()) {
    container.innerHTML = paywall(
      'Alertas por WhatsApp',
      'Te avisamos por WhatsApp cuando el precio del café llegue a la meta que tú definas, y te mandamos el resumen del mercado sin que tengas que entrar a buscarlo.'
    );
    return;
  }

  container.innerHTML = '<div class="panel"><span class="skeleton" style="width:100%;height:140px;"></span></div>';

  async function load() {
    try {
      const data = await api.alerts();

      container.innerHTML = `
        ${
          !data.phone
            ? `<div class="panel notice notice-warning">
                 <p>Todavía no has guardado tu número de WhatsApp.
                 <a href="#/cuenta">Agrégalo en tu cuenta</a> para poder recibir alertas.</p>
               </div>`
            : ''
        }
        ${
          !data.whatsappConfigured
            ? `<div class="panel notice notice-warning">
                 <p>El envío por WhatsApp todavía no está conectado en el servidor. Tus alertas
                 quedan guardadas y se enviarán apenas se active.</p>
               </div>`
            : ''
        }

        <div class="panel">
          <div class="panel-header"><h2>Crear una alerta</h2></div>
          <form class="calc-form" id="alert-form">
            <div class="field">
              <label for="type">Tipo de aviso</label>
              <select id="type" name="type">
                <option value="above">Cuando el precio suba de…</option>
                <option value="below">Cuando el precio baje de…</option>
                <option value="daily">Resumen diario</option>
                <option value="weekly">Resumen semanal</option>
              </select>
            </div>
            <div class="field" id="threshold-field">
              <label for="thresholdCopCarga">Precio por carga (COP)</label>
              <input type="number" id="thresholdCopCarga" name="thresholdCopCarga" placeholder="2400000" min="10000" step="1" inputmode="numeric" />
            </div>
            <button type="submit" class="btn-primary">Crear alerta</button>
          </form>
          <p class="form-error" id="alert-error" role="alert" hidden></p>
        </div>

        <div class="panel">
          <div class="panel-header">
            <h2>Mis alertas</h2>
            <button type="button" class="btn-ghost" id="test-btn" ${data.phone ? '' : 'disabled'}>
              Enviarme una prueba
            </button>
          </div>
          ${
            data.alerts.length
              ? `<ul class="alert-list">${data.alerts.map(alertRow).join('')}</ul>`
              : '<p class="empty-state">Todavía no tienes alertas. Crea la primera arriba.</p>'
          }
          <p class="form-hint" id="test-result"></p>
        </div>
      `;

      wire(data);
    } catch (err) {
      container.innerHTML = `<div class="panel"><p class="panel-error">${err.message}</p></div>`;
    }
  }

  function wire(data) {
    const form = container.querySelector('#alert-form');
    const errorEl = container.querySelector('#alert-error');
    const thresholdField = container.querySelector('#threshold-field');

    form.type.addEventListener('change', () => {
      const needsThreshold = form.type.value === 'above' || form.type.value === 'below';
      thresholdField.hidden = !needsThreshold;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.hidden = true;
      try {
        await api.createAlert({
          type: form.type.value,
          thresholdCopCarga: form.thresholdCopCarga.value,
        });
        await load();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      }
    });

    container.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await api.toggleAlert(btn.dataset.toggle, btn.dataset.active !== 'true');
        await load();
      });
    });

    container.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await api.deleteAlert(btn.dataset.delete);
        await load();
      });
    });

    const testBtn = container.querySelector('#test-btn');
    const testResult = container.querySelector('#test-result');

    if (testBtn && data.phone) {
      testBtn.addEventListener('click', async () => {
        testBtn.disabled = true;
        testResult.textContent = 'Enviando…';
        try {
          const res = await api.testAlert();
          testResult.textContent = res.message;
        } catch (err) {
          testResult.textContent = err.message;
        }
        testBtn.disabled = false;
      });
    }
  }

  await load();
}
