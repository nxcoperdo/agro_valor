import { api } from '../../services/api.js';
import { isPro } from '../../services/auth.js';
import { paywall } from '../../ui/shell.js';
import { CARGA_KG, escapeHtml, formatKg, formatCopValue, formatFactor, parseNumber } from '../../utils/format.js';

const card = (t, v, hl) => `<div class="summary-card ${hl ? 'highlight' : ''}"><h3>${t}</h3><strong class="tabular-nums">${v}</strong></div>`;

/** Calculadora rápida por factor. No crea compras ni guarda nada. */
export async function renderQuickCalc(container) {
  if (!isPro()) {
    container.innerHTML = paywall('Cuánto vale mi café', 'Calcula cargas, precio por kg y valor total, y compara factores de rendimiento.');
    return;
  }
  // Se precarga el factor guardado en el perfil, igual que en la calculadora de precio neto.
  let defaultFactor = '';
  try {
    const p = await api.profile();
    if (p && p.defaultFactor != null) defaultFactor = String(p.defaultFactor);
  } catch {
    /* sin perfil: el campo queda vacío */
  }

  container.innerHTML = `
    <div class="panel"><div class="panel-header"><h2>Cuánto vale mi café</h2></div>
      <p class="panel-intro">Pon los kilos y el precio por carga: el resultado se actualiza solo. No guarda nada.</p>
      <form class="calc-form" id="qc-form" novalidate>
        <div class="field"><label for="qc-kilos">Cantidad (kg)</label><input id="qc-kilos" name="kilos" inputmode="decimal" autocomplete="off" /></div>
        <div class="field"><label for="qc-precio">Precio por carga (${CARGA_KG} kg)</label><input id="qc-precio" name="precioCarga" inputmode="numeric" autocomplete="off" /></div>
        <div class="field"><label for="qc-factor">Factor de rendimiento (opcional)</label><input id="qc-factor" name="factor" inputmode="decimal" placeholder="Ej. 88" value="${escapeHtml(defaultFactor)}" /></div>
      </form>
      <p class="form-error" id="qc-error" role="alert" hidden></p>
      <div id="qc-result" aria-live="polite"><p class="form-hint">Escribe los kilos y el precio para ver el resultado.</p></div></div>
    <div class="panel"><div class="panel-header"><h2>Comparar factores</h2></div>
      <p class="panel-intro">Escribe el precio por carga que te ofrecen para un factor y calculamos cuánto sería con los demás
        (factor de referencia ÷ factor evaluado × precio de referencia). También puedes poner un precio propio a cada factor.</p>
      <form id="cmp-form" novalidate>
        <div class="calc-form">
          <div class="field"><label for="cmp-kilos">Cantidad (kg)</label><input id="cmp-kilos" name="kilos" inputmode="decimal" autocomplete="off" /></div>
          <div class="field"><label for="cmp-ref-f">Factor de referencia</label><input id="cmp-ref-f" name="refFactor" inputmode="decimal" placeholder="Ej. 94" value="${escapeHtml(defaultFactor)}" /></div>
          <div class="field"><label for="cmp-ref-p">Precio por carga de referencia</label><input id="cmp-ref-p" name="refPrecio" inputmode="numeric" autocomplete="off" /></div>
        </div>
        <h3 class="cmp-subtitle">Factores a comparar</h3>
        <div id="cmp-options"></div>
        <div class="purchase-actions">
          <button type="button" class="btn-ghost" id="cmp-add">+ Agregar factor</button>
          <button type="submit" class="btn-primary">Comparar</button>
        </div>
      </form>
      <p class="form-error" id="cmp-error" role="alert" hidden></p><div id="cmp-result" aria-live="polite"></div></div>`;

  const showErr = (sel, msg) => {
    const el = container.querySelector(sel);
    el.textContent = msg || '';
    el.hidden = !msg;
  };

  // --- Calculadora rápida: calcula sola al escribir (con una pequeña espera) ---
  const qc = container.querySelector('#qc-form');
  let timer;
  let seq = 0;
  async function runQuick() {
    const kilos = parseNumber(qc.kilos.value);
    const precio = parseNumber(qc.precioCarga.value);
    const out = container.querySelector('#qc-result');
    if (!(kilos > 0) || !(precio > 0)) {
      showErr('#qc-error');
      out.innerHTML = '<p class="form-hint">Escribe los kilos y el precio para ver el resultado.</p>';
      return;
    }
    const mine = ++seq;
    try {
      const r = await api.quickCalc({ kilos, factor: qc.factor.value.trim() ? parseNumber(qc.factor.value) : null, precioCarga: precio });
      if (mine !== seq) return; // llegó tarde: ya hay una consulta más nueva
      showErr('#qc-error');
      out.innerHTML = `<div class="summary-cards">
        ${r.factorRendimientoTrilla != null ? card('Factor', formatFactor(r.factorRendimientoTrilla).replace('Factor ', '')) : ''}
        ${card('Cargas', r.numeroCargas.toLocaleString('es-CO'))}${card('Precio por kg', formatCopValue(r.precioKg))}${card('Valor total', formatCopValue(r.valorTotal), true)}</div>`;
    } catch (err) {
      if (mine === seq) showErr('#qc-error', err.message);
    }
  }
  qc.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(runQuick, 300);
  });
  qc.addEventListener('submit', (e) => {
    e.preventDefault();
    runQuick();
  });

  // --- Comparar factores ---
  const opts = container.querySelector('#cmp-options');
  const addOption = (factor = '', precio = '') => {
    const div = document.createElement('div');
    div.className = 'calc-form cmp-option';
    div.innerHTML = `<div class="field"><label>Factor</label><input data-f="factor" inputmode="decimal" value="${escapeHtml(factor)}" /></div>
      <div class="field"><label>Precio por carga (opcional si hay referencia)</label><input data-f="precio" inputmode="numeric" value="${escapeHtml(precio)}" /></div>
      <button type="button" class="btn-ghost" data-rm>Quitar</button>`;
    div.querySelector('[data-rm]').addEventListener('click', () => div.remove());
    opts.appendChild(div);
    return div;
  };
  [84, 88, 90, 94].forEach((f) => addOption(String(f)));
  container.querySelector('#cmp-add').addEventListener('click', () => addOption().querySelector('input').focus());

  container.querySelector('#cmp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    showErr('#cmp-error');
    const opciones = [...opts.querySelectorAll('.cmp-option')].map((o) => ({
      factor: parseNumber(o.querySelector('[data-f=factor]').value),
      precioCarga: parseNumber(o.querySelector('[data-f=precio]').value),
    }));
    const referencia = f.refPrecio.value.trim() ? { factor: parseNumber(f.refFactor.value), precioCarga: parseNumber(f.refPrecio.value) } : null;
    if (!(parseNumber(f.kilos.value) > 0)) {
      showErr('#cmp-error', 'Escribe la cantidad de kg.');
      return;
    }
    if (!referencia && opciones.some((o) => !(o.precioCarga > 0))) {
      showErr('#cmp-error', 'Escribe el precio de referencia, o el precio por carga de cada factor.');
      return;
    }
    try {
      const r = await api.compareFactors({ kilos: parseNumber(f.kilos.value), opciones, referencia });
      container.querySelector('#cmp-result').innerHTML = `<div class="table-scroll"><table class="coop-table"><thead><tr><th>Factor</th><th>Precio carga</th><th>Precio kg</th><th>Kg</th><th>Cargas</th><th>Total</th><th>Diferencia</th></tr></thead><tbody>
        ${r.filas.map((x) => `<tr class="${r.mayorValor && x.factor === r.mayorValor.factor ? 'row-highest' : ''}">
          <td data-label="Factor">${formatFactor(x.factor)}</td><td data-label="Precio carga" class="tabular-nums">${formatCopValue(x.precioCarga)}</td>
          <td data-label="Precio kg" class="tabular-nums">${formatCopValue(x.precioKg)}</td><td data-label="Kg" class="tabular-nums">${formatKg(x.kilos)}</td>
          <td data-label="Cargas" class="tabular-nums">${x.cargas.toLocaleString('es-CO')}</td><td data-label="Total" class="tabular-nums">${formatCopValue(x.total)}</td>
          <td data-label="Diferencia" class="tabular-nums">${formatCopValue(x.diferencia)}</td></tr>`).join('')}</tbody></table></div>
        <p class="form-hint">"Diferencia" es cuánto más recibes frente a la opción de menor valor.</p>
        ${r.mayorValor ? `<p class="highlight-note">Mayor valor económico: ${formatFactor(r.mayorValor.factor)} · ${formatCopValue(r.mayorValor.total)}</p>` : ''}`;
    } catch (err) {
      showErr('#cmp-error', err.message);
    }
  });
}
