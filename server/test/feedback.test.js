const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

process.env.SQLITE_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'agro-fb-')), 'fb.sqlite');
const bootstrap = require('../db/bootstrap');
const db = require('../db/connection');
const createApp = require('../app');

let server;
let base;
let adminCookie;
let userCookie;

async function login(username, password) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return res.headers.get('set-cookie').split(';')[0];
}

async function call(method, url, cookie, body) {
  const res = await fetch(`${base}/api${url}`, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

test.before(async () => {
  bootstrap();
  db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'user')").run(
    'productor@x.co',
    bcrypt.hashSync('clave-de-prueba-1', 4)
  );
  server = await new Promise((resolve) => {
    const s = createApp().listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
  adminCookie = await login('admin', 'changeme123');
  userCookie = await login('productor@x.co', 'clave-de-prueba-1');
});
test.after(() => server.close());

test('sin sesión no se puede enviar una sugerencia', async () => {
  const res = await call('POST', '/feedback', null, { type: 'sugerencia', message: 'Hola, buena app' });
  assert.equal(res.status, 401);
});

test('valida tipo y largo del mensaje', async () => {
  assert.equal((await call('POST', '/feedback', userCookie, { type: 'queja', message: 'mensaje largo ok' })).status, 400);
  assert.equal((await call('POST', '/feedback', userCookie, { type: 'error', message: 'hola' })).status, 400);
  assert.equal((await call('POST', '/feedback', userCookie, { type: 'error', message: 'x'.repeat(1001) })).status, 400);
});

test('un usuario gratis envía, lo ve en "mine" y el tope diario corta el exceso', async () => {
  const ok = await call('POST', '/feedback', userCookie, {
    type: 'error',
    message: '  La calculadora no abre  ',
    platform: 'android',
    appVersion: '1.0.0+1',
  });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.feedback.message, 'La calculadora no abre');
  assert.equal(ok.body.feedback.status, 'nuevo');

  const mine = await call('GET', '/feedback/mine', userCookie);
  assert.equal(mine.body.feedback.length, 1);

  for (let i = 0; i < 4; i++) {
    assert.equal((await call('POST', '/feedback', userCookie, { type: 'otro', message: `mensaje número ${i}` })).status, 201);
  }
  const over = await call('POST', '/feedback', userCookie, { type: 'otro', message: 'uno más del límite' });
  assert.equal(over.status, 429);
});

test('el panel de administración lista, cambia el estado y cuenta los pendientes', async () => {
  const list = await call('GET', '/admin/feedback', adminCookie);
  assert.equal(list.status, 200);
  assert.equal(list.body.feedback.length, 5);
  assert.equal(list.body.feedback[0].username, 'productor@x.co');

  const metricsBefore = await call('GET', '/admin/metrics', adminCookie);
  assert.equal(metricsBefore.body.feedbackPending, 5);

  const id = list.body.feedback[0].id;
  const patched = await call('PATCH', `/admin/feedback/${id}`, adminCookie, { status: 'resuelto' });
  assert.equal(patched.body.feedback.status, 'resuelto');
  assert.equal((await call('PATCH', `/admin/feedback/${id}`, adminCookie, { status: 'quizas' })).status, 400);
  assert.equal((await call('PATCH', '/admin/feedback/99999', adminCookie, { status: 'resuelto' })).status, 404);

  assert.equal((await call('GET', '/admin/metrics', adminCookie)).body.feedbackPending, 4);
});

test('un usuario normal no entra al panel de feedback', async () => {
  assert.equal((await call('GET', '/admin/feedback', userCookie)).status, 403);
});

test('la hoja de ruta es pública y tiene el formato esperado', async () => {
  const res = await call('GET', '/public/roadmap', null);
  assert.equal(res.status, 200);
  assert.ok(res.body.items.length > 0);
  for (const item of res.body.items) {
    assert.ok(item.id && item.title && item.description);
    assert.ok(['planeado', 'en_desarrollo', 'pronto'].includes(item.status));
  }
});
