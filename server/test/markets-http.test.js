const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.SQLITE_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'agro-mkt-')), 'http.sqlite');
const bootstrap = require('../db/bootstrap');
const priceRepo = require('../repositories/coffeePriceRepository');
const forecastRepo = require('../repositories/forecastRepository');
const exchangeRateRepository = require('../repositories/exchangeRateRepository');
const createApp = require('../app');

let server;
let base;
let cookie;

test.before(async () => {
  bootstrap();
  priceRepo.insert({ price: 300, source: 'real' });
  priceRepo.insert({ price: 5000, unit: 'usd_per_tonne', source: 'real', market: 'cocoa', meta: { previousClose: 4900 } });
  exchangeRateRepository.insert({ rate: 4000, source: 'real' });
  forecastRepo.replaceAll(
    [1, 2].map((step) => ({
      granularity: 'day',
      step,
      predictedPrice: 5100,
      lowPrice: 4800,
      highPrice: 5400,
      predictedForDate: '2026-10-05',
      modelParams: { method: 'futures-curve' },
    })),
    'cocoa'
  );

  const app = createApp();
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;

  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'changeme123' }),
  });
  cookie = res.headers.get('set-cookie').split(';')[0];
});
test.after(() => server.close());

const get = async (url) => {
  const res = await fetch(`${base}/api${url}`, { headers: { cookie } });
  return { status: res.status, body: await res.json() };
};
const post = async (url, body) => {
  const res = await fetch(`${base}/api${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

test('precio: sin parámetro es café; cacao devuelve USD/t y COP/kg; mercado inválido → 400', async () => {
  const coffee = await get('/prices/current');
  assert.equal(coffee.body.market, 'coffee');
  assert.equal(coffee.body.international.centsPerLb, 300);

  const cocoa = await get('/prices/current?market=cocoa');
  assert.equal(cocoa.status, 200);
  assert.equal(cocoa.body.market, 'cocoa');
  assert.equal(cocoa.body.international.usdPerTonne, 5000);
  assert.equal(cocoa.body.international.copPerKg, 20000);
  assert.equal(cocoa.body.internal, null);

  assert.equal((await get('/prices/current?market=frijol')).status, 400);
  assert.equal((await get('/prices/history?market=frijol')).status, 400);
});

test('histórico de cacao va en USD/tonelada', async () => {
  const history = await get('/prices/history?days=7&market=cocoa');
  assert.equal(history.body.length, 1);
  assert.equal(history.body[0].usdPerTonne, 5000);
  assert.equal(history.body[0].centsPerLb, undefined);
});

test('proyección de cacao en COP/kg con rango; mercado inválido → 400', async () => {
  const f = await get('/forecast?market=cocoa');
  assert.equal(f.status, 200);
  assert.equal(f.body.market, 'cocoa');
  assert.equal(f.body.daily[0].copPerKg, 20400);
  assert.equal(f.body.daily[0].lowCopPerKg, 19200);
  assert.equal(f.body.daily[0].highCopPerKg, 21600);
  assert.equal(f.body.currentCopPerKg, 20000);
  assert.equal((await get('/forecast?market=frijol')).status, 400);
});

test('calculadora de cacao por HTTP', async () => {
  const r = await post('/calculator/cocoa', { kg: 100, humidity: 7, defectPct: 0, transportCostCopKg: 0 });
  assert.equal(r.status, 200);
  assert.equal(r.body.referenceCopPerKg, 16000);
  assert.equal(r.body.totalCop, 1600000);
});

test('alertas de cacao: solo precio y con mercado guardado', async () => {
  const bad = await post('/alerts', { type: 'daily', market: 'cocoa' });
  assert.equal(bad.status, 400);
  const invalid = await post('/alerts', { type: 'above', market: 'frijol', thresholdCopCarga: 20000 });
  assert.equal(invalid.status, 400);
});

test('compradores de cacao por HTTP: semilla, sin estimaciones, mercado inválido → 400, café intacto', async () => {
  const cocoa = await get('/cooperatives?market=cocoa');
  assert.equal(cocoa.status, 200);
  assert.equal(cocoa.body.market, 'cocoa');
  assert.ok(cocoa.body.cooperatives.length >= 2);
  assert.ok(cocoa.body.cooperatives.every((c) => c.priceSource === 'none' && c.priceCopKg === null));

  assert.equal((await get('/cooperatives?market=frijol')).status, 400);

  const coffee = await get('/cooperatives');
  assert.equal(coffee.body.market, 'coffee');
  assert.ok(coffee.body.cooperatives.every((c) => c.estimatedPriceCopCarga === undefined || c.differentialPct !== undefined));
  assert.ok(!coffee.body.cooperatives.some((c) => c.name === 'Casa Luker'));
});

test('reporte de cacao por HTTP: rechaza un precio por carga y acepta uno por kilo', async () => {
  const { body } = await get('/cooperatives?market=cocoa');
  const buyer = body.cooperatives[0];

  const tooHigh = await post('/reports', { cooperativeId: buyer.id, priceCopKg: 2300000 });
  assert.equal(tooHigh.status, 400);
  assert.match(tooHigh.body.error, /por kilo/);

  const ok = await post('/reports', { cooperativeId: buyer.id, priceCopKg: 16000 });
  assert.equal(ok.status, 201);
});

test('admin crea un comprador de cacao y no aparece en café', async () => {
  const created = await post('/admin/cooperatives', { name: 'Cooperativa Cacaotera Test', market: 'cocoa', region: 'Arauca' });
  assert.equal(created.status, 201);
  assert.equal(created.body.cooperative.market, 'cocoa');

  const bad = await post('/admin/cooperatives', { name: 'X', market: 'frijol' });
  assert.equal(bad.status, 400);

  const coffee = await get('/cooperatives');
  assert.ok(!coffee.body.cooperatives.some((c) => c.name === 'Cooperativa Cacaotera Test'));
  const cocoa = await get('/cooperatives?market=cocoa');
  assert.ok(cocoa.body.cooperatives.some((c) => c.name === 'Cooperativa Cacaotera Test'));
});
