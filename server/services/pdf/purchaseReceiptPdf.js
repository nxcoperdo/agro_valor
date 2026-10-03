const { newDoc, header, keyValues, rule, signatures, cop, kg, pct, dateTime } = require('./pdfCommon');

const COFFEE_TYPES = { cafe_verde: 'Café verde', cafe_merma_5: 'Café con merma 5%', cafe_sin_merma: 'Café sin merma', otro: 'Otro' };
const PAYMENTS = { efectivo: 'Efectivo', transferencia: 'Transferencia', credito: 'Crédito', otro: 'Otro' };

/** `receipt` viene de receiptService.build: nunca contiene costos internos, secado, utilidad ni márgenes. */
async function render(receipt) {
  const { doc, done } = newDoc(`Comprobante ${receipt.code}`);
  header(doc, receipt.business, 'Comprobante de compra de café', receipt.code);
  if (receipt.status === 'ANULADA') {
    doc.fontSize(12).fillColor('#b00020').font('Helvetica-Bold').text('COMPRA ANULADA', { align: 'left' }).fillColor('#000');
    doc.moveDown(0.5);
  }
  keyValues(doc, [
    ['Proveedor', receipt.supplier.name],
    ['Identificación', `${receipt.supplier.idType} ${receipt.supplier.idNumber}`],
    ['Fecha y hora', dateTime(receipt.purchasedAt)],
    ['Tipo de café', COFFEE_TYPES[receipt.coffeeType] || receipt.coffeeType],
  ]);
  rule(doc);
  doc.fontSize(11).font('Helvetica-Bold').text('Pesadas');
  doc.moveDown(0.3);
  keyValues(doc, receipt.weighings.map((w, i) => [`Pesada ${i + 1} · ${dateTime(w.at)}`, kg(w.pesoKg)]));
  rule(doc);
  keyValues(doc, [
    ['Kg recibidos', kg(receipt.pesoTotalCompra)],
    [`Merma (${pct(receipt.porcentajeMermaInicial)})`, kg(receipt.kgDescontados)],
    ['Kg pagables', kg(receipt.pesoPagable), true],
    ['Precio por carga (125 kg)', cop(receipt.precioCarga)],
    ['Precio por kg', cop(receipt.precioKg)],
    ['TOTAL PAGADO', cop(receipt.totalCompra), true],
    ['Forma de pago', PAYMENTS[receipt.paymentMethod] || receipt.paymentMethod],
    ['Referencia', receipt.paymentReference],
    ['Observaciones', receipt.notes],
  ]);
  signatures(doc, 'Firma del proveedor', 'Firma de quien recibe');
  doc.end();
  return done;
}

module.exports = { render };
