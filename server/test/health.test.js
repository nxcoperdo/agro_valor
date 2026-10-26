const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.SQLITE_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'agro-health-')), 'h.sqlite');
const bootstrap = require('../db/bootstrap');
const db = require('../db/connection');
const priceRepo = require('../repositories/coffeePriceRepository');
const healthService = require('../services/healthService');
const createApp = require('../app');

let server;
let base;

test.before(async () => {
  bootstrap();
  server = await new Promise((resolve) => {
    const s = createApp().listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

test('sin datos de mercado el servicio responde 200 pero "degraded"', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.database, true);
  assert.equal(body.status, 'degraded');
  assert.ok(body.sources.every((s) => s.stale));
});

test('con el precio recién consultado el café no figura como desactualizado', () => {
  priceRepo.insert({ price: 300, source: 'real' });
  const coffee = healthService.check().sources.find((s) => s.label === 'Precio del café');
  assert.equal(coffee.stale, false);
  assert.ok(coffee.ageHours < 1);
});

test('un precio de hace cuatro días figura como desactualizado', () => {
  db.prepare("UPDATE coffee_prices SET fetched_at = datetime('now', '-4 days') WHERE market = 'coffee'").run();
  const coffee = healthService.check().sources.find((s) => s.label === 'Precio del café');
  assert.equal(coffee.stale, true);
  assert.ok(coffee.ageHours > 90);
});

test('no exige sesión y no expone datos de usuarios', async () => {
  const res = await fetch(`${base}/api/health`);
  const text = JSON.stringify(await res.json());
  assert.ok(!/username|email|token/i.test(text));
});
