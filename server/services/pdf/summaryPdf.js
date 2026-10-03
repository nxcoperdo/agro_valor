const { newDoc, header, keyValues, rule, cop, kg, pct } = require('./pdfCommon');

/** Resumen consolidado (día, jornada o periodo). `costosInternos` solo aparece si el rol puede verlo. */
async function render({ business, title, subtitle, summary }) {
  const { doc, done } = newDoc(title);
  header(doc, business, title, subtitle);
  rule(doc);
  const rows = [
    ['Compras', summary.compras],
    ['Proveedores', summary.proveedores],
    ['Pesadas', summary.pesadas],
    ['Kg recibidos', kg(summary.kgRecibidos)],
    ['Kg pagables', kg(summary.kgPagables), true],
    ['Kg descontados', kg(summary.kgDescontados)],
    ['Total pagado', cop(summary.totalPagado), true],
    ...(summary.costosInternos != null ? [['Costos internos', cop(summary.costosInternos)]] : []),
    ['Kg secos proyectados', kg(summary.kgSecosProyectados)],
    ['Precio promedio por carga', cop(summary.precioCargaPromedio)],
    ['Merma promedio', pct(summary.mermaPromedio)],
  ];
  keyValues(doc, rows);
  doc.end();
  return done;
}

module.exports = { render };
