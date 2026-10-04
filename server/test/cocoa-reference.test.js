const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.SQLITE_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'agro-cocoa-')), 'test.sqlite');

const migrate = require('../db/migrate');
const db = require('../db/connection');
const { extractCocoaWeeks, parsePrice, parseWeekEnd } = require('../utils/agronetCocoaExtractor');
const cocoaRepo = require('../repositories/cocoaReferenceRepository');
const cooperativeRepository = require('../repositories/cooperativeRepository');
const cooperativeService = require('../services/cooperativeService');
const priceReportService = require('../services/priceReportService');
const cocoaCalc = require('../services/cocoaNetPriceService');

migrate();

const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'agronet-cacao.html'), 'utf8');

function makeUser(name) {
  const info = db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, 'x', 'user')").run(name);
  return info.lastInsertRowid;
}

test('extractor: caracteres invisibles, semanas que cruzan mes y formatos de precio mezclados', () => {
  const weeks = extractCocoaWeeks(html);
  assert.deepEqual(
    weeks.map((w) => [w.weekEnd, w.priceCopKg]),
    [
      ['2026-10-04', 14826.3],
      ['2026-09-06', 16311.7],
      ['2021-09-05', 8185.3],
      ['2025-01-05', 34900.8],
      ['2024-12-22', 33968.3],
    ]
  );
  assert.equal(weeks[0].weekLabel, '28 al 4 de octubre de 2026');
});

test('extractor: descarta filas sin fecha, sin precio o con precio absurdo', () => {
  const ends = extractCocoaWeeks(html).map((w) => w.weekEnd);
  assert.ok(!ends.includes('2024-12-15'));
  assert.ok(!ends.includes('2024-12-08'));
  assert.equal(extractCocoaWeeks('<html><body>nada</body></html>').length, 0);
});

test('parsePrice y parseWeekEnd', () => {
  assert.equal(parsePrice('$14.826,30/kg'), 14826.3);
  assert.equal(parsePrice('$33.968.30'), 33968.3);
  assert.equal(parsePrice('$8.096'), 8096);
  assert.equal(parseWeekEnd('25 de noviembre al 01 de diciembre de 2024'), '2024-12-01');
  assert.equal(parseWeekEnd('texto cualquiera'), null);
});

test('repositorio: upsertMany es idempotente y corrige un precio cambiado', () => {
  const weeks = extractCocoaWeeks(html);
  cocoaRepo.upsertMany(weeks, 'http://x');
  cocoaRepo.upsertMany(weeks, 'http://x');
  assert.equal(cocoaRepo.history(100).length, 5);
  assert.equal(cocoaRepo.latest().price_cop_kg, 14826.3);

  cocoaRepo.upsertMany([{ ...weeks[0], priceCopKg: 15000 }], 'http://x');
  assert.equal(cocoaRepo.history(100).length, 5);
  assert.equal(cocoaRepo.latest().price_cop_kg, 15000);
});

test('compradores de cacao: sin reportes no hay precio estimado', () => {
  cooperativeRepository.seedFromConfig([{ name: 'Comprador A', region: 'Santander' }, { name: 'Comprador B' }], 'cocoa');

  const cmp = cooperativeService.getComparison('cocoa');
  assert.equal(cmp.market, 'cocoa');
  assert.equal(cmp.cooperatives.length, 2);
  assert.ok(cmp.cooperatives.every((c) => c.priceCopKg === null && c.priceSource === 'none'));
  assert.equal(cmp.reference.priceCopKg, 15000);

  // El café no se mezcla con el cacao.
  assert.equal(cooperativeRepository.findAllActive('coffee').every((c) => c.market === 'coffee'), true);
  assert.equal(cooperativeService.getComparison().market, 'coffee');
});

test('reportes de cacao: validan en COP/kg y con 2 productores el precio pasa a reportado', () => {
  const a = cooperativeRepository.findAllActive('cocoa').find((c) => c.name === 'Comprador A');
  const u1 = makeUser('p1@x.co');
  const u2 = makeUser('p2@x.co');

  assert.throws(() => priceReportService.createReport(u1, { cooperativeId: a.id, priceCopKg: 2300000 }), (e) => e.status === 400);

  priceReportService.createReport(u1, { cooperativeId: a.id, priceCopKg: 16000 });
  assert.equal(cooperativeService.getComparison('cocoa').cooperatives.find((c) => c.id === a.id).priceSource, 'none');

  priceReportService.createReport(u2, { cooperativeId: a.id, priceCopKg: 17000 });
  const reported = cooperativeService.getComparison('cocoa').cooperatives.find((c) => c.id === a.id);
  assert.equal(reported.priceSource, 'reported');
  assert.equal(reported.priceCopKg, 16500);
  assert.equal(reported.rank, 1);
});

test('calculadora de cacao: usa Agronet de base y cae a ICE solo si falta', () => {
  const agronet = cocoaCalc.calculate({ referenceCopPerKg: 15000, iceCopPerKg: 22000, kg: 100 });
  assert.equal(agronet.referenceSource, 'agronet');
  assert.equal(agronet.referenceCopPerKg, 15000);
  assert.equal(agronet.farmgateFactor, null);
  assert.equal(agronet.totalCop, 1500000);

  const fallback = cocoaCalc.calculate({ iceCopPerKg: 20000, kg: 100 });
  assert.equal(fallback.referenceSource, 'ice');
  assert.equal(fallback.referenceCopPerKg, 16000);
});
