const db = require('../db/connection');
const coffeeMath = require('../domain/coffeeMath');
const permissionService = require('./permissionService');
const profitabilityService = require('./profitabilityService');
const processingService = require('./processingService');
const lotRepository = require('../repositories/lotRepository');
const receiptService = require('./receiptService');
const summaryPdf = require('./pdf/summaryPdf');
const sequenceService = require('./sequenceService');

const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TYPES = ['diario', 'semanal', 'mensual', 'proveedor', 'comprador', 'lote', 'factor', 'tipo-cafe', 'jornada', 'ventas', 'rentabilidad'];

/** Rango [from, to] (AAAA-MM-DD) del reporte: explícito o derivado del tipo (hoy, últimos 7 días, mes en curso). */
function range(type, q) {
  const today = sequenceService.today();
  if (q.from || q.to) {
    for (const d of [q.from, q.to].filter(Boolean)) if (!DATE_RE.test(d)) throw fail('Fecha inválida (AAAA-MM-DD)');
    return { from: q.from || '0000-01-01', to: q.to || '9999-12-31' };
  }
  if (type === 'diario') return { from: today, to: today };
  if (type === 'semanal') {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 6);
    return { from: d.toISOString().slice(0, 10), to: today };
  }
  if (type === 'mensual') return { from: `${today.slice(0, 8)}01`, to: today };
  return { from: '0000-01-01', to: '9999-12-31' };
}

const LOCAL_DATE = "date(datetime(p.purchased_at, '-5 hours'))";

/** Agrupa las compras ACTIVAS del periodo por una expresión SQL. */
function purchasesBy(businessId, { from, to }, groupExpr, labelExpr = groupExpr, extraJoin = '') {
  return db.prepare(
    `SELECT ${labelExpr} AS label, COUNT(*) AS compras, COALESCE(SUM(p.peso_total_kg), 0) AS kg_recibidos,
            COALESCE(SUM(p.peso_pagable_kg), 0) AS kg_pagables, COALESCE(SUM(p.total_compra), 0) AS total_pagado,
            COALESCE(AVG(p.precio_carga), 0) AS precio_carga_promedio,
            COALESCE(SUM(p.kg_descontados), 0) AS kg_descontados
     FROM purchases p ${extraJoin}
     WHERE p.business_id = ? AND p.status = 'ACTIVA' AND ${LOCAL_DATE} BETWEEN ? AND ?
     GROUP BY ${groupExpr} ORDER BY total_pagado DESC`
  ).all(businessId, from, to);
}

const mapPurchaseRow = (r) => ({
  label: r.label, compras: r.compras, kgRecibidos: coffeeMath.roundKg(r.kg_recibidos), kgPagables: coffeeMath.roundKg(r.kg_pagables),
  totalPagado: r.total_pagado, precioCargaPromedio: Math.round(r.precio_carga_promedio),
  mermaPromedio: r.kg_recibidos > 0 ? coffeeMath.roundKg((r.kg_descontados / r.kg_recibidos) * 100) : 0,
});

const COFFEE_LABEL = { cafe_verde: 'Café verde', cafe_merma_5: 'Café con merma 5%', cafe_sin_merma: 'Café sin merma', otro: 'Otro' };

function build(ctx, type, q = {}) {
  if (!TYPES.includes(type)) throw fail('Tipo de reporte inválido', 404);
  const r = range(type, q);
  const b = ctx.businessId;
  const canCost = permissionService.can(ctx.role, 'ver_costos');
  let columns;
  let rows;

  if (['diario', 'semanal', 'mensual'].includes(type)) {
    columns = ['Fecha', 'Compras', 'Kg recibidos', 'Kg pagables', 'Total pagado'];
    rows = purchasesBy(b, r, LOCAL_DATE).map(mapPurchaseRow).sort((x, y) => (x.label < y.label ? -1 : 1));
  } else if (type === 'proveedor') {
    columns = ['Proveedor', 'Compras', 'Kg recibidos', 'Kg pagables', 'Precio carga promedio', 'Total pagado', 'Rendimiento de lotes'];
    rows = purchasesBy(b, r, 'p.supplier_id', 's.name', 'JOIN suppliers s ON s.id = p.supplier_id').map(mapPurchaseRow);
    const bySupplier = db.prepare(
      `SELECT s.name AS label, p.supplier_id AS sid, p.lot_id FROM purchases p JOIN suppliers s ON s.id = p.supplier_id
       WHERE p.business_id = ? AND p.status = 'ACTIVA' AND p.lot_id IS NOT NULL AND ${LOCAL_DATE} BETWEEN ? AND ?`
    ).all(b, r.from, r.to);
    rows.forEach((row) => {
      const lotIds = [...new Set(bySupplier.filter((x) => x.label === row.label).map((x) => x.lot_id))];
      const vals = lotIds.map((id) => processingService.realResult(ctx, id)).filter(Boolean).map((x) => x.rendimientoReal).filter((v) => v != null);
      row.rendimientoLotes = vals.length ? coffeeMath.roundKg(vals.reduce((a, v) => a + v, 0) / vals.length) : null;
    });
  } else if (type === 'comprador') {
    columns = ['Comprador', 'Compras', 'Kg recibidos', 'Kg pagables', 'Total pagado'];
    rows = purchasesBy(b, r, 'p.created_by', "COALESCE(u.full_name, u.username, 'Sin usuario')", 'LEFT JOIN users u ON u.id = p.created_by').map(mapPurchaseRow);
  } else if (type === 'tipo-cafe') {
    columns = ['Tipo de café', 'Compras', 'Kg recibidos', 'Kg pagables', 'Merma promedio', 'Total pagado'];
    rows = purchasesBy(b, r, 'p.coffee_type').map((x) => ({ ...mapPurchaseRow(x), label: COFFEE_LABEL[x.label] || x.label }));
  } else if (type === 'jornada') {
    columns = ['Jornada', 'Compras', 'Kg recibidos', 'Kg pagables', 'Total pagado'];
    rows = purchasesBy(b, r, 'p.workday_id', "COALESCE(w.code, 'Sin jornada')", 'LEFT JOIN purchase_workdays w ON w.id = p.workday_id').map(mapPurchaseRow);
  } else if (type === 'lote') {
    columns = ['Lote', 'Estado', 'Compra original', 'Proyección (kg secos)', 'Resultado real (kg secos)', 'Inventario (kg)', 'Vendidos (kg)'];
    rows = lotRepository.list(b).map((l) => {
      const base = processingService.purchaseBase(ctx, l.id);
      const cmp = processingService.compareProjectedVsReal(ctx, l.id);
      const get = (k) => cmp.filas.find((f) => f.key === k);
      const inv = db.prepare('SELECT * FROM inventory_lots WHERE lot_id = ?').get(l.id);
      const row = {
        label: l.code, estado: l.status, compraOriginal: base.totalCompra, pesoPagable: base.pesoPagable,
        proyeccionKgSecos: get('kilosSecos').proyectado, realKgSecos: get('kilosSecos').real,
        inventarioKg: inv ? coffeeMath.roundKg(inv.kg_initial - inv.kg_sold) : 0, vendidosKg: inv ? inv.kg_sold : 0,
      };
      if (canCost) row.costoRealTotal = get('costoTotal').real;
      if (permissionService.can(ctx.role, 'ver_rentabilidad')) row.utilidadRealizada = profitabilityService.byLot(ctx, l.id).utilidadRealizada;
      return row;
    });
  } else if (type === 'factor') {
    columns = ['Factor', 'Ventas', 'Kg vendidos', 'Precio promedio por kg', 'Ingreso'];
    rows = db.prepare(
      `SELECT it.factor AS label, COUNT(*) AS ventas, SUM(it.kg) AS kg, SUM(it.subtotal) AS ingreso FROM trade_sale_items it
       JOIN trade_sales s ON s.id = it.sale_id WHERE s.business_id = ? AND s.status = 'ACTIVA' AND s.sold_on BETWEEN ? AND ?
       GROUP BY it.factor ORDER BY it.factor`
    ).all(b, r.from, r.to).map((x) => ({ label: x.label == null ? 'Sin factor' : `Factor ${x.label}`, ventas: x.ventas, kgVendidos: coffeeMath.roundKg(x.kg), precioPromedioKg: Math.round(x.ingreso / x.kg), ingreso: x.ingreso }));
  } else if (type === 'ventas') {
    columns = ['Venta', 'Fecha', 'Cliente', 'Kg', 'Total', 'Estado'];
    rows = db.prepare(
      `SELECT s.code, s.sold_on, c.name AS customer, s.total, s.status, COALESCE((SELECT SUM(kg) FROM trade_sale_items WHERE sale_id = s.id), 0) AS kg
       FROM trade_sales s JOIN customers c ON c.id = s.customer_id WHERE s.business_id = ? AND s.sold_on BETWEEN ? AND ? ORDER BY s.id DESC`
    ).all(b, r.from, r.to).map((x) => ({ label: x.code, fecha: x.sold_on, cliente: x.customer, kg: coffeeMath.roundKg(x.kg), total: x.total, estado: x.status }));
  } else {
    permissionService.assert(ctx.role, 'ver_rentabilidad');
    columns = ['Lote', 'Inversión', 'Costos', 'Ventas', 'Utilidad realizada', 'Utilidad pendiente', 'Margen'];
    rows = profitabilityService.lots(ctx).map((l) => ({ label: l.lot.code, inversion: l.inversion, costos: l.costos, ventas: l.ventas, utilidadRealizada: l.utilidadRealizada, utilidadPendiente: l.utilidadPendiente, margen: l.margen }));
  }
  return { type, from: r.from, to: r.to, columns, rows };
}

const TITLES = { diario: 'Reporte diario', semanal: 'Reporte semanal', mensual: 'Reporte mensual', proveedor: 'Reporte por proveedor', comprador: 'Reporte por comprador', lote: 'Reporte de lotes', factor: 'Reporte por factor', 'tipo-cafe': 'Reporte por tipo de café', jornada: 'Reporte por jornada', ventas: 'Reporte de ventas', rentabilidad: 'Reporte de rentabilidad' };

async function pdf(ctx, type, q) {
  const rep = build(ctx, type, q);
  const { newDoc, header, rule } = require('./pdf/pdfCommon');
  const { doc, done } = newDoc(TITLES[type]);
  header(doc, receiptService.businessInfo(ctx.businessId), TITLES[type], `${rep.from === '0000-01-01' ? 'Inicio' : rep.from} a ${rep.to === '9999-12-31' ? 'hoy' : rep.to}`);
  rule(doc);
  if (!rep.rows.length) doc.fontSize(10).text('Sin datos para el periodo.');
  rep.rows.forEach((row) => {
    doc.fontSize(10).font('Helvetica-Bold').text(String(row.label ?? '—'));
    doc.font('Helvetica').fillColor('#444').fontSize(9);
    Object.entries(row).filter(([k, v]) => k !== 'label' && v != null).forEach(([k, v]) => doc.text(`${k.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${typeof v === 'number' ? v.toLocaleString('es-CO') : v}`, { indent: 10 }));
    doc.fillColor('#000').moveDown(0.5);
    if (doc.y > 740) doc.addPage();
  });
  doc.end();
  return done;
}

module.exports = { build, pdf, TYPES, TITLES };
