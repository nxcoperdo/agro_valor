import { api } from '../services/api.js';
import { isPro } from '../services/auth.js';
import { paywall } from '../ui/shell.js';
import { formatCop } from '../utils/currency.js';

function adjustmentRows(a) {
  const rows = [
    ['Humedad', a.humidityBonusCopPerKg > 0 ? a.humidityBonusCopPerKg : -a.humidityLossCopPerKg, 'Ajuste a masa seca (base 7%)'],
    ['Grano defectuoso', -a.defectLossCopPerKg, 'Violeta, pizarroso, mohoso o germinado'],
    ['Sin fermentar', -a.fermentationLossCopPerKg, 'El cacao sin fermentar se castiga'],
    ['Descuento del comprador', -a.buyerDiscountCopPerKg, 'Lo que aplique tu punto de compra'],
    ['Transporte', -a.transportCopPerKg, 'Hasta el punto de compra'],
  ].filter(([, amount]) => Math.abs(amount) >= 0.5);

  return rows
    .map(
      ([label, amount, detail]) => `
        <li class="breakdown-row">
          <div class="breakdown-label"><strong>${label}</strong><small>${detail}</small></div>
          <div class="breakdown-values tabular-nums">
            <span class="breakdown-delta ${amount > 0 ? 'delta-up' : 'delta-down'}">${amount > 0 ? '+' : '−'}${formatCop(Math.abs(amount))}</span>
          </div>
        </li>`
    )
    .join('');
}

/** Calculadora de precio neto del cacao, en COP por kilo. Solo Pro (igual que la de café). */
export async function renderCocoaCalculator(container) {
  if (!isPro()) {
    container.innerHTML = paywall(
      'Calculadora de cacao',
      'Calcula cuánto te queda realmente por kilo de cacao según tu humedad, fermentación, grano defectuoso y transporte.'
    );
    return;
  }

  container.innerHTML = `
    <div class="panel">
      <div class="panel-header"><h2>🍫 ¿Cuánto me queda por mi cacao?</h2></div>
      <p class="panel-intro">
        Partimos del precio semanal de referencia de la industria (Agronet) y lo ajustamos
        por la calidad de tu grano. Pon tus datos:
      </p>
      <form class="calc-form" id="cocoa-form">
        <div class="field">
          <label for="kg">Kilos a vender</label>
          <input type="number" id="kg" name="kg" value="100" min="1" step="1" inputmode="decimal" />
        </div>
        <div class="field">
          <label for="humidity">Humedad (%)</label>
          <input type="number" id="humidity" name="humidity" value="7" min="0" max="30" step="0.1" inputmode="decimal" />
          <small>El cacao seco se transa al 7%</small>
        </div>
        <div class="field">
          <label for="defectPct">Grano defectuoso (%)</label>
          <input type="number" id="defectPct" name="defectPct" value="0" min="0" max="40" step="0.1" inputmode="decimal" />
        </div>
        <div class="field">
          <label for="fermented">Fermentación</label>
          <select id="fermented" name="fermented">
            <option value="true">Fermentado</option>
            <option value="false">Sin fermentar</option>
          </select>
        </div>
        <div class="field">
          <label for="buyerDiscountPct">Descuento del comprador (%)</label>
          <input type="number" id="buyerDiscountPct" name="buyerDiscountPct" value="0" min="0" max="50" step="0.1" inputmode="decimal" />
        </div>
        <div class="field">
          <label for="transportCostCopKg">Transporte por kilo (COP)</label>
          <input type="number" id="transportCostCopKg" name="transportCostCopKg" value="0" min="0" step="1" inputmode="numeric" />
        </div>
        <button type="submit" class="btn-primary">Calcular</button>
      </form>
    </div>
    <div id="cocoa-result"></div>
  `;

  const form = container.querySelector('#cocoa-form');
  const resultEl = container.querySelector('#cocoa-result');

  async function run(e) {
    if (e) e.preventDefault();
    resultEl.innerHTML = '<div class="panel"><span class="skeleton" style="width:100%;height:120px;"></span></div>';

    try {
      const r = await api.calculateCocoa({
        kg: form.kg.value,
        humidity: form.humidity.value,
        defectPct: form.defectPct.value,
        fermented: form.fermented.value,
        buyerDiscountPct: form.buyerDiscountPct.value,
        transportCostCopKg: form.transportCostCopKg.value,
      });

      resultEl.innerHTML = `
        <div class="panel av-fade-in">
          <div class="panel-header"><h2>Tu precio neto</h2></div>
          <div class="price-current">
            <span class="tabular-nums">${formatCop(r.netCopPerKg)}</span>
            <span class="price-secondary">por kilo</span>
          </div>
          <p class="price-meta">Total por ${r.kg} kg: <strong>${formatCop(r.totalCop)}</strong></p>
          <ul class="breakdown">
            <li class="breakdown-row">
              <div class="breakdown-label">
                <strong>Precio de referencia</strong>
                <small>${
                  r.referenceSource === 'agronet'
                    ? `Lo que paga la industria (Agronet), semana del ${r.referenceWeekLabel}`
                    : `Cotización ICE ${formatCop(r.iceCopPerKg)}/kg × ${Math.round(r.farmgateFactor * 100)}% que suele llegar al productor (aún no hay dato de Agronet)`
                }</small>
              </div>
              <div class="breakdown-values tabular-nums"><span class="breakdown-amount">${formatCop(r.referenceCopPerKg)}</span></div>
            </li>
            ${adjustmentRows(r.adjustments)}
          </ul>
          <p class="disclaimer">
            Estimación orientativa. La referencia es el promedio semanal de la industria y los exportadores
            (Agronet); cada comprador aplica sus propios descuentos.
          </p>
        </div>`;
    } catch (err) {
      resultEl.innerHTML = `<div class="panel"><p class="panel-error">${err.message}</p></div>`;
    }
  }

  form.addEventListener('submit', run);
  run();
}
