const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

process.env.SQLITE_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'agro-pro-')), 'pro.sqlite');
const bootstrap = require('../db/bootstrap');
const db = require('../db/connection');
const priceRepo = require('../repositories/coffeePriceRepository');
const forecastRepo = require('../repositories/forecastRepository');
const exchangeRateRepository = require('../repositories/exchangeRateRepository');
const alertRepository = require('../repositories/alertRepository');
const alertService = require('../services/alertService');
const createApp = require('../app');

let server;
let base;
const cookies = {};

function makeUser(username, { plan = 'free', planExpiresAt = null } = {}) {
  const info = db
    .prepare("INSERT INTO users (username, password_hash, role, plan, plan_expires_at, phone) VALUES (?, ?, 'user', ?, ?, '3001112233')")
    .run(username, bcrypt.hashSync('secreto123', 4), plan, planExpiresAt);
  return Number(info.lastInsertRowid);
}

async function login(username, password) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(res.status, 200, `login ${username}`);
  return res.headers.get('set-cookie').split(';')[0];
}

test.before(async () => {
  bootstrap();
  priceRepo.insert({ price: 300, source: 'real' });
  priceRepo.insert({ price: 5000, unit: 'usd_per_tonne', source: 'real', market: 'cocoa' });
  exchangeRateRepository.insert({ rate: 4000, source: 'real' });
  ['coffee', 'cocoa'].forEach((market) =>
    forecastRepo.replaceAll(
      ['day', 'week', 'month'].flatMap((granularity) =>
        [1, 2].map((step) => ({
          granularity,
          step,
          predictedPrice: 310,
          lowPrice: 300,
          highPrice: 320,
          predictedForDate: '2026-10-05',
          modelParams: { method: 'futures-curve' },
        }))
      ),
      market
    )
  );

  makeUser('gratis@x.co');
  makeUser('vencido@x.co', { plan: 'pro', planExpiresAt: '2020-01-01 00:00:00' });
  makeUser('pro@x.co', { plan: 'pro' });

  server = await new Promise((resolve) => {
    const s = createApp().listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
  cookies.free = await login('gratis@x.co', 'secreto123');
  cookies.expired = await login('vencido@x.co', 'secreto123');
  cookies.pro = await login('pro@x.co', 'secreto123');
});
test.after(() => server.close());

const call = async (who, method, url, body) => {
  const res = await fetch(`${base}/api${url}`, {
    method,
    headers: { 'content-type': 'application/json', cookie: cookies[who] },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

// Cada fila es la misma función en café y en cacao: [nombre, café..., cacao...].
const PRO_ONLY = [
  ['calculadora', 'POST', '/calculator', { cargas: 1 }, 'POST', '/calculator/cocoa', { kg: 10 }],
  [
    'alertas',
    'POST', '/alerts', { type: 'above', thresholdCopCarga: 2000000 },
    'POST', '/alerts', { type: 'above', market: 'cocoa', thresholdCopCarga: 20000 },
  ],
  ['compra de producto', 'GET', '/coffee/purchases', null, 'GET', '/coffee/product-types', null],
  [
    'compra de cacao',
    'POST', '/coffee/purchases', { productType: 'cafe', precioKg: 1, weighings: [1] },
    'POST', '/coffee/purchases', { productType: 'cacao', precioKg: 1, weighings: [1] },
  ],
];

test('plan gratis: lo exclusivo de Pro responde 402 igual en cacao que en café', async () => {
  for (const [name, m1, u1, b1, m2, u2, b2] of PRO_ONLY) {
    const coffee = await call('free', m1, u1, b1);
    const cocoa = await call('free', m2, u2, b2);
    assert.equal(coffee.status, 402, `${name} (café)`);
    assert.equal(cocoa.status, 402, `${name} (cacao)`);
    assert.equal(cocoa.body.upgradeRequired, true, name);
  }
});

test('plan Pro vencido se trata como gratis también en cacao', async () => {
  assert.equal((await call('expired', 'POST', '/calculator/cocoa', { kg: 10 })).status, 402);
  assert.equal(
    (await call('expired', 'POST', '/alerts', { type: 'above', market: 'cocoa', thresholdCopCarga: 20000 })).status,
    402
  );
  const f = await call('expired', 'GET', '/forecast?market=cocoa');
  assert.equal(f.body.isPro, false);
});

test('plan gratis: precio, histórico y compradores de cacao son gratis, como en café', async () => {
  for (const url of ['/prices/current', '/prices/history?days=7', '/cooperatives']) {
    const sep = url.includes('?') ? '&' : '?';
    assert.equal((await call('free', 'GET', url)).status, 200, `café ${url}`);
    assert.equal((await call('free', 'GET', `${url}${sep}market=cocoa`)).status, 200, `cacao ${url}`);
  }
});

test('plan gratis: la proyección de cacao muestra solo mañana y bloquea semana y mes, igual que café', async () => {
  for (const market of ['coffee', 'cocoa']) {
    const { status, body } = await call('free', 'GET', `/forecast?market=${market}`);
    assert.equal(status, 200, market);
    assert.equal(body.isPro, false, market);
    assert.equal(body.daily.length, 1, market);
    assert.deepEqual(body.weekly, [], market);
    assert.deepEqual(body.monthly, [], market);
    assert.ok(body.locked.dailyCount > 0 && body.locked.weeklyCount > 0 && body.locked.monthlyCount > 0, market);
  }
});

test('plan Pro: todo lo anterior queda abierto en cacao', async () => {
  assert.equal((await call('pro', 'POST', '/calculator/cocoa', { kg: 10 })).status, 200);
  assert.equal((await call('pro', 'GET', '/coffee/product-types')).status, 200);
  const f = await call('pro', 'GET', '/forecast?market=cocoa');
  assert.equal(f.body.isPro, true);
  assert.ok(f.body.daily.length > 1 && f.body.weekly.length > 0 && f.body.monthly.length > 0);
});

test('una alerta de cacao de un usuario sin Pro vigente no se entrega; la de un Pro sí', async () => {
  const proId = db.prepare("SELECT id FROM users WHERE username = 'pro@x.co'").get().id;
  const expiredId = db.prepare("SELECT id FROM users WHERE username = 'vencido@x.co'").get().id;
  for (const id of [proId, expiredId]) {
    db.prepare("INSERT INTO push_devices (user_id, token, platform) VALUES (?, ?, 'android')").run(id, `tok-${id}`);
    alertRepository.create({ userId: id, type: 'above', thresholdCopCarga: 1, market: 'cocoa' });
  }
  await alertService.evaluateCocoaAlerts();

  const deliveries = (id) => db.prepare('SELECT COUNT(*) AS n FROM alert_deliveries WHERE user_id = ?').get(id).n;
  assert.equal(deliveries(proId), 1);
  assert.equal(deliveries(expiredId), 0);
});
