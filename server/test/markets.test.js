const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agro-markets-'));
process.env.SQLITE_DB_PATH = path.join(dir, 'test.sqlite');

const migrate = require('../db/migrate');
const db = require('../db/connection');
const markets = require('../config/markets');
const priceRepo = require('../repositories/coffeePriceRepository');
const forecastRepo = require('../repositories/forecastRepository');
const alertRepo = require('../repositories/alertRepository');
const cocoaCalc = require('../services/cocoaNetPriceService');
const summaryService = require('../services/marketSummaryService');
const exchangeRateRepository = require('../repositories/exchangeRateRepository');

migrate();

test('config: café es el valor por defecto y un mercado inválido se rechaza con 400', () => {
  assert.equal(markets.DEFAULT_MARKET, 'coffee');
  assert.equal(markets.getMarket().id, 'coffee');
  assert.ok(markets.isValidMarket('cocoa'));
  assert.equal(markets.isValidMarket('frijol'), false);
  assert.throws(() => markets.getMarket('frijol'), (e) => e.status === 400);
});

test('conversión del cacao: USD/t × TRM ÷ 1000 = COP/kg', () => {
  assert.equal(markets.cocoaUsdPerTonneToCopKg(5000, 4000), 20000);
});

test('migración: market existe con café por defecto y es idempotente', () => {
  migrate();
  for (const table of ['coffee_prices', 'forecast_cache', 'alerts']) {
    const col = db.prepare(`PRAGMA table_info(${table})`).all().find((c) => c.name === 'market');
    assert.ok(col, `falta market en ${table}`);
    assert.equal(col.dflt_value, "'coffee'");
  }
});

test('precios: cada mercado ve solo sus filas y el café sigue siendo el default', () => {
  priceRepo.insert({ price: 300, source: 'real' });
  priceRepo.insert({ price: 5600, unit: 'usd_per_tonne', source: 'real', market: 'cocoa' });

  assert.equal(priceRepo.latest().price, 300);
  assert.equal(priceRepo.latest('cocoa').price, 5600);
  assert.equal(priceRepo.history(30).length, 1);
  assert.equal(priceRepo.history(30, 'cocoa').length, 1);
  assert.equal(priceRepo.dailySeries(30, 'cocoa')[0].price, 5600);
});

test('proyección: reemplazar un mercado no borra el otro', () => {
  const row = (price) => ({
    granularity: 'day',
    step: 1,
    predictedPrice: price,
    lowPrice: price - 1,
    highPrice: price + 1,
    predictedForDate: '2026-10-04',
    modelParams: { method: 'futures-curve' },
  });
  forecastRepo.replaceAll([row(310)], 'coffee');
  forecastRepo.replaceAll([row(5700)], 'cocoa');
  forecastRepo.replaceAll([row(320)], 'coffee');

  assert.equal(forecastRepo.latestAll('coffee').length, 1);
  assert.equal(forecastRepo.latestAll('coffee')[0].predicted_price, 320);
  assert.equal(forecastRepo.latestAll('cocoa')[0].predicted_price, 5700);
});

test('resumen de cacao: sin precio interno, con COP/kg desde la TRM', () => {
  exchangeRateRepository.insert({ rate: 4000, source: 'real' });
  const summary = summaryService.getMarketSummary('cocoa');
  assert.equal(summary.market, 'cocoa');
  assert.equal(summary.internal, null);
  assert.equal(summary.international.usdPerTonne, 5600);
  assert.equal(summary.international.copPerKg, 22400);
  assert.equal(summaryService.getMarketSummary().market, 'coffee');
});

test('alertas: se guardan con su mercado y los resúmenes solo buscan las de café', () => {
  const info = db.prepare("INSERT INTO users (username, password_hash, role, phone) VALUES ('u@x.co', 'x', 'user', '3000000000')").run();
  const userId = info.lastInsertRowid;
  alertRepo.create({ userId, type: 'above', thresholdCopCarga: 20000, market: 'cocoa' });
  alertRepo.create({ userId, type: 'daily' });

  assert.equal(alertRepo.findByUser(userId).filter((a) => a.market === 'cocoa').length, 1);
  assert.equal(alertRepo.findActiveByTypes(['above'], 'cocoa').length, 1);
  assert.equal(alertRepo.findActiveByTypes(['above']).length, 0);
  assert.equal(alertRepo.findActiveByTypes(['daily']).length, 1);
});

test('calculadora de cacao: ajustes por humedad, defecto, fermentación, descuento y transporte', () => {
  const base = cocoaCalc.calculate({ iceCopPerKg: 20000, kg: 100 });
  assert.equal(base.referenceCopPerKg, 16000);
  assert.equal(base.netCopPerKg, 16000);
  assert.equal(base.totalCop, 1600000);

  const wet = cocoaCalc.calculate({ iceCopPerKg: 20000, humidity: 10 });
  assert.ok(wet.netCopPerKg < base.netCopPerKg);

  const unfermented = cocoaCalc.calculate({ iceCopPerKg: 20000, fermented: false });
  assert.equal(unfermented.netCopPerKg, 16000 * 0.9);

  const full = cocoaCalc.calculate({ iceCopPerKg: 20000, defectPct: 10, buyerDiscountPct: 10, transportCostCopKg: 500 });
  assert.equal(Math.round(full.netCopPerKg), Math.round(16000 * 0.9 * 0.9 - 500));

  assert.throws(() => cocoaCalc.calculate({ iceCopPerKg: 0 }), (e) => e.status === 400);
});
