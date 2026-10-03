const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const LOGO = path.resolve(__dirname, '../../../img/logo-full.png');

const cop = (v) => `$${Math.round(v ?? 0).toLocaleString('es-CO')}`;
const kg = (v) => `${Number(v ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg`;
const pct = (v) => `${Number(v ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 2 })}%`;
const dateTime = (iso) =>
  iso ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(iso)) : '—';

/** Crea el documento y devuelve { doc, done } donde done resuelve con el Buffer final. */
function newDoc(title) {
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: title, Producer: 'AgroValor' } });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  return { doc, done };
}

function header(doc, business, title, code) {
  if (fs.existsSync(LOGO)) {
    try { doc.image(LOGO, 48, 40, { height: 36 }); } catch (e) { /* un logo dañado no debe impedir el comprobante */ }
  }
  doc.fontSize(15).font('Helvetica-Bold').text(business.name || 'Negocio', 48, 40, { align: 'right' });
  doc.fontSize(9).font('Helvetica').fillColor('#444');
  const lines = [business.nit && `NIT ${business.nit}`, business.address, business.phone && `Tel. ${business.phone}`].filter(Boolean);
  lines.forEach((l) => doc.text(l, { align: 'right' }));
  doc.moveDown(1.5).fillColor('#000').fontSize(16).font('Helvetica-Bold').text(title, 48);
  doc.fontSize(11).font('Helvetica').text(code);
  doc.moveDown(0.8);
}

function keyValues(doc, rows) {
  doc.fontSize(10);
  rows.forEach(([k, v, strong]) => {
    const y = doc.y;
    doc.font('Helvetica').fillColor('#555').text(k, 48, y, { width: 200 });
    doc.font(strong ? 'Helvetica-Bold' : 'Helvetica').fillColor('#000').text(String(v ?? '—'), 250, y, { width: 297, align: 'right' });
  });
  doc.moveDown(0.5);
}

function rule(doc) {
  doc.moveTo(48, doc.y).lineTo(547, doc.y).strokeColor('#bbb').lineWidth(0.5).stroke();
  doc.moveDown(0.6);
}

function signatures(doc, left, right) {
  doc.moveDown(3);
  const y = doc.y;
  [[48, left], [320, right]].forEach(([x, label]) => {
    doc.moveTo(x, y).lineTo(x + 200, y).strokeColor('#000').lineWidth(0.5).stroke();
    doc.fontSize(9).fillColor('#000').text(label, x, y + 4, { width: 200, align: 'center' });
  });
}

module.exports = { newDoc, header, keyValues, rule, signatures, cop, kg, pct, dateTime };
