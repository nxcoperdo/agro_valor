const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.SQLITE_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'agro-seo-')), 'seo.sqlite');
const bootstrap = require('../db/bootstrap');
const db = require('../db/connection');
const createApp = require('../app');

let server;
let base;

test.before(async () => {
  bootstrap();
  const insert = db.prepare(
    'INSERT INTO fnc_reference_prices (price_cop_carga, scraped_at, source_url) VALUES (?, ?, ?)'
  );
  insert.run(2170000, '2026-09-30 13:00:00', 'https://example.test');
  insert.run(2155000, '2026-10-01 13:00:00', 'https://example.test');

  const app = createApp();
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const headings = (html, level) =>
  [...html.matchAll(new RegExp(`<h${level}[^>]*>([\\s\\S]*?)</h${level}>`, 'g'))].map((m) => m[1].trim());

test('/precio-cafe-hoy: un solo H1 con la palabra clave y H2 orientados a la búsqueda', async () => {
  const res = await fetch(`${base}/precio-cafe-hoy`);
  assert.equal(res.status, 200);
  const html = await res.text();

  const h1 = headings(html, 1);
  assert.equal(h1.length, 1);
  assert.match(h1[0], /^Precio del café hoy/);

  const h2 = headings(html, 2);
  for (const expected of [
    'Precio del café hoy por carga, arroba y kilo',
    '¿Subió o bajó el precio del café hoy?',
    'Bolsa de Nueva York y dólar hoy',
    'Cómo se calcula el precio interno del café',
    'Preguntas frecuentes sobre el precio del café',
  ]) {
    assert.ok(h2.includes(expected), `falta H2: ${expected}`);
  }
});

test('/precio-cafe-hoy: precio por arroba, kilo y variación frente al día anterior', async () => {
  const html = await (await fetch(`${base}/precio-cafe-hoy`)).text();
  const nums = html.replace(/ /g, ' ');

  assert.match(nums, /215\.500/); // arroba = carga / 10
  assert.match(nums, /17\.240/); // kilo = carga / 125
  assert.match(nums, /bajó \$ 15\.000 \(-0\.69%\)/);
  assert.match(html, /<title>Precio del café hoy en Colombia:/);

  const faq = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => JSON.parse(m[1]))
    .find((d) => d['@type'] === 'FAQPage');
  assert.ok(faq.mainEntity.some((q) => q.name === '¿Cuánto está la arroba de café hoy?'));
});
