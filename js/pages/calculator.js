import { api } from '../services/api.js';
import { formatCop } from '../utils/currency.js';

function breakdownRow(step) {
  const sign = step.delta > 0 ? 'delta-up' : step.delta < 0 ? 'delta-down' : 'delta-flat';
  const deltaText = step.delta === 0 ? '—' : `${step.delta > 0 ? '+' : ''}${formatCop(step.delta)}`;

  return `
    <li class="breakdown-row">
      <div class="breakdown-label">
        <strong>${step.label}</strong>
        <small>${step.detail}</small>
      </div>
      <div class="breakdown-values tabular-nums">
        <span class="breakdown-delta ${sign}">${deltaText}</span>
        <span class="breakdown-amount">${formatCop(step.amount)}</span>
      </div>
    </li>
  `;
}

function comparisonRow(row) {
  const tag =
    row.priceSource === 'reported'
      ? '<span class="tag tag-reported">Reportado</span>'
      : '<span class="tag tag-estimated">Estimado</span>';

  return `
    <tr class="${row.isBest ? 'row-lowest' : ''}">
      <td>${row.rank}</td>
      <td>${row.name} ${tag} ${row.isBest ? '<span class="tag tag-worst">Mejor opción</span>' : ''}</td>
      <td class="tabular-nums">${formatCop(row.netPerCarga)}</td>
      <td class="tabular-nums">${formatCop(row.total)}</td>
      <td class="tabular-nums ${row.lostVsBest > 0 ? 'delta-down' : ''}">
        ${row.lostVsBest > 0 ? `−${formatCop(row.lostVsBest)}` : '—'}
      </td>
    </tr>
  `;
}

function fullComparisonPanel(data, r) {
  const best = data.byCooperative[0];
  const worst = data.byCooperative[data.byCooperative.length - 1];
  const spread = best && worst ? best.total - worst.total : 0;

  return `
    ${
      spread > 0
        ? `<p class="highlight-note">Entre la mejor y la peor opción hay una diferencia de
           <strong>${formatCop(spread)}</strong> por estas ${r.inputs.cargas} carga(s).</p>`
        : ''
    }
    <div class="table-scroll">
      <table class="coop-table">
        <thead>
          <tr><th>#</th><th>Cooperativa</th><th>Neto por carga</th><th>Total</th><th>Dejas de ganar</th></tr>
        </thead>
        <tbody>${data.byCooperative.map(comparisonRow).join('')}</tbody>
      </table>
    </div>
  `;
}

/** Sin Pro se muestra cuánto hay en juego, pero no en cuál cooperativa: eso es lo que se paga. */
function lockedComparisonPanel(data) {
  return `
    <div class="locked-teaser">
      <div class="locked-teaser-blur">
        <div class="table-scroll">
          <table class="coop-table">
            <thead>
              <tr><th>#</th><th>Cooperativa</th><th>Neto por carga</th><th>Total</th><th>Dejas de ganar</th></tr>
            </thead>
            <tbody>
              ${Array.from({ length: Math.min(data.cooperativesCount || 3, 4) })
                .map(
                  (_, i) => `
                <tr><td>${i + 1}</td><td>Cooperativa •••</td><td>$•,•••,•••</td><td>$•,•••,•••</td><td>−$•••,•••</td></tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="locked-teaser-cta">
        <span class="badge badge-pro">AgroValor Pro</span>
        <p class="highlight-note">
          Hay una diferencia de <strong>${formatCop(data.maxDifferenceCop || 0)}</strong> entre la mejor y la
          peor de las ${data.cooperativesCount} cooperativas para tu café.
        </p>
        <a class="btn-primary" href="#/pro">Ver cuál me conviene</a>
      </div>
    </div>
  `;
}

export async function renderCalculator(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h2>¿Cuánto me queda realmente?</h2>
      </div>
      <p class="panel-intro">
        El precio de referencia es para café factor 94 y 12% de humedad. Tu café casi
        nunca está exactamente ahí, y el transporte también se descuenta. Pon tus datos:
      </p>
      <form class="calc-form" id="calc-form">
        <div class="field">
          <label for="cargas">Cargas a vender</label>
          <input type="number" id="cargas" name="cargas" value="1" min="0.1" step="0.1" inputmode="decimal" />
        </div>
        <div class="field">
          <label for="factor">Factor de rendimiento</label>
          <input type="number" id="factor" name="factor" placeholder="94" min="60" max="140" step="0.1" inputmode="decimal" />
          <small>Menor factor = mejor café</small>
        </div>
        <div class="field">
          <label for="humidity">Humedad (%)</label>
          <input type="number" id="humidity" name="humidity" placeholder="12" min="0" max="30" step="0.1" inputmode="decimal" />
        </div>
        <div class="field">
          <label for="pasillaPct">Pasilla (%)</label>
          <input type="number" id="pasillaPct" name="pasillaPct" value="0" min="0" max="40" step="0.1" inputmode="decimal" />
        </div>
        <div class="field">
          <label for="transportCostCopCarga">Transporte por carga (COP)</label>
          <input type="number" id="transportCostCopCarga" name="transportCostCopCarga" placeholder="0" min="0" step="1000" inputmode="numeric" />
        </div>
        <button type="submit" class="btn-primary">Calcular</button>
      </form>
      <p class="form-hint">Si dejas un campo vacío, se usa lo que tengas guardado en tu cuenta.</p>
    </div>

    <div id="calc-result"></div>
  `;

  const form = container.querySelector('#calc-form');
  const resultEl = container.querySelector('#calc-result');

  async function run(e) {
    if (e) e.preventDefault();
    resultEl.innerHTML = '<div class="panel"><span class="skeleton" style="width:100%;height:120px;"></span></div>';

    try {
      const data = await api.calculate({
        cargas: form.cargas.value,
        factor: form.factor.value,
        humidity: form.humidity.value,
        pasillaPct: form.pasillaPct.value,
        transportCostCopCarga: form.transportCostCopCarga.value,
      });

      const r = data.againstReference;

      resultEl.innerHTML = `
        <div class="panel av-fade-in">
          <div class="panel-header"><h2>Tu precio neto</h2></div>
          <div class="price-current">
            <span class="tabular-nums">${formatCop(r.netPerCarga)}</span>
            <span class="price-secondary">por carga</span>
          </div>
          <p class="price-meta">
            Total por ${r.inputs.cargas} carga(s): <strong>${formatCop(r.total)}</strong> ·
            <span class="${r.differenceVsBase >= 0 ? 'delta-up' : 'delta-down'}">
              ${r.differenceVsBase >= 0 ? '+' : ''}${r.differenceVsBasePct.toFixed(1)}% vs. el precio de referencia
            </span>
          </p>
          <ul class="breakdown">${r.breakdown.map(breakdownRow).join('')}</ul>
          <p class="disclaimer">${r.disclaimer}</p>
        </div>

        ${
          data.locked || data.byCooperative
            ? `<div class="panel av-fade-in">
                <div class="panel-header"><h2>¿A quién le vendo?</h2></div>
                ${data.locked ? lockedComparisonPanel(data) : fullComparisonPanel(data, r)}
              </div>`
            : ''
        }
      `;
    } catch (err) {
      resultEl.innerHTML = `<div class="panel"><p class="panel-error">${err.message}</p></div>`;
    }
  }

  form.addEventListener('submit', run);
  run();
}
