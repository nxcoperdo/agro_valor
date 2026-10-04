const db = require('../db/connection');
const purchaseService = require('./purchaseService');
const invoiceService = require('./invoiceService');
const purchaseReceiptPdf = require('./pdf/purchaseReceiptPdf');
const invoiceReceiptPdf = require('./pdf/invoiceReceiptPdf');

function businessInfo(businessId) {
  const b = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  return { name: b.name, nit: b.nit, address: b.address, phone: b.phone };
}

/**
 * Datos del comprobante del proveedor. Se arma campo por campo (lista blanca) para que nada
 * interno —costos, secado, utilidad, margen, precio mínimo— pueda llegar al documento.
 */
function build(ctx, purchaseId) {
  const p = purchaseService.get(ctx, purchaseId);
  return {
    code: p.receiptCode,
    status: p.status,
    business: businessInfo(ctx.businessId),
    supplier: { name: p.supplier.name, idType: p.supplier.idType, idNumber: p.supplier.idNumber },
    purchasedAt: p.purchasedAt,
    coffeeType: p.coffeeType,
    productLabel: p.productLabel,
    weighings: p.weighings.map((w) => ({ pesoKg: w.pesoKg, at: w.at })),
    pesoTotalCompra: p.pesoTotalCompra,
    porcentajeMermaInicial: p.porcentajeMermaInicial,
    kgDescontados: p.kgDescontados,
    pesoPagable: p.pesoPagable,
    precioCarga: p.precioCarga,
    precioKg: p.precioKg,
    totalCompra: p.totalCompra,
    paymentMethod: p.paymentMethod,
    paymentReference: p.paymentReference,
    notes: p.notes,
  };
}

const pdf = (ctx, purchaseId) => purchaseReceiptPdf.render(build(ctx, purchaseId));

/**
 * Comprobante de la factura completa (uno o varios productos). Lista blanca igual que `build`: por
 * producto solo lo que se le entrega al proveedor, sin costos, secado, proyección ni márgenes.
 */
function buildInvoice(ctx, invoiceId) {
  const inv = invoiceService.get(ctx, invoiceId);
  const lines = inv.lines.map((p) => ({
    code: p.receiptCode,
    productLabel: p.productLabel,
    weighings: p.weighings.map((w) => ({ pesoKg: w.pesoKg, at: w.at })),
    pesoTotalCompra: p.pesoTotalCompra,
    porcentajeMermaInicial: p.porcentajeMermaInicial,
    kgDescontados: p.kgDescontados,
    pesoPagable: p.pesoPagable,
    precioCarga: p.precioCarga,
    precioKg: p.precioKg,
    totalCompra: p.totalCompra,
  }));
  const sum = (key) => lines.reduce((a, l) => a + l[key], 0);
  return {
    code: inv.code,
    status: inv.status,
    business: businessInfo(ctx.businessId),
    supplier: { name: inv.supplier.name, idType: inv.supplier.idType, idNumber: inv.supplier.idNumber },
    purchasedAt: inv.purchasedAt,
    paymentMethod: inv.paymentMethod,
    paymentReference: inv.paymentReference,
    notes: inv.notes,
    lines,
    // Una factura anulada conserva sus cifras en el comprobante (con la marca ANULADA).
    totals: { productos: lines.length, pesoPagable: Math.round(sum('pesoPagable') * 100) / 100, totalCompra: sum('totalCompra') },
  };
}

const invoicePdf = (ctx, invoiceId) => invoiceReceiptPdf.render(buildInvoice(ctx, invoiceId));

function updateBusiness(ctx, input) {
  const clean = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim());
  const name = clean(input.name);
  if (!name) throw Object.assign(new Error('El nombre del negocio es obligatorio'), { status: 400 });
  db.prepare('UPDATE businesses SET name = ?, nit = ?, address = ?, phone = ? WHERE id = ?').run(
    name, clean(input.nit), clean(input.address), clean(input.phone), ctx.businessId
  );
  return businessInfo(ctx.businessId);
}

module.exports = { build, pdf, buildInvoice, invoicePdf, businessInfo, updateBusiness };
