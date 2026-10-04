const { newDoc, header, keyValues, rule, signatures, cop, kg, pct, dateTime } = require('./pdfCommon');

const PAYMENTS = { efectivo: 'Efectivo', transferencia: 'Transferencia', credito: 'Crédito', otro: 'Otro' };

/**
 * Comprobante de una factura de compra con uno o varios productos. `receipt` viene de
 * receiptService.buildInvoice: nunca contiene costos internos, secado, utilidad ni márgenes.
 */
async function render(receipt) {
  const { doc, done } = newDoc(`Comprobante ${receipt.code}`);
  header(doc, receipt.business, 'Comprobante de compra', receipt.code);
  if (receipt.status === 'ANULADA') {
    doc.fontSize(12).fillColor('#b00020').font('Helvetica-Bold').text('FACTURA ANULADA', { align: 'left' }).fillColor('#000');
    doc.moveDown(0.5);
  }
  keyValues(doc, [
    ['Proveedor', receipt.supplier.name],
    ['Identificación', `${receipt.supplier.idType} ${receipt.supplier.idNumber}`],
    ['Fecha y hora', dateTime(receipt.purchasedAt)],
  ]);

  receipt.lines.forEach((line, i) => {
    // Cada producto es un bloque; si no cabe en la hoja, pasa completo a la siguiente.
    if (doc.y > 600) doc.addPage();
    rule(doc);
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000').text(`${i + 1}. ${line.productLabel}`, 48);
    doc.moveDown(0.3);
    keyValues(doc, [
      ...line.weighings.map((w, n) => [`Pesada ${n + 1} · ${dateTime(w.at)}`, kg(w.pesoKg)]),
      ['Kg recibidos', kg(line.pesoTotalCompra)],
      [`Merma (${pct(line.porcentajeMermaInicial)})`, kg(line.kgDescontados)],
      ['Kg pagables', kg(line.pesoPagable), true],
      ['Precio por carga (125 kg)', cop(line.precioCarga)],
      ['Precio por kg', cop(line.precioKg)],
      ['Subtotal', cop(line.totalCompra), true],
    ]);
  });

  if (doc.y > 640) doc.addPage();
  rule(doc);
  keyValues(doc, [
    ['Productos', String(receipt.totals.productos)],
    ['Kg pagables', kg(receipt.totals.pesoPagable)],
    ['TOTAL PAGADO', cop(receipt.totals.totalCompra), true],
    ['Forma de pago', PAYMENTS[receipt.paymentMethod] || receipt.paymentMethod],
    ['Referencia', receipt.paymentReference],
    ['Observaciones', receipt.notes],
  ]);
  signatures(doc, 'Firma del proveedor', 'Firma de quien recibe');
  doc.end();
  return done;
}

module.exports = { render };
