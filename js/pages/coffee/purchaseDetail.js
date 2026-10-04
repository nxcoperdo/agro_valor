import { api } from '../../services/api.js';
import { escapeHtml, formatKg, formatCopValue, formatPct, formatDateTime, parseNumber } from '../../utils/format.js';

const CONCEPTS = ['Transporte', 'Cargue', 'Descargue', 'Báscula', 'Combustible', 'Comisión', 'Otro'];
const PROJ_CONCEPTS = ['Secado', 'Transporte posterior', 'Mano de obra', 'Bodegaje', 'Cargue', 'Descargue', 'Trilla', 'Otros'];

const card = (t, v, hl) => `<div class="summary-card ${hl ? 'highlight' : ''}"><h3>${t}</h3><strong class="tabular-nums">${v}</strong></div>`;

function costsPanel(c) {
  return `<div class="panel"><div class="panel-header"><h2>Costos asociados a la compra</h2></div>
    ${c.costos.length ? `<div class="table-scroll"><table class="coop-table"><thead><tr><th>Concepto</th><th>Valor</th><th>Observación</th><th></th></tr></thead><tbody>
      ${c.costos.map((x) => `<tr><td data-label="Concepto">${escapeHtml(x.concepto)}</td><td data-label="Valor" class="tabular-nums">${formatCopValue(x.valor)}</td>
        <td data-label="Observación">${escapeHtml(x.observacion || '—')}</td>
        <td><button type="button" class="btn-danger" data-rm-cost="${x.id}">Quitar</button></td></tr>`).join('')}</tbody></table></div>`
      : '<p class="empty-state">Sin costos registrados.</p>'}
    <form class="calc-form" id="cost-form">
      <div class="field"><label for="c-concept">Concepto</label><input id="c-concept" name="concepto" list="cost-concepts" required />
        <datalist id="cost-concepts">${CONCEPTS.map((x) => `<option value="${x}">`).join('')}</datalist></div>
      <div class="field"><label for="c-valor">Valor</label><input id="c-valor" name="valor" inputmode="numeric" required /></div>
      <div class="field"><label for="c-obs">Observación</label><input id="c-obs" name="observacion" /></div>
      <button type="submit" class="btn-ghost">+ Agregar costo</button>
    </form>
    <p class="form-error" id="cost-error" role="alert" hidden></p>
    <div class="summary-cards">${card('Total costos', formatCopValue(c.totalCostos))}${card('Costo de adquisición', formatCopValue(c.costoAdquisicion), true)}</div></div>`;
}

function projectionPanel(pr) {
  const e = pr.entradas;
  const rows = e.costos.length ? e.costos : [{ concepto: '', valor: '', modo: 'total' }];
  const results = `<div class="summary-cards">
    ${card('Kg secos proyectados', formatKg(pr.kilosSecosProyectados))}${card('Kg netos proyectados', formatKg(pr.kilosNetosProyectados))}
    ${card('Costo total proyectado', formatCopValue(pr.costoTotalProyectado))}
    ${card('Costo mínimo por kg', pr.costoMinimoKg == null ? '—' : formatCopValue(pr.costoMinimoKg), true)}
    ${card('Costo mínimo por carga', pr.costoMinimoCarga == null ? '—' : formatCopValue(pr.costoMinimoCarga), true)}
    ${pr.ingresoProyectado != null ? card('Ingreso proyectado', formatCopValue(pr.ingresoProyectado)) + card('Utilidad proyectada', formatCopValue(pr.utilidadProyectada)) + card('Margen', pr.margen == null ? '—' : formatPct(pr.margen)) : ''}
  </div>`;
  return `<div class="panel"><div class="panel-header"><h2>Proyección${pr.requiresDrying ? ' de secado' : ' (sin secado)'}</h2>${pr.guardada ? '<span class="badge badge-real">Guardada</span>' : ''}</div>
    <form id="proj-form"><div class="calc-form">
      <div class="field"><label class="check-row"><input type="checkbox" id="p-dry" name="requiereSecado" ${pr.requiresDrying ? 'checked' : ''} /> ¿Requiere proceso de secado?</label>
        <small id="p-dry-hint">${pr.requiresDrying ? 'Se proyecta con el rendimiento de secado de abajo.' : 'No se seca: la proyección es directa al 100 % y los precios de venta se calculan igual.'}</small></div>
      <div class="field"><label for="p-rend">Rendimiento de secado (%)</label><input id="p-rend" name="rendimientoSecadoPct" inputmode="decimal" value="${escapeHtml(e.rendimientoSecadoPct)}" ${pr.requiresDrying ? '' : 'disabled'} /></div>
      <div class="field"><label for="p-destare">Destare proyectado (kg)</label><input id="p-destare" name="destareKg" inputmode="decimal" value="${escapeHtml(e.destareKg)}" /></div>
      <div class="field"><label for="p-precio">Precio actual café seco por carga (opcional)</label><input id="p-precio" name="precioVentaCarga" inputmode="numeric" value="${escapeHtml(e.precioVentaCarga ?? '')}" /></div>
    </div>
    <h3>Costos proyectados</h3>
    <div id="proj-costs">${rows.map((c, i) => `<div class="calc-form proj-cost" data-i="${i}">
      <div class="field"><label>Concepto</label><input data-f="concepto" list="proj-concepts" value="${escapeHtml(c.concepto)}" /></div>
      <div class="field"><label>Valor</label><input data-f="valor" inputmode="numeric" value="${escapeHtml(c.valor)}" /></div>
      <div class="field"><label>Se cobra</label><select data-f="modo"><option value="total" ${c.modo === 'total' ? 'selected' : ''}>Total</option><option value="por_kg" ${c.modo === 'por_kg' ? 'selected' : ''}>Por kg seco</option></select></div></div>`).join('')}
      <datalist id="proj-concepts">${PROJ_CONCEPTS.map((x) => `<option value="${x}">`).join('')}</datalist></div>
    <button type="button" class="btn-ghost" id="add-proj-cost">+ Agregar costo proyectado</button>
    <button type="submit" class="btn-primary">Calcular y guardar</button></form>
    <p class="form-error" id="proj-error" role="alert" hidden></p>${results}</div>`;
}

/** Detalle de una compra: resumen, costos internos y proyección. Costos/proyección solo si el rol los puede ver. */
export async function renderPurchaseDetail(container) {
  const id = new URLSearchParams(window.location.hash.split('?')[1] || '').get('id');
  async function load() {
    container.innerHTML = '<div class="panel"><span class="skeleton" style="width:100%;height:160px;"></span></div>';
    let p;
    try { p = await api.purchase(id); } catch (err) {
      container.innerHTML = `<div class="panel"><p class="panel-error">${escapeHtml(err.message)}</p><a class="btn-ghost" href="#/compras">Volver</a></div>`;
      return;
    }
    const [costs, proj] = await Promise.all([api.purchaseCosts(id).catch(() => null), api.projection(id).catch(() => null)]);
    container.innerHTML = `
      <div class="rc-actions"><a class="btn-ghost" href="#/compras">← Compras</a>
        <a class="btn-ghost" href="#/comprobante?id=${p.id}">Comprobante</a></div>
      <div class="panel"><div class="panel-header"><h2>${escapeHtml(p.code)} · ${escapeHtml(p.supplier.name)}</h2>
        <span class="badge ${p.status === 'ANULADA' ? 'badge-stale' : 'badge-real'}">${p.status}</span></div>
        <p class="panel-intro">${formatDateTime(p.purchasedAt)}${p.lot ? ` · Lote ${escapeHtml(p.lot.code)}` : ''}</p>
        <div class="summary-cards">${card('Kg recibidos', formatKg(p.pesoTotalCompra))}${card(`Merma ${formatPct(p.porcentajeMermaInicial)}`, formatKg(p.kgDescontados))}
        ${card('Peso pagable', formatKg(p.pesoPagable), true)}${card('Total pagado', formatCopValue(p.totalCompra), true)}</div></div>
      ${costs ? costsPanel(costs) : ''}${proj ? projectionPanel(proj) : ''}`;

    const showErr = (sel, err) => { const el = container.querySelector(sel); el.textContent = err.message; el.hidden = false; };
    container.querySelector('#cost-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      try { await api.addPurchaseCost(id, { ...d, valor: parseNumber(d.valor) }); await load(); } catch (err) { showErr('#cost-error', err); }
    });
    container.querySelectorAll('[data-rm-cost]').forEach((b) => b.addEventListener('click', async () => {
      try { await api.removePurchaseCost(id, b.dataset.rmCost); await load(); } catch (err) { showErr('#cost-error', err); }
    }));
    // Al apagar el secado el rendimiento queda en 100 % (bloqueado); al encenderlo vuelve a ser editable.
    container.querySelector('#p-dry')?.addEventListener('change', (e) => {
      const rend = container.querySelector('#p-rend');
      rend.disabled = !e.target.checked;
      if (!e.target.checked) rend.value = '100';
      else if (parseNumber(rend.value) === 100) rend.value = '55';
      container.querySelector('#p-dry-hint').textContent = e.target.checked
        ? 'Se proyecta con el rendimiento de secado de abajo.'
        : 'No se seca: la proyección es directa al 100 % y los precios de venta se calculan igual.';
    });
    container.querySelector('#add-proj-cost')?.addEventListener('click', () => {
      const host = container.querySelector('#proj-costs');
      const tpl = host.querySelector('.proj-cost').cloneNode(true);
      tpl.querySelectorAll('input').forEach((i) => { i.value = ''; });
      host.insertBefore(tpl, host.querySelector('datalist'));
    });
    container.querySelector('#proj-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const costos = [...f.querySelectorAll('.proj-cost')].map((r) => ({
        concepto: r.querySelector('[data-f=concepto]').value.trim(),
        valor: parseNumber(r.querySelector('[data-f=valor]').value),
        modo: r.querySelector('[data-f=modo]').value,
      })).filter((c) => c.concepto || Number.isFinite(c.valor));
      try {
        await api.saveProjection(id, {
          requiereSecado: f.requiereSecado.checked,
          rendimientoSecadoPct: parseNumber(f.rendimientoSecadoPct.value),
          destareKg: parseNumber(f.destareKg.value) || 0,
          precioVentaCarga: f.precioVentaCarga.value.trim() ? parseNumber(f.precioVentaCarga.value) : null,
          costos,
        });
        await load();
      } catch (err) { showErr('#proj-error', err); }
    });
  }
  await load();
}
