const { newDoc, header, keyValues, rule, signatures, cop, kg } = require('./pdfCommon');

const PAYMENTS = { efectivo: 'Efectivo', transferencia: 'Transferencia', credito: 'Crédito', otro: 'Otro' };

/** Comprobante de venta: cliente, fecha, lote, kg, factor, precio, total y forma de pago. Sin costos ni utilidad. */
async function render(sale) {
  const { doc, done } = newDoc(`Comprobante ${sale.code}`);
  header(doc, sale.business, 'Comprobante de venta de café', sale.code);
  if (sale.status === 'ANULADA') doc.fontSize(12).fillColor('#b00020').font('Helvetica-Bold').text('VENTA ANULADA').fillColor('#000').moveDown(0.5);
  keyValues(doc, [
    ['Cliente', sale.customer.name],
    ['Identificación', `${sale.customer.idType} ${sale.customer.idNumber}`],
    ['Fecha', sale.soldOn],
  ]);
  rule(doc);
  sale.items.forEach((it) => {
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000').text(`Lote ${it.lotCode}`);
    doc.moveDown(0.2);
    keyValues(doc, [
      ['Kg vendidos', kg(it.kg)],
      ['Factor', it.factor != null ? `Factor ${it.factor}` : null],
      ['Precio por kg', cop(it.precioKg)],
      ['Precio por carga (125 kg)', cop(it.precioCarga)],
      ['Subtotal', cop(it.subtotal), true],
    ]);
    rule(doc);
  });
  keyValues(doc, [
    ['TOTAL', cop(sale.total), true],
    ['Forma de pago', PAYMENTS[sale.paymentMethod] || sale.paymentMethod],
    ['Referencia', sale.paymentReference],
    ['Observaciones', sale.notes],
  ]);
  signatures(doc, 'Firma del cliente', 'Firma del vendedor');
  doc.end();
  return done;
}

module.exports = { render };
