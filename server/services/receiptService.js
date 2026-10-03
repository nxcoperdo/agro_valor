const db = require('../db/connection');
const purchaseService = require('./purchaseService');
const purchaseReceiptPdf = require('./pdf/purchaseReceiptPdf');

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

function updateBusiness(ctx, input) {
  const clean = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim());
  const name = clean(input.name);
  if (!name) throw Object.assign(new Error('El nombre del negocio es obligatorio'), { status: 400 });
  db.prepare('UPDATE businesses SET name = ?, nit = ?, address = ?, phone = ? WHERE id = ?').run(
    name, clean(input.nit), clean(input.address), clean(input.phone), ctx.businessId
  );
  return businessInfo(ctx.businessId);
}

module.exports = { build, pdf, businessInfo, updateBusiness };
