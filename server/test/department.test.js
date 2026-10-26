const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

process.env.SQLITE_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'agro-dept-')), 'd.sqlite');
const bootstrap = require('../db/bootstrap');
const db = require('../db/connection');
const createApp = require('../app');
const { DEPARTMENTS, canonicalDepartment } = require('../config/departments');
const coopConfig = require('../config/cooperatives.json');

let server;
let base;
let cookie;

async function call(method, url, body) {
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
    'caficultor@x.co',
    bcrypt.hashSync('clave-de-prueba-1', 4)
  );
  server = await new Promise((resolve) => {
    const s = createApp().listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'caficultor@x.co', password: 'clave-de-prueba-1' }),
  });
  cookie = res.headers.get('set-cookie').split(';')[0];
});
test.after(() => server.close());

test('canonicalDepartment ignora tildes y mayúsculas', () => {
  assert.equal(canonicalDepartment('nariño'), 'Nariño');
  assert.equal(canonicalDepartment('NARINO'), 'Nariño');
  assert.equal(canonicalDepartment(' bogota d.c. '), 'Bogotá D.C.');
  assert.equal(canonicalDepartment('Atlantis'), null);
  assert.equal(canonicalDepartment(''), null);
});

test('todas las regiones de las cooperativas son departamentos de la lista', () => {
  const regions = (Array.isArray(coopConfig) ? coopConfig : coopConfig.cooperatives || []).map((c) => c.region);
  assert.ok(regions.length > 0);
  for (const region of regions) assert.ok(DEPARTMENTS.includes(region), `${region} no está en la lista`);
});

test('la lista de departamentos es pública', async () => {
  const saved = cookie;
  cookie = null;
  const res = await call('GET', '/public/departments');
  cookie = saved;
  assert.equal(res.status, 200);
  assert.ok(res.body.departments.includes('Huila'));
});

test('el perfil guarda el departamento con su nombre oficial y rechaza uno inventado', async () => {
  assert.equal((await call('GET', '/account/profile')).body.department, null);

  const saved = await call('PUT', '/account/profile', { department: 'huila' });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.department, 'Huila');

  const invalid = await call('PUT', '/account/profile', { department: 'Atlantis' });
  assert.equal(invalid.status, 400);

  // Un guardado sin departamento no lo borra.
  await call('PUT', '/account/profile', { fullName: 'Ana' });
  assert.equal((await call('GET', '/account/profile')).body.department, 'Huila');
});
