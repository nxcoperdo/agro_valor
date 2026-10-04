import { api } from '../../services/api.js';
import { isPro } from '../../services/auth.js';
import { paywall } from '../../ui/shell.js';
import { mountStepper } from '../../ui/stepper.js';
import { askConfirm, askReason } from '../../ui/confirm.js';
import { CARGA_KG, escapeHtml, formatKg, formatCopValue, formatPct, formatDateTime, parseNumber } from '../../utils/format.js';

/** Respaldo si no se pueden pedir al servidor (GET /coffee/product-types es la fuente). */
const FALLBACK_PRODUCT_TYPES = [
  { key: 'cafe', label: 'Café', mermaDefault: 8, requiresDryingDefault: true },
  { key: 'cacao', label: 'Cacao', mermaDefault: 0, requiresDryingDefault: false },
  { key: 'pasilla_cafe', label: 'Pasilla de café', mermaDefault: 0, requiresDryingDefault: false },
  { key: 'maiz', label: 'Maíz', mermaDefault: 0, requiresDryingDefault: false },
  { key: 'frijol', label: 'Frijol', mermaDefault: 0, requiresDryingDefault: false },
];
const PAYMENTS = { efectivo: 'Efectivo', transferencia: 'Transferencia', credito: 'Crédito', otro: 'Otro' };

/** Un producto de la factura, vacío y con los valores por defecto de su tipo. */
const newLine = (types, key) => {
  const t = types.find((x) => x.key === key) || types[0];
  return { productType: t.key, merma: String(t.mermaDefault), requiresDrying: t.requiresDryingDefault, weighings: [''], priceMode: 'carga', precioCarga: '', precioKg: '' };
};
const typeOfLine = (s, line) => s.productTypes.find((t) => t.key === line.productType) || s.productTypes[0];

/** Vista previa de un producto en pantalla; el servidor recalcula y es quien guarda. */
function previewLine(line) {
  const total = line.weighings.reduce((a, w) => a + (parseNumber(w) || 0), 0);
  const merma = parseNumber(line.merma) || 0;
  const descontados = (total * merma) / 100;
  const pagable = total - descontados;
  // El precio se escribe por carga o directamente por kilo.
  const precioKg = line.priceMode === 'kg' ? parseNumber(line.precioKg) || 0 : (parseNumber(line.precioCarga) || 0) / CARGA_KG;
  return { total, descontados, pagable, precioKg, totalPagar: Math.round(pagable * precioKg) };
}

function invoiceTotals(s) {
  return s.lines.reduce(
    (acc, line) => {
      const p = previewLine(line);
      return { pagable: acc.pagable + p.pagable, total: acc.total + p.totalPagar };
    },
    { pagable: 0, total: 0 }
  );
}

function lineCards(line) {
  const p = previewLine(line);
  return `<div class="summary-cards">
    <div class="summary-card"><h3>Kg recibidos</h3><strong class="tabular-nums">${formatKg(p.total)}</strong></div>
    <div class="summary-card"><h3>Descuento (${formatPct(parseNumber(line.merma) || 0)})</h3><strong class="tabular-nums">${formatKg(p.descontados)}</strong></div>
    <div class="summary-card"><h3>Peso pagable</h3><strong class="tabular-nums">${formatKg(p.pagable)}</strong></div>
    <div class="summary-card"><h3>Precio por kg</h3><strong class="tabular-nums">${formatCopValue(p.precioKg)}</strong></div>
    <div class="summary-card highlight"><h3>Subtotal</h3><strong class="tabular-nums">${formatCopValue(p.totalPagar)}</strong></div>
  </div>`;
}

function totalCards(s) {
  const t = invoiceTotals(s);
  return `<div class="summary-cards">
    <div class="summary-card"><h3>Productos</h3><strong class="tabular-nums">${s.lines.length}</strong></div>
    <div class="summary-card highlight"><h3>PESO PAGABLE</h3><strong class="tabular-nums">${formatKg(t.pagable)}</strong></div>
    <div class="summary-card highlight"><h3>TOTAL A PAGAR</h3><strong class="tabular-nums">${formatCopValue(t.total)}</strong></div>
  </div>`;
}

const stepSupplier = {
  id: 'supplier',
  title: 'Proveedor',
  render: (s) => `
    <div class="calc-form">
      <div class="field"><label for="sup-q">Buscar proveedor</label>
        <input id="sup-q" type="search" placeholder="Toca para ver la lista, o escribe nombre o identificación" autocomplete="off" />
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
    // Al enfocar (o tocar) el buscador se despliegan todos los proveedores registrados en orden
    // alfabético; al escribir se filtra la misma lista.
    let timer;
    let seq = 0;
    const showList = async () => {
      const mine = ++seq;
      try {
        const { suppliers } = await api.searchSuppliers(q.value.trim());
        if (mine !== seq) return; // llegó una respuesta más vieja que la última búsqueda
        results.innerHTML = suppliers.length
          ? suppliers.map((x) => `<li><button type="button" class="pick" data-id="${x.id}" data-name="${escapeHtml(x.name)}">${escapeHtml(x.name)} <small>${escapeHtml(x.idType)} ${escapeHtml(x.idNumber)}</small></button></li>`).join('')
          : `<li class="form-hint">${q.value.trim() ? 'Sin resultados' : 'Todavía no hay proveedores registrados'}</li>`;
      } catch (err) {
        if (mine === seq) results.innerHTML = `<li class="form-hint">${escapeHtml(err.message)}</li>`;
      }
    };
    q.addEventListener('focus', showList);
    q.addEventListener('click', showList);
    q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(showList, 250); });
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

/** Un producto de la factura: tipo, merma, secado, pesadas y precio. Cada producto tiene su propio precio. */
function lineHtml(s, line, i) {
  const t = typeOfLine(s, line);
  const n = s.lines.length;
  return `<fieldset class="invoice-line" data-line="${i}">
    <legend>Producto ${i + 1}${n > 1 ? ` · ${escapeHtml(t.label)}` : ''}</legend>
    <div class="calc-form">
      <div class="field"><label for="ln${i}-type">Tipo de producto (café, cacao, pasilla de café, maíz, frijol)</label>
        <select id="ln${i}-type" class="ln-type">${s.productTypes.map((x) => `<option value="${x.key}" ${line.productType === x.key ? 'selected' : ''}>${escapeHtml(x.label)}</option>`).join('')}</select></div>
      <div class="field"><label for="ln${i}-merma">Merma inicial (%)</label><input id="ln${i}-merma" class="ln-merma" inputmode="decimal" value="${escapeHtml(line.merma)}" /></div>
      <div class="field"><label class="check-row"><input type="checkbox" class="ln-dry" ${line.requiresDrying ? 'checked' : ''} /> ¿Requiere secado?</label>
        <small>${line.requiresDrying ? 'Pasa por secado antes de entrar a inventario.' : 'No se seca: la proyección es directa al 100 % y puede enviarse a inventario.'}</small></div>
    </div>
    <div>${line.weighings.map((w, j) => `
      <div class="weighing-row"><label for="ln${i}-w${j}">Pesada ${j + 1} (kg)</label>
        <input id="ln${i}-w${j}" class="ln-w" data-w="${j}" inputmode="decimal" value="${escapeHtml(w)}" />
        ${line.weighings.length > 1 ? `<button type="button" class="btn-ghost ln-wrm" data-w="${j}" aria-label="Quitar pesada ${j + 1}">Quitar</button>` : ''}</div>`).join('')}</div>
    <button type="button" class="btn-ghost ln-wadd">+ Agregar pesada</button>
    <div class="calc-form">
      <div class="field"><label for="ln${i}-mode">Definir el precio</label>
        <select id="ln${i}-mode" class="ln-mode"><option value="carga" ${line.priceMode === 'carga' ? 'selected' : ''}>Por carga (${CARGA_KG} kg)</option>
          <option value="kg" ${line.priceMode === 'kg' ? 'selected' : ''}>Por kilogramo</option></select></div>
      <div class="field"><label for="ln${i}-price">${line.priceMode === 'kg' ? 'Precio por kilogramo' : `Precio por carga (${CARGA_KG} kg)`}</label>
        <input id="ln${i}-price" class="ln-price" inputmode="decimal" value="${escapeHtml(line.priceMode === 'kg' ? line.precioKg : line.precioCarga)}" /></div>
    </div>
    <div class="ln-sum">${lineCards(line)}</div>
    ${n > 1 ? '<button type="button" class="btn-danger ln-rm">Quitar este producto</button>' : ''}
  </fieldset>`;
}

const stepProducts = {
  id: 'products',
  title: 'Productos',
  render: (s) => `
    <p class="form-hint">Si el cliente trae varios productos, agrégalos aquí: cada uno lleva su pesada, su precio y su subtotal, como una factura.</p>
    ${s.lines.map((line, i) => lineHtml(s, line, i)).join('')}
    <button type="button" class="btn-ghost" id="add-line">+ Agregar otro producto</button>
    <div id="invoice-total">${totalCards(s)}</div>`,
  afterRender(el, s) {
    const lineOf = (target) => {
      const box = target.closest('[data-line]');
      return box ? { i: Number(box.dataset.line), box } : null;
    };
    /** Refresca solo los resúmenes (no redibuja, para no perder el cursor al escribir). */
    const live = (i, box) => {
      box.querySelector('.ln-sum').innerHTML = lineCards(s.lines[i]);
      el.querySelector('#invoice-total').innerHTML = totalCards(s);
    };

    el.addEventListener('input', (e) => {
      const ctx = lineOf(e.target);
      if (!ctx) return;
      const line = s.lines[ctx.i];
      if (e.target.classList.contains('ln-merma')) line.merma = e.target.value;
      else if (e.target.classList.contains('ln-w')) line.weighings[Number(e.target.dataset.w)] = e.target.value;
      else if (e.target.classList.contains('ln-price')) line[line.priceMode === 'kg' ? 'precioKg' : 'precioCarga'] = e.target.value;
      else return;
      live(ctx.i, ctx.box);
    });

    el.addEventListener('change', (e) => {
      const ctx = lineOf(e.target);
      if (!ctx) return;
      const line = s.lines[ctx.i];
      if (e.target.classList.contains('ln-type')) {
        // Al cambiar de producto, la merma y el secado vuelven a los valores de ese producto.
        const fresh = newLine(s.productTypes, e.target.value);
        Object.assign(line, { productType: fresh.productType, merma: fresh.merma, requiresDrying: fresh.requiresDrying });
      } else if (e.target.classList.contains('ln-dry')) line.requiresDrying = e.target.checked;
      else if (e.target.classList.contains('ln-mode')) line.priceMode = e.target.value;
      else return;
      s.rerender();
    });

    el.addEventListener('click', (e) => {
      const ctx = lineOf(e.target);
      if (e.target.closest('#add-line')) {
        s.lines.push(newLine(s.productTypes));
        s.rerender();
        document.getElementById(`ln${s.lines.length - 1}-type`)?.focus();
        return;
      }
      if (!ctx) return;
      const line = s.lines[ctx.i];
      if (e.target.closest('.ln-wadd')) {
        line.weighings.push('');
        s.rerender();
        document.getElementById(`ln${ctx.i}-w${line.weighings.length - 1}`)?.focus(); // la nueva pesada lista para escribir
      } else if (e.target.closest('.ln-wrm')) {
        line.weighings.splice(Number(e.target.closest('.ln-wrm').dataset.w), 1);
        s.rerender();
      } else if (e.target.closest('.ln-rm')) {
        s.lines.splice(ctx.i, 1);
        s.rerender();
      }
    });
  },
  validate: (s) => {
    for (let i = 0; i < s.lines.length; i += 1) {
      const line = s.lines[i];
      const who = s.lines.length > 1 ? `Producto ${i + 1}: ` : '';
      if (line.weighings.some((w) => !(parseNumber(w) > 0))) return `${who}cada pesada debe ser mayor a cero`;
      const m = parseNumber(line.merma);
      if (!(Number.isFinite(m) && m >= 0 && m <= 100)) return `${who}la merma debe estar entre 0 y 100`;
      const price = parseNumber(line.priceMode === 'kg' ? line.precioKg : line.precioCarga);
      if (!(price > 0)) return `${who}el precio ${line.priceMode === 'kg' ? 'por kilogramo' : 'por carga'} debe ser mayor a cero`;
    }
    return null;
  },
};

const stepPayment = {
  id: 'payment',
  title: 'Pago',
  render: (s) => `
    <div class="calc-form">
      <div class="field"><label for="payment">Forma de pago</label>
        <select id="payment">${Object.entries(PAYMENTS).map(([k, v]) => `<option value="${k}" ${s.paymentMethod === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="field"><label for="reference">Referencia</label><input id="reference" value="${escapeHtml(s.paymentReference)}" /></div>
      <div class="field"><label for="notes">Observaciones</label><input id="notes" value="${escapeHtml(s.notes)}" /></div>
    </div>
    <div id="invoice-total">${totalCards(s)}</div>`,
  afterRender(el, s) {
    [['payment', 'paymentMethod'], ['reference', 'paymentReference'], ['notes', 'notes']].forEach(([id, key]) =>
      el.querySelector(`#${id}`).addEventListener('input', (e) => { s[key] = e.target.value; }));
  },
};

const stepConfirm = {
  id: 'confirm',
  title: 'Confirmar',
  render: (s) => `<div class="panel-intro">Proveedor: <strong>${escapeHtml(s.supplierId ? s.supplierName : s.newSupplier.name)}</strong> · ${PAYMENTS[s.paymentMethod]}</div>
    <div class="table-scroll"><table class="coop-table"><thead><tr><th>Producto</th><th>Kg pagables</th><th>Precio por kg</th><th>Subtotal</th></tr></thead><tbody>
      ${s.lines.map((line) => {
        const p = previewLine(line);
        return `<tr><td data-label="Producto">${escapeHtml(typeOfLine(s, line).label)}${line.requiresDrying ? '' : ' <small>(sin secado)</small>'}</td>
          <td data-label="Kg pagables" class="tabular-nums">${formatKg(p.pagable)}</td>
          <td data-label="Precio por kg" class="tabular-nums">${formatCopValue(p.precioKg)}</td>
          <td data-label="Subtotal" class="tabular-nums">${formatCopValue(p.totalPagar)}</td></tr>`;
      }).join('')}</tbody></table></div>
    ${totalCards(s)}`,
};

function freshState(productTypes) {
  return {
    productTypes, lines: [newLine(productTypes)],
    supplierId: null, supplierName: '',
    paymentMethod: 'efectivo', paymentReference: '', notes: '',
    newSupplier: { idType: 'CC', idNumber: '', name: '', legalName: '', phone: '', municipality: '', address: '', notes: '' },
  };
}

function toPayload(s) {
  const payload = {
    paymentMethod: s.paymentMethod,
    paymentReference: s.paymentReference,
    notes: s.notes,
    items: s.lines.map((line) => ({
      productType: line.productType,
      requiresDrying: line.requiresDrying,
      porcentajeMermaInicial: parseNumber(line.merma),
      weighings: line.weighings.map((w) => ({ pesoKg: parseNumber(w) })),
      ...(line.priceMode === 'kg' ? { precioKg: parseNumber(line.precioKg) } : { precioCarga: parseNumber(line.precioCarga) }),
    })),
  };
  if (s.supplierId) payload.supplierId = s.supplierId; else payload.supplier = s.newSupplier;
  return payload;
}

/** Tarjetas de consolidado (jornada o día). Los costos internos solo llegan si el rol los puede ver. */
export function consolidatedCards(s) {
  const card = (t, v) => `<div class="summary-card"><h3>${t}</h3><strong class="tabular-nums">${v}</strong></div>`;
  return `<div class="summary-cards">
    ${card('Compras', s.compras)}${s.productos != null && s.productos !== s.compras ? card('Productos', s.productos) : ''}${card('Proveedores', s.proveedores)}${card('Pesadas', s.pesadas)}
    ${card('Kg recibidos', formatKg(s.kgRecibidos))}${card('Kg pagables', formatKg(s.kgPagables))}${card('Kg descontados', formatKg(s.kgDescontados))}
    ${card('Total pagado', formatCopValue(s.totalPagado))}
    ${s.costosInternos != null ? card('Costos internos', formatCopValue(s.costosInternos)) : ''}
    ${card('Kg secos proyectados', formatKg(s.kgSecosProyectados))}
    ${card('Precio carga promedio', formatCopValue(s.precioCargaPromedio))}${card('Merma promedio', formatPct(s.mermaPromedio))}
  </div>`;
}

function historyRow(inv) {
  const voided = inv.status === 'ANULADA';
  const products = inv.lines.map((l) => escapeHtml(l.productLabel)).join(', ');
  return `<tr class="${voided ? 'row-voided' : ''}">
    <td data-label="Factura">${escapeHtml(inv.code)}<br /><small>${formatDateTime(inv.purchasedAt)}</small></td>
    <td data-label="Proveedor">${escapeHtml(inv.supplier.name)}</td>
    <td data-label="Productos">${products}</td>
    <td data-label="Kg pagables" class="tabular-nums">${formatKg(voided ? inv.lines.reduce((a, l) => a + l.pesoPagable, 0) : inv.totals.pesoPagable)}</td>
    <td data-label="Total" class="tabular-nums">${formatCopValue(voided ? inv.lines.reduce((a, l) => a + l.totalCompra, 0) : inv.totals.totalCompra)}</td>
    <td data-label="Estado"><span class="badge ${voided ? 'badge-stale' : 'badge-real'}">${inv.status}</span></td>
    <td data-label="Acciones" class="row-actions">
      <a class="btn-ghost" href="#/factura?id=${inv.id}">Ver detalle</a>
      <a class="btn-ghost" href="#/comprobante?factura=${inv.id}">Comprobante</a>
      ${voided ? '' : `<button type="button" class="btn-danger" data-void="${inv.id}">Anular</button>`}</td>
  </tr>`;
}

export async function renderPurchases(container) {
  if (!isPro()) {
    container.innerHTML = paywall('Compra de producto', 'Registra compras de café, cacao, pasilla, maíz o frijol con múltiples pesadas, merma y comprobante para cada proveedor.');
    return;
  }

  async function load() {
    container.innerHTML = '<div class="panel"><span class="skeleton" style="width:100%;height:120px;"></span></div>';
    let invoices, workday, business, productTypes;
    try {
      [{ invoices }, workday, business, productTypes] = await Promise.all([
        api.invoices(), api.currentWorkday(), api.business(),
        api.productTypes().then((r) => r.productTypes).catch(() => FALLBACK_PRODUCT_TYPES),
      ]);
    } catch (err) {
      container.innerHTML = `<div class="panel"><p class="panel-error">${escapeHtml(err.message)}</p></div>`;
      return;
    }
    container.innerHTML = `
      <div class="panel"><div class="panel-header"><h2>Nueva compra (factura)</h2></div><div id="stepper-root"></div></div>
      <div class="panel"><div class="panel-header"><h2>Jornada actual · ${escapeHtml(workday.code)}</h2>
        <span class="badge badge-real">${workday.status}</span></div>
        ${consolidatedCards(workday.summary)}
        <div class="purchase-actions">
          <a class="btn-ghost" href="#/resumen-dia">Resumen del día</a>
          <button type="button" class="btn-ghost" id="close-workday">Cerrar jornada</button>
        </div>
        <p class="form-error" id="workday-error" role="alert" hidden></p></div>
      <div class="panel"><div class="panel-header"><h2>Historial de facturas</h2></div>
        ${invoices.length ? `<div class="table-scroll"><table class="coop-table"><thead><tr>
          <th>Factura</th><th>Proveedor</th><th>Productos</th><th>Kg pagables</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>${invoices.map(historyRow).join('')}</tbody></table></div>`
          : `<div class="empty-cta"><p class="empty-state">Aún no hay facturas. Registra la primera con el formulario de arriba: proveedor, productos, pesadas, precio y listo.</p>
              <button type="button" class="btn-primary" id="go-new-purchase">Registrar primera compra</button></div>`}
        <p class="form-error" id="history-error" role="alert" hidden></p></div>
      <details class="panel" id="business-panel"><summary>Datos del negocio (salen en el comprobante)</summary>
        <form class="calc-form" id="business-form">
          <div class="field"><label for="b-name">Negocio</label><input id="b-name" name="name" value="${escapeHtml(business.name)}" required /></div>
          <div class="field"><label for="b-nit">NIT</label><input id="b-nit" name="nit" value="${escapeHtml(business.nit)}" /></div>
          <div class="field"><label for="b-addr">Dirección</label><input id="b-addr" name="address" value="${escapeHtml(business.address)}" /></div>
          <div class="field"><label for="b-phone">Teléfono</label><input id="b-phone" name="phone" inputmode="tel" value="${escapeHtml(business.phone)}" /></div>
          <button type="submit" class="btn-primary">Guardar</button>
        </form><p class="form-hint" id="business-msg" role="status"></p></details>`;

    const state = freshState(productTypes);
    const root = container.querySelector('#stepper-root');
    const steps = [stepSupplier, stepProducts, stepPayment, stepConfirm];
    const stepper = mountStepper(root, { steps, state, finishLabel: 'Registrar compra', onFinish: async (s) => { await api.createInvoice(toPayload(s)); await load(); } });
    state.rerender = () => stepper.redraw();

    container.querySelector('#business-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = container.querySelector('#business-msg');
      try { await api.updateBusiness(Object.fromEntries(new FormData(e.target))); msg.textContent = 'Datos guardados'; }
      catch (err) { msg.textContent = err.message; }
    });
    container.querySelector('#close-workday').addEventListener('click', async () => {
      const ok = await askConfirm({ title: `Cerrar la jornada ${workday.code}`, message: 'Las nuevas compras irán a una jornada nueva. Las de esta jornada ya no se podrán modificar.', confirmLabel: 'Cerrar jornada' });
      if (!ok) return;
      try { await api.closeWorkday(workday.id); await load(); }
      catch (err) { const e = container.querySelector('#workday-error'); e.textContent = err.message; e.hidden = false; }
    });

    const goNew = container.querySelector('#go-new-purchase');
    if (goNew) goNew.addEventListener('click', () => { const i = root.querySelector('input'); root.scrollIntoView({ behavior: 'smooth', block: 'start' }); if (i) i.focus({ preventScroll: true }); });

    container.querySelectorAll('[data-void]').forEach((btn) => btn.addEventListener('click', async () => {
      const reason = await askReason({ title: 'Anular factura', message: 'La factura completa (todos sus productos) queda anulada y registrada en la auditoría; no se borra.', label: 'Motivo de la anulación', confirmLabel: 'Anular factura', danger: true });
      if (!reason) return;
      try { await api.voidInvoice(btn.dataset.void, reason); await load(); }
      catch (err) { const e = container.querySelector('#history-error'); e.textContent = err.message; e.hidden = false; }
    }));
  }
  await load();
}
