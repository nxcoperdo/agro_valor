import { api } from '../../services/api.js';
import { escapeHtml, formatKg, formatCopValue, formatPct, parseNumber } from '../../utils/format.js';

const card = (t, v, hl) => `<div class="summary-card ${hl ? 'highlight' : ''}"><h3>${t}</h3><strong class="tabular-nums">${v}</strong></div>`;
const COST_CONCEPTS = ['Transporte', 'Cargue', 'Descargue', 'Mano de obra', 'Secado', 'Bodegaje', 'Otros'];

function fmt(key, v) {
  if (v == null) return '—';
  if (key === 'rendimiento') return formatPct(v);
  if (key === 'kilosSecos' || key === 'kilosNetos' || key === 'destare') return formatKg(v);
  return formatCopValue(v);
}
const signed = (key, d) => (d == null ? '—' : `${d > 0 ? '+' : ''}${fmt(key, d)}`);

export function comparisonTable(cmp) {
  return `<div class="table-scroll"><table class="coop-table"><thead><tr><th>Concepto</th><th>Proyectado</th><th>Real</th><th>Diferencia</th></tr></thead><tbody>
    ${cmp.filas.map((f) => `<tr><td data-label="Concepto">${escapeHtml(f.concepto)}</td><td data-label="Proyectado" class="tabular-nums">${fmt(f.key, f.proyectado)}</td>
      <td data-label="Real" class="tabular-nums">${fmt(f.key, f.real)}</td><td data-label="Diferencia" class="tabular-nums">${signed(f.key, f.diferencia)}</td></tr>`).join('')}
    </tbody></table></div>${cmp.tieneReal ? '' : '<p class="form-hint">El real aparece cuando registres la salida del secado.</p>'}`;
}

/** Procesamiento real + proyectado vs real, dentro del detalle del lote. Solo roles con acceso a costos lo ven. */
export async function renderProcessing(el, lot, reload) {
  let pr;
  try { pr = await api.lotProcessing(lot.id); } catch (e) { el.innerHTML = ''; return; }
  const open = ['CREADO', 'EN_TRANSPORTE', 'EN_SECADO'].includes(lot.status);
  const frozen = ['DISPONIBLE_PARA_VENTA', 'PARCIALMENTE_VENDIDO', 'VENDIDO', 'CERRADO'].includes(lot.status);
  const r = pr.resultadoReal;
  const sec = pr.secado || { kgSecar: 0, kgDirecto: 0, directoAInventario: false };
  const direct = open && sec.directoAInventario; // nada del lote requiere secado
  const mixed = open && !direct && sec.kgDirecto > 0;
  el.innerHTML = `
    <div class="panel"><div class="panel-header"><h2>Procesamiento real</h2></div>
      ${direct ? `<p class="panel-intro">Ninguna compra de este procesamiento requiere secado: se proyecta y entra al 100 %. Puedes enviarlo directo a inventario.</p>` : ''}
      ${mixed ? `<p class="panel-intro">En este procesamiento <strong>${formatKg(sec.kgSecar)}</strong> se secan y <strong>${formatKg(sec.kgDirecto)}</strong> no requieren secado y van directo a inventario. Al registrar la salida del secado, ingresa solo lo que salió de los ${formatKg(sec.kgSecar)} que se secaron; todo entra junto a inventario.</p>` : ''}
      ${open && !direct ? `<form class="calc-form" id="ship-form">
        <div class="field"><label for="s-date">Fecha de envío</label><input type="date" id="s-date" name="fechaEnvio" value="${escapeHtml(pr.envio?.fechaEnvio || '')}" /></div>
        <div class="field"><label for="s-place">Lugar de procesamiento</label><input id="s-place" name="lugar" value="${escapeHtml(pr.envio?.lugar || '')}" /></div>
        <div class="field"><label for="s-kg">Kilos enviados</label><input id="s-kg" name="kilosEnviados" inputmode="decimal" value="${escapeHtml(pr.envio?.kilosEnviados ?? lot.pesoPagable)}" /></div>
        <button type="submit" class="btn-ghost">Guardar envío</button></form>` :
        direct ? '' : `<p class="panel-intro">${pr.envio ? `Enviado ${escapeHtml(pr.envio.fechaEnvio || '—')} a ${escapeHtml(pr.envio.lugar || '—')} · ${formatKg(pr.envio.kilosEnviados)}` : 'Sin datos de envío.'}</p>`}
      <h3>Costos reales de procesamiento</h3>
      ${pr.costos.length ? `<div class="table-scroll"><table class="coop-table"><thead><tr><th>Concepto</th><th>Valor</th><th></th></tr></thead><tbody>
        ${pr.costos.map((c) => `<tr><td data-label="Concepto">${escapeHtml(c.concepto)}</td><td data-label="Valor" class="tabular-nums">${formatCopValue(c.valor)}</td>
          <td>${frozen ? '' : `<button type="button" class="btn-danger" data-rm-cost="${c.id}">Quitar</button>`}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-state">Sin costos de procesamiento.</p>'}
      ${frozen ? '' : `<form class="calc-form" id="pcost-form">
        <div class="field"><label for="pc-c">Concepto</label><input id="pc-c" name="concepto" list="pc-list" required /><datalist id="pc-list">${COST_CONCEPTS.map((c) => `<option value="${c}">`).join('')}</datalist></div>
        <div class="field"><label for="pc-v">Valor</label><input id="pc-v" name="valor" inputmode="numeric" required /></div>
        <button type="submit" class="btn-ghost">+ Agregar costo</button></form>`}
      ${lot.status === 'EN_SECADO' && !direct ? `<h3>Salida real del secado</h3><form class="calc-form" id="finish-form">
        <div class="field"><label for="f-secos">${mixed ? `Kilos secos reales (de los ${formatKg(sec.kgSecar)} que se secaron)` : 'Kilos secos reales'}</label><input id="f-secos" name="kilosSecosReales" inputmode="decimal" required /></div>
        <div class="field"><label for="f-destare">Destare real (kg)</label><input id="f-destare" name="destareRealKg" inputmode="decimal" value="0" /></div>
        <button type="submit" class="btn-primary">Registrar salida</button></form>` : ''}
      ${lot.status === 'SECADO_FINALIZADO' || direct ? `<h3>Entrada a inventario</h3><form class="calc-form" id="inv-form">
        <div class="field"><label for="i-loc">Ubicación</label><input id="i-loc" name="ubicacion" placeholder="Bodega" /></div>
        <button type="submit" class="btn-primary">Enviar a inventario</button></form>` : ''}
      <p class="form-error" id="proc-error" role="alert" hidden></p>
      ${r ? `<div class="summary-cards">${card('Kg secos reales', formatKg(r.kilosSecosReales))}${card('Rendimiento real', formatPct(r.rendimientoReal), true)}
        ${card('Kg netos reales', formatKg(r.kilosNetosReales))}${card('Costo real total', formatCopValue(r.costoRealTotal))}
        ${card('Costo real por kg', r.costoRealKg == null ? '—' : formatCopValue(r.costoRealKg), true)}${card('Costo real por carga', r.costoRealCarga == null ? '—' : formatCopValue(r.costoRealCarga), true)}</div>` : ''}</div>
    <div class="panel"><div class="panel-header"><h2>Proyectado vs real</h2></div>${comparisonTable(pr.comparacion)}</div>`;

  const fail = (err) => { const e = el.querySelector('#proc-error'); e.textContent = err.message; e.hidden = false; };
  el.querySelector('#ship-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try { await api.saveLotShipment(lot.id, { fechaEnvio: f.fechaEnvio.value || null, lugar: f.lugar.value, kilosEnviados: parseNumber(f.kilosEnviados.value) }); await reload(); } catch (err) { fail(err); }
  });
  el.querySelector('#pcost-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try { await api.addLotCost(lot.id, { concepto: f.concepto.value, valor: parseNumber(f.valor.value) }); await reload(); } catch (err) { fail(err); }
  });
  el.querySelectorAll('[data-rm-cost]').forEach((b) => b.addEventListener('click', async () => { try { await api.removeLotCost(lot.id, b.dataset.rmCost); await reload(); } catch (err) { fail(err); } }));
  el.querySelector('#inv-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.enterInventory(lot.id, { ubicacion: e.target.ubicacion.value }); await reload(); } catch (err) { fail(err); }
  });
  el.querySelector('#finish-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try { await api.finishLot(lot.id, { kilosSecosReales: parseNumber(f.kilosSecosReales.value), destareRealKg: parseNumber(f.destareRealKg.value) || 0 }); await reload(); } catch (err) { fail(err); }
  });
}
