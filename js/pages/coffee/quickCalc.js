import { api } from '../../services/api.js';
import { isPro } from '../../services/auth.js';
import { paywall } from '../../ui/shell.js';
import { escapeHtml, formatKg, formatCopValue, formatFactor, parseNumber } from '../../utils/format.js';

const card = (t, v, hl) => `<div class="summary-card ${hl ? 'highlight' : ''}"><h3>${t}</h3><strong class="tabular-nums">${v}</strong></div>`;

/** Calculadora rápida por factor. No crea compras ni guarda nada. */
export async function renderQuickCalc(container) {
  if (!isPro()) {
    container.innerHTML = paywall('Calculadora rápida', 'Calcula cargas, precio por kg y valor total, y compara factores de rendimiento.');
    return;
  }
  container.innerHTML = `
    <div class="panel"><div class="panel-header"><h2>Calculadora rápida</h2></div>
      <form class="calc-form" id="qc-form">
        <div class="field"><label for="qc-kilos">Cantidad (kg)</label><input id="qc-kilos" name="kilos" inputmode="decimal" required /></div>
        <div class="field"><label for="qc-factor">Factor de rendimiento</label><input id="qc-factor" name="factor" inputmode="decimal" placeholder="Ej. 88" /></div>
        <div class="field"><label for="qc-precio">Precio por carga (125 kg)</label><input id="qc-precio" name="precioCarga" inputmode="numeric" required /></div>
        <button type="submit" class="btn-primary">Calcular</button>
      </form>
      <p class="form-error" id="qc-error" role="alert" hidden></p><div id="qc-result"></div></div>
    <div class="panel"><div class="panel-header"><h2>Comparar factores</h2></div>
      <p class="panel-intro">Cada opción lleva su precio por carga. O ingresa un precio de referencia y se calcula el de cada factor (factor de referencia ÷ factor evaluado × precio de referencia).</p>
      <form id="cmp-form">
        <div class="calc-form">
          <div class="field"><label for="cmp-kilos">Cantidad (kg)</label><input id="cmp-kilos" name="kilos" inputmode="decimal" required /></div>
          <div class="field"><label for="cmp-ref-f">Factor de referencia (opcional)</label><input id="cmp-ref-f" name="refFactor" inputmode="decimal" /></div>
          <div class="field"><label for="cmp-ref-p">Precio de referencia por carga (opcional)</label><input id="cmp-ref-p" name="refPrecio" inputmode="numeric" /></div>
        </div>
        <div id="cmp-options"></div>
        <button type="button" class="btn-ghost" id="cmp-add">+ Agregar opción</button>
        <button type="submit" class="btn-primary">Comparar</button>
      </form>
      <p class="form-error" id="cmp-error" role="alert" hidden></p><div id="cmp-result"></div></div>`;

  const showErr = (sel, msg) => { const el = container.querySelector(sel); el.textContent = msg || ''; el.hidden = !msg; };

  container.querySelector('#qc-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    showErr('#qc-error');
    try {
      const r = await api.quickCalc({ kilos: parseNumber(f.kilos.value), factor: f.factor.value.trim() ? parseNumber(f.factor.value) : null, precioCarga: parseNumber(f.precioCarga.value) });
      container.querySelector('#qc-result').innerHTML = `<div class="summary-cards">
        ${r.factorRendimientoTrilla != null ? card('Factor', formatFactor(r.factorRendimientoTrilla).replace('Factor ', '')) : ''}
        ${card('Cargas', r.numeroCargas.toLocaleString('es-CO'))}${card('Precio por kg', formatCopValue(r.precioKg))}${card('Valor total', formatCopValue(r.valorTotal), true)}</div>`;
    } catch (err) { showErr('#qc-error', err.message); }
  });

  const opts = container.querySelector('#cmp-options');
  const addOption = (factor = '', precio = '') => {
    const div = document.createElement('div');
    div.className = 'calc-form cmp-option';
    div.innerHTML = `<div class="field"><label>Factor</label><input data-f="factor" inputmode="decimal" value="${escapeHtml(factor)}" /></div>
      <div class="field"><label>Precio por carga</label><input data-f="precio" inputmode="numeric" value="${escapeHtml(precio)}" /></div>
      <button type="button" class="btn-ghost" data-rm>Quitar</button>`;
    div.querySelector('[data-rm]').addEventListener('click', () => div.remove());
    opts.appendChild(div);
  };
  [84, 88, 90, 94].forEach((f) => addOption(String(f)));
  container.querySelector('#cmp-add').addEventListener('click', () => addOption());

  container.querySelector('#cmp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    showErr('#cmp-error');
    const opciones = [...opts.querySelectorAll('.cmp-option')].map((o) => ({ factor: parseNumber(o.querySelector('[data-f=factor]').value), precioCarga: parseNumber(o.querySelector('[data-f=precio]').value) }));
    const referencia = f.refPrecio.value.trim() ? { factor: parseNumber(f.refFactor.value), precioCarga: parseNumber(f.refPrecio.value) } : null;
    try {
      const r = await api.compareFactors({ kilos: parseNumber(f.kilos.value), opciones, referencia });
      container.querySelector('#cmp-result').innerHTML = `<div class="table-scroll"><table class="coop-table"><thead><tr><th>Factor</th><th>Precio carga</th><th>Precio kg</th><th>Kg</th><th>Cargas</th><th>Total</th><th>Diferencia</th></tr></thead><tbody>
        ${r.filas.map((x) => `<tr class="${r.mayorValor && x.factor === r.mayorValor.factor ? 'row-highest' : ''}">
          <td data-label="Factor">${formatFactor(x.factor)}</td><td data-label="Precio carga" class="tabular-nums">${formatCopValue(x.precioCarga)}</td>
          <td data-label="Precio kg" class="tabular-nums">${formatCopValue(x.precioKg)}</td><td data-label="Kg" class="tabular-nums">${formatKg(x.kilos)}</td>
          <td data-label="Cargas" class="tabular-nums">${x.cargas.toLocaleString('es-CO')}</td><td data-label="Total" class="tabular-nums">${formatCopValue(x.total)}</td>
          <td data-label="Diferencia" class="tabular-nums">${formatCopValue(x.diferencia)}</td></tr>`).join('')}</tbody></table></div>
        ${r.mayorValor ? `<p class="highlight-note">Mayor valor económico: ${formatFactor(r.mayorValor.factor)} · ${formatCopValue(r.mayorValor.total)}</p>` : ''}`;
    } catch (err) { showErr('#cmp-error', err.message); }
  });
}
