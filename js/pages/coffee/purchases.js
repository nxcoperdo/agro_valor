import { api } from '../../services/api.js';
import { isPro } from '../../services/auth.js';
import { paywall } from '../../ui/shell.js';
import { mountStepper } from '../../ui/stepper.js';
import { CARGA_KG, escapeHtml, formatKg, formatCopValue, formatPct, formatDateTime, parseNumber } from '../../utils/format.js';

const COFFEE_TYPES = {
  cafe_verde: { label: 'Café verde', merma: 8 },
  cafe_merma_5: { label: 'Café con merma 5%', merma: 5 },
  cafe_sin_merma: { label: 'Café sin merma', merma: 0 },
  otro: { label: 'Otro', merma: 0 },
};
const PAYMENTS = { efectivo: 'Efectivo', transferencia: 'Transferencia', credito: 'Crédito', otro: 'Otro' };

/** Vista previa en pantalla; el servidor recalcula y es quien guarda. */
function preview(state) {
  const total = state.weighings.reduce((a, w) => a + (parseNumber(w) || 0), 0);
  const merma = parseNumber(state.merma) || 0;
  const descontados = (total * merma) / 100;
  const pagable = total - descontados;
  const precioCarga = parseNumber(state.precioCarga) || 0;
  return { total, descontados, pagable, precioKg: precioCarga / CARGA_KG, totalPagar: Math.round(pagable * (precioCarga / CARGA_KG)) };
}

function summaryCards(state) {
  const p = preview(state);
  return `<div class="summary-cards">
    <div class="summary-card"><h3>Kg recibidos</h3><strong class="tabular-nums">${formatKg(p.total)}</strong></div>
    <div class="summary-card"><h3>Descuento (${formatPct(parseNumber(state.merma) || 0)})</h3><strong class="tabular-nums">${formatKg(p.descontados)}</strong></div>
    <div class="summary-card highlight"><h3>PESO PAGABLE</h3><strong class="tabular-nums">${formatKg(p.pagable)}</strong></div>
    <div class="summary-card highlight"><h3>TOTAL A PAGAR</h3><strong class="tabular-nums">${formatCopValue(p.totalPagar)}</strong></div>
  </div>`;
}

const stepSupplier = {
  id: 'supplier',
  title: 'Proveedor',
  render: (s) => `
    <div class="calc-form">
      <div class="field"><label for="sup-q">Buscar proveedor</label>
        <input id="sup-q" type="search" placeholder="Nombre o identificación" autocomplete="off" />
        <ul class="pick-list" id="sup-results"></ul></div>
    </div>
    <p class="form-hint">${s.supplierId ? `Seleccionado: <strong>${escapeHtml(s.supplierName)}</strong>` : 'Si no existe, créalo aquí abajo sin salir de la compra.'}</p>
    <details ${s.supplierId ? '' : 'open'} class="inline-new"><summary>Crear proveedor nuevo</summary>
      <div class="calc-form">
        <div class="field"><label for="sup-type">Tipo de identificación</label>
          <select id="sup-type"><option>CC</option><option>NIT</option><option>CE</option><option>PASAPORTE</option><option>OTRO</option></select></div>
        <div class="field"><label for="sup-num">Número</label><input id="sup-num" inputmode="numeric" value="${escapeHtml(s.newSupplier.idNumber)}" /></div>
        <div class="field"><label for="sup-name">Nombre</label><input id="sup-name" value="${escapeHtml(s.newSupplier.name)}" /></div>
        <div class="field"><label for="sup-legal">Razón social</label><input id="sup-legal" value="${escapeHtml(s.newSupplier.legalName)}" /></div>
        <div class="field"><label for="sup-phone">Teléfono</label><input id="sup-phone" inputmode="tel" value="${escapeHtml(s.newSupplier.phone)}" /></div>
        <div class="field"><label for="sup-muni">Municipio</label><input id="sup-muni" value="${escapeHtml(s.newSupplier.municipality)}" /></div>
        <div class="field"><label for="sup-addr">Dirección</label><input id="sup-addr" value="${escapeHtml(s.newSupplier.address)}" /></div>
        <div class="field"><label for="sup-notes">Observaciones</label><input id="sup-notes" value="${escapeHtml(s.newSupplier.notes)}" /></div>
      </div></details>`,
  afterRender(el, s) {
    const q = el.querySelector('#sup-q');
    const results = el.querySelector('#sup-results');
    const map = { 'sup-type': 'idType', 'sup-num': 'idNumber', 'sup-name': 'name', 'sup-legal': 'legalName', 'sup-phone': 'phone', 'sup-muni': 'municipality', 'sup-addr': 'address', 'sup-notes': 'notes' };
    el.querySelector('#sup-type').value = s.newSupplier.idType;
    Object.entries(map).forEach(([id, key]) => el.querySelector(`#${id}`).addEventListener('input', (e) => {
      s.newSupplier[key] = e.target.value;
      s.supplierId = null; // si escribe uno nuevo, deja de usar el seleccionado
    }));
    let timer;
    q.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (q.value.trim().length < 2) { results.innerHTML = ''; return; }
        const { suppliers } = await api.searchSuppliers(q.value.trim());
        results.innerHTML = suppliers.length
          ? suppliers.map((x) => `<li><button type="button" class="pick" data-id="${x.id}" data-name="${escapeHtml(x.name)}">${escapeHtml(x.name)} <small>${escapeHtml(x.idType)} ${escapeHtml(x.idNumber)}</small></button></li>`).join('')
          : '<li class="form-hint">Sin resultados</li>';
      }, 250);
    });
    results.addEventListener('click', (e) => {
      const b = e.target.closest('.pick');
      if (!b) return;
      s.supplierId = Number(b.dataset.id);
      s.supplierName = b.dataset.name;
      results.innerHTML = '';
      el.querySelector('.form-hint').innerHTML = `Seleccionado: <strong>${escapeHtml(s.supplierName)}</strong>`;
    });
  },
  validate: (s) => (s.supplierId || (s.newSupplier.idNumber.trim() && s.newSupplier.name.trim()) ? null : 'Selecciona un proveedor o completa identificación y nombre'),
};

const stepWeighings = {
  id: 'weighings',
  title: 'Pesadas',
  render: (s) => `
    <div class="calc-form">
      <div class="field"><label for="coffee-type">Tipo de café</label>
        <select id="coffee-type">${Object.entries(COFFEE_TYPES).map(([k, v]) => `<option value="${k}" ${s.coffeeType === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
      <div class="field"><label for="merma">Merma inicial (%)</label><input id="merma" inputmode="decimal" value="${escapeHtml(s.merma)}" /></div>
    </div>
    <div id="weighings-list">${s.weighings.map((w, i) => `
      <div class="weighing-row"><label for="w-${i}">Pesada ${i + 1} (kg)</label>
        <input id="w-${i}" data-i="${i}" inputmode="decimal" value="${escapeHtml(w)}" />
        ${s.weighings.length > 1 ? `<button type="button" class="btn-ghost" data-remove="${i}" aria-label="Quitar pesada ${i + 1}">Quitar</button>` : ''}</div>`).join('')}</div>
    <button type="button" class="btn-ghost" id="add-weighing">+ Agregar pesada</button>
    <div id="live-summary">${summaryCards(s)}</div>`,
  afterRender(el, s, redraw) {
    const live = () => { el.querySelector('#live-summary').innerHTML = summaryCards(s); };
    el.querySelector('#coffee-type').addEventListener('change', (e) => {
      s.coffeeType = e.target.value;
      s.merma = String(COFFEE_TYPES[s.coffeeType].merma);
      el.querySelector('#merma').value = s.merma;
      live();
    });
    el.querySelector('#merma').addEventListener('input', (e) => { s.merma = e.target.value; live(); });
    el.querySelectorAll('[data-i]').forEach((i) => i.addEventListener('input', (e) => { s.weighings[Number(e.target.dataset.i)] = e.target.value; live(); }));
    el.querySelector('#add-weighing').addEventListener('click', () => { s.weighings.push(''); s.rerender(); });
    el.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => { s.weighings.splice(Number(b.dataset.remove), 1); s.rerender(); }));
  },
  validate: (s) => {
    if (s.weighings.some((w) => !(parseNumber(w) > 0))) return 'Cada pesada debe ser mayor a cero';
    const m = parseNumber(s.merma);
    return Number.isFinite(m) && m >= 0 && m <= 100 ? null : 'La merma debe estar entre 0 y 100';
  },
};

const stepPrice = {
  id: 'price',
  title: 'Precio y pago',
  render: (s) => `
    <div class="calc-form">
      <div class="field"><label for="precio-carga">Precio por carga (${CARGA_KG} kg)</label><input id="precio-carga" inputmode="numeric" value="${escapeHtml(s.precioCarga)}" /></div>
      <div class="field"><label for="payment">Forma de pago</label>
        <select id="payment">${Object.entries(PAYMENTS).map(([k, v]) => `<option value="${k}" ${s.paymentMethod === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="field"><label for="reference">Referencia</label><input id="reference" value="${escapeHtml(s.paymentReference)}" /></div>
      <div class="field"><label for="notes">Observaciones</label><input id="notes" value="${escapeHtml(s.notes)}" /></div>
    </div>
    <div id="live-summary">${summaryCards(s)}</div>
    <p class="form-hint tabular-nums" id="precio-kg"></p>`,
  afterRender(el, s) {
    const live = () => {
      el.querySelector('#live-summary').innerHTML = summaryCards(s);
      el.querySelector('#precio-kg').textContent = `Precio por kg: ${formatCopValue(preview(s).precioKg)}`;
    };
    live();
    [['precio-carga', 'precioCarga'], ['payment', 'paymentMethod'], ['reference', 'paymentReference'], ['notes', 'notes']].forEach(([id, key]) =>
      el.querySelector(`#${id}`).addEventListener('input', (e) => { s[key] = e.target.value; live(); }));
  },
  validate: (s) => (parseNumber(s.precioCarga) > 0 ? null : 'El precio por carga debe ser mayor a cero'),
};

const stepConfirm = {
  id: 'confirm',
  title: 'Confirmar',
  render: (s) => `<div class="panel-intro">Proveedor: <strong>${escapeHtml(s.supplierId ? s.supplierName : s.newSupplier.name)}</strong> ·
    ${escapeHtml(COFFEE_TYPES[s.coffeeType].label)} · ${s.weighings.length} pesada(s) · ${PAYMENTS[s.paymentMethod]}</div>
    ${summaryCards(s)}`,
};

function freshState() {
  return {
    supplierId: null, supplierName: '', coffeeType: 'cafe_verde', merma: '8', weighings: [''],
    precioCarga: '', paymentMethod: 'efectivo', paymentReference: '', notes: '',
    newSupplier: { idType: 'CC', idNumber: '', name: '', legalName: '', phone: '', municipality: '', address: '', notes: '' },
  };
}

function toPayload(s) {
  const payload = {
    coffeeType: s.coffeeType,
    porcentajeMermaInicial: parseNumber(s.merma),
    weighings: s.weighings.map((w) => ({ pesoKg: parseNumber(w) })),
    precioCarga: parseNumber(s.precioCarga),
    paymentMethod: s.paymentMethod,
    paymentReference: s.paymentReference,
    notes: s.notes,
  };
  if (s.supplierId) payload.supplierId = s.supplierId; else payload.supplier = s.newSupplier;
  return payload;
}

/** Tarjetas de consolidado (jornada o día). Los costos internos solo llegan si el rol los puede ver. */
export function consolidatedCards(s) {
  const card = (t, v) => `<div class="summary-card"><h3>${t}</h3><strong class="tabular-nums">${v}</strong></div>`;
  return `<div class="summary-cards">
    ${card('Compras', s.compras)}${card('Proveedores', s.proveedores)}${card('Pesadas', s.pesadas)}
    ${card('Kg recibidos', formatKg(s.kgRecibidos))}${card('Kg pagables', formatKg(s.kgPagables))}${card('Kg descontados', formatKg(s.kgDescontados))}
    ${card('Total pagado', formatCopValue(s.totalPagado))}
    ${s.costosInternos != null ? card('Costos internos', formatCopValue(s.costosInternos)) : ''}
    ${card('Kg secos proyectados', formatKg(s.kgSecosProyectados))}
    ${card('Precio carga promedio', formatCopValue(s.precioCargaPromedio))}${card('Merma promedio', formatPct(s.mermaPromedio))}
  </div>`;
}

function historyRow(p) {
  const voided = p.status === 'ANULADA';
  return `<tr class="${voided ? 'row-voided' : ''}">
    <td data-label="Compra">${escapeHtml(p.code)}</td>
    <td data-label="Fecha">${formatDateTime(p.purchasedAt)}</td>
    <td data-label="Proveedor">${escapeHtml(p.supplier.name)}</td>
    <td data-label="Tipo">${escapeHtml(COFFEE_TYPES[p.coffeeType]?.label || p.coffeeType)}</td>
    <td data-label="Pesadas" class="tabular-nums">${p.weighingsCount}</td>
    <td data-label="Kg recibidos" class="tabular-nums">${formatKg(p.pesoTotalCompra)}</td>
    <td data-label="Kg pagables" class="tabular-nums">${formatKg(p.pesoPagable)}</td>
    <td data-label="Precio carga" class="tabular-nums">${formatCopValue(p.precioCarga)}</td>
    <td data-label="Total" class="tabular-nums">${formatCopValue(p.totalCompra)}</td>
    <td data-label="Lote">${p.lot ? escapeHtml(p.lot.code) : '—'}</td>
    <td data-label="Estado"><span class="badge ${voided ? 'badge-stale' : 'badge-real'}">${p.status}</span></td>
    <td data-label="Acciones">${voided ? '' : `<button type="button" class="btn-danger" data-void="${p.id}">Anular</button>`}</td>
  </tr>`;
}

export async function renderPurchases(container) {
  if (!isPro()) {
    container.innerHTML = paywall('Compras de café', 'Registra compras con múltiples pesadas, merma y comprobante para cada proveedor.');
    return;
  }

  async function load() {
    container.innerHTML = '<div class="panel"><span class="skeleton" style="width:100%;height:120px;"></span></div>';
    let purchases, workday;
    try {
      [{ purchases }, workday] = await Promise.all([api.purchases(), api.currentWorkday()]);
    } catch (err) {
      container.innerHTML = `<div class="panel"><p class="panel-error">${escapeHtml(err.message)}</p></div>`;
      return;
    }
    container.innerHTML = `
      <div class="panel"><div class="panel-header"><h2>Jornada actual · ${escapeHtml(workday.code)}</h2>
        <span class="badge badge-real">${workday.status}</span></div>
        ${consolidatedCards(workday.summary)}
        <button type="button" class="btn-ghost" id="close-workday">Cerrar jornada</button>
        <p class="form-error" id="workday-error" role="alert" hidden></p></div>
      <div class="panel"><div class="panel-header"><h2>Nueva compra</h2></div><div id="stepper-root"></div></div>
      <div class="panel"><div class="panel-header"><h2>Historial de compras</h2></div>
        ${purchases.length ? `<div class="table-scroll"><table class="coop-table"><thead><tr>
          <th>Compra</th><th>Fecha</th><th>Proveedor</th><th>Tipo</th><th>Pesadas</th><th>Kg recibidos</th><th>Kg pagables</th>
          <th>Precio carga</th><th>Total</th><th>Lote</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>${purchases.map(historyRow).join('')}</tbody></table></div>`
          : '<p class="empty-state">Aún no hay compras registradas.</p>'}
        <p class="form-error" id="history-error" role="alert" hidden></p></div>`;

    const state = freshState();
    const root = container.querySelector('#stepper-root');
    const steps = [stepSupplier, stepWeighings, stepPrice, stepConfirm];
    const stepper = mountStepper(root, { steps, state, finishLabel: 'Registrar compra', onFinish: async (s) => { await api.createPurchase(toPayload(s)); await load(); } });
    state.rerender = () => stepper.redraw();

    container.querySelector('#close-workday').addEventListener('click', async () => {
      if (!window.confirm(`¿Cerrar la jornada ${workday.code}? Las nuevas compras irán a una jornada nueva.`)) return;
      try { await api.closeWorkday(workday.id); await load(); }
      catch (err) { const e = container.querySelector('#workday-error'); e.textContent = err.message; e.hidden = false; }
    });

    container.querySelectorAll('[data-void]').forEach((btn) => btn.addEventListener('click', async () => {
      const reason = window.prompt('Motivo de la anulación (obligatorio):');
      if (!reason || !reason.trim()) return;
      try { await api.voidPurchase(btn.dataset.void, reason.trim()); await load(); }
      catch (err) { const e = container.querySelector('#history-error'); e.textContent = err.message; e.hidden = false; }
    }));
  }
  await load();
}
