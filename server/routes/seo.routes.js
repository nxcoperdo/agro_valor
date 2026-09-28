const express = require('express');
const env = require('../config/env');
const marketSummaryService = require('../services/marketSummaryService');
const cooperativeService = require('../services/cooperativeService');
const fncReferenceRepository = require('../repositories/fncReferenceRepository');

/**
 * Páginas públicas renderizadas en el servidor, pensadas para Google.
 *
 * La app es una SPA con rutas por hash (#/...): Google no indexa fragmentos como páginas
 * distintas y el contenido llega por JavaScript. Estas rutas reales (/precio-cafe-hoy)
 * entregan el HTML completo con el precio del día ya escrito, que es lo que buscan los
 * caficultores ("precio del café hoy") y lo que Google puede leer en el primer request.
 */

const router = express.Router();

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function longDate(iso) {
  const date = iso ? new Date(iso) : new Date();
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'full', timeZone: env.timezone }).format(date);
}

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "28 sep": corto para que la fecha quepa en el título que muestra Google (~60 caracteres). */
function shortDate(iso) {
  const date = iso ? new Date(iso) : new Date();
  const parts = new Intl.DateTimeFormat('en-CA', { day: 'numeric', month: 'numeric', timeZone: env.timezone })
    .formatToParts(date)
    .reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return `${parts.day} ${MONTHS_SHORT[Number(parts.month) - 1]}`;
}

/** "2026-09-25" → "viernes 25 de septiembre", para la frase de variación. */
function dayName(day) {
  return new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(`${day}T12:00:00Z`))
    .replace(',', '');
}

/** "2026-09-28" (fecha de un día, sin hora) → "lun, 28 sep 2026". */
function dayLabel(day) {
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`));
}

const KG_PER_CARGA = 125;
const KG_PER_ARROBA = 12.5;

/** JSON dentro de <script> no puede contener "</script>": se escapa el "<". */
function jsonLd(data) {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

function regionsOf(cooperatives) {
  const map = new Map();
  cooperatives.forEach((c) => {
    if (c.region) map.set(slugify(c.region), c.region);
  });
  return [...map.entries()].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
}

function layout({ title, description, path, body, structuredData }) {
  const url = `${env.publicBaseUrl}${path}`;
  const image = `${env.publicBaseUrl}/img/icon-512.png`;

  return `<!doctype html>
<html lang="es-CO">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${url}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="es_CO">
  <meta property="og:site_name" content="AgroValor">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${image}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${image}">
  <meta name="theme-color" content="#0b3d2e">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="apple-touch-icon" href="/icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=Montserrat:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
  ${structuredData.map(jsonLd).join('\n  ')}
</head>
<body>
  <div class="landing">
    <header class="landing-header">
      <a class="brand" href="/">
        <img class="brand-icon-img" src="/img/logo-icon.png" alt="" width="32" height="32">
        <span class="brand-word"><span class="brand-agro">Agro</span><span class="brand-valor">Valor</span></span>
      </a>
      <nav class="landing-actions" aria-label="Cuenta">
        <a class="btn-ghost" href="/#/login">Entrar</a>
        <a class="btn-primary" href="/#/registro">Crear cuenta</a>
      </nav>
    </header>
    ${body}
    <footer class="landing-footer">
      <p>AgroValor · Mercados que mueven el campo</p>
      <p class="disclaimer">
        Información de carácter informativo. No constituye asesoría financiera ni garantía de precio de compra.
      </p>
      <p class="landing-legal-links">
        <a href="/precio-cafe-hoy">Precio del café hoy</a> ·
        <a href="/#/privacidad">Política de privacidad</a> ·
        <a href="/#/terminos">Términos de uso</a> ·
        <a href="/#/cookies">Política de cookies</a>
      </p>
    </footer>
  </div>
</body>
</html>`;
}

function cooperativeRows(cooperatives) {
  return cooperatives
    .map(
      (c) => `
        <tr>
          <td data-label="#" class="cell-rank">${c.rank}</td>
          <td data-label="Cooperativa" class="cell-name">
            ${escapeHtml(c.name)}
            <span class="tag ${c.priceSource === 'reported' ? 'tag-reported' : 'tag-estimated'}">
              ${c.priceSource === 'reported' ? 'Reportado por caficultores' : 'Estimado'}
            </span>
          </td>
          <td data-label="Región">${escapeHtml(c.region || '—')}</td>
          <td data-label="Precio por carga" class="tabular-nums">${cop.format(c.estimatedPriceCopCarga)}</td>
        </tr>`
    )
    .join('');
}

function faqFor(fnc) {
  const perKilo = fnc ? cop.format(fnc.priceCopCarga / KG_PER_CARGA) : null;
  const perArroba = fnc ? cop.format((fnc.priceCopCarga / KG_PER_CARGA) * KG_PER_ARROBA) : null;
  const priceFaq = fnc
    ? [
        {
          q: '¿Cuánto está el precio del café hoy?',
          a: `Hoy el precio interno de referencia de la Federación Nacional de Cafeteros es de ${cop.format(
            fnc.priceCopCarga
          )} por carga de 125 kg de café pergamino seco.`,
        },
        {
          q: '¿Cuánto vale el kilo de café hoy?',
          a: `Con el precio de referencia de hoy, el kilo de café pergamino seco queda en ${perKilo} y la arroba (12,5 kg) en ${perArroba}. Lo que te paguen a ti depende de tu factor de rendimiento y tu humedad.`,
        },
      ]
    : [];
  return [...priceFaq, ...FAQ_STATIC];
}

const FAQ_STATIC = [
  {
    q: '¿Qué es el precio de referencia del café de la FNC?',
    a: 'Es el precio interno que publica a diario la Federación Nacional de Cafeteros para la carga de 125 kg de café pergamino seco. Se calcula con la cotización de la Bolsa de Nueva York, el dólar y la prima del café colombiano, y sirve como base de compra en todo el país.',
  },
  {
    q: '¿Por qué cada cooperativa paga un precio distinto?',
    a: 'Cada comprador ajusta el precio de referencia según la calidad (factor de rendimiento y humedad), sus costos y la competencia en la región. Por eso en AgroValor comparamos cuánto está pagando cada cooperativa hoy.',
  },
  {
    q: '¿Cuánto pesa una carga de café?',
    a: 'Una carga de café pergamino seco equivale a 125 kilogramos. Todos los precios de esta página están expresados por carga.',
  },
  {
    q: '¿Cada cuánto se actualiza este precio?',
    a: 'El precio de referencia se actualiza cada día hábil con el dato publicado por la Federación. La cotización de Nueva York y el dólar se consultan varias veces al día.',
  },
];

function unitBlock(fnc) {
  if (!fnc) return '';
  const perKilo = fnc.priceCopCarga / KG_PER_CARGA;
  return `
    <section class="panel landing-panel">
      <div class="panel-header"><h2>Precio del café hoy por kilo y por arroba</h2></div>
      <div class="table-scroll">
        <table class="coop-table">
          <thead><tr><th>Unidad</th><th>Precio de referencia</th></tr></thead>
          <tbody>
            <tr><td data-label="Unidad">Carga (125 kg)</td><td data-label="Precio" class="tabular-nums">${cop.format(fnc.priceCopCarga)}</td></tr>
            <tr><td data-label="Unidad">Arroba (12,5 kg)</td><td data-label="Precio" class="tabular-nums">${cop.format(perKilo * KG_PER_ARROBA)}</td></tr>
            <tr><td data-label="Unidad">Kilo</td><td data-label="Precio" class="tabular-nums">${cop.format(perKilo)}</td></tr>
          </tbody>
        </table>
      </div>
      <p class="disclaimer">Café pergamino seco, calculado sobre el precio interno de referencia de la FNC.</p>
    </section>`;
}

function historyBlock(history) {
  if (history.length < 2) return '';
  const rows = history
    .map((h, i) => {
      const prev = history[i + 1];
      const diff = prev ? h.price_cop_carga - prev.price_cop_carga : null;
      const diffText = diff == null ? '—' : diff === 0 ? 'Sin cambio' : `${diff > 0 ? '+' : '−'}${cop.format(Math.abs(diff))}`;
      return `<tr>
            <td data-label="Fecha"><time datetime="${h.day}">${escapeHtml(dayLabel(h.day))}</time></td>
            <td data-label="Precio por carga" class="tabular-nums">${cop.format(h.price_cop_carga)}</td>
            <td data-label="Variación" class="tabular-nums">${diffText}</td>
          </tr>`;
    })
    .join('');
  return `
    <section class="panel landing-panel">
      <div class="panel-header"><h2>Histórico del precio del café: últimos días</h2></div>
      <div class="table-scroll">
        <table class="coop-table">
          <thead><tr><th>Fecha</th><th>Precio por carga (125 kg)</th><th>Variación</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}

/** "Subió $12.000 frente a ayer" — lo primero que busca el caficultor además del precio. */
function changeText(history) {
  if (history.length < 2) return '';
  const diff = history[0].price_cop_carga - history[1].price_cop_carga;
  if (diff === 0) return `Sin cambio frente al ${dayName(history[1].day)}.`;
  return `${diff > 0 ? 'Subió' : 'Bajó'} ${cop.format(Math.abs(diff))} frente al ${dayName(history[1].day)}.`;
}

function marketBlock(summary, fnc) {
  const intl = summary.international;
  const fx = summary.exchangeRate;
  const change = intl && intl.changePct != null ? `${intl.changePct >= 0 ? '+' : ''}${intl.changePct.toFixed(2)}%` : null;

  return `
    <div class="value-grid">
      <article class="value-card">
        <h3>Precio interno FNC</h3>
        <p class="tabular-nums"><strong>${fnc ? cop.format(fnc.priceCopCarga) : 'No disponible'}</strong> por carga de 125 kg</p>
      </article>
      <article class="value-card">
        <h3>Bolsa de Nueva York</h3>
        <p class="tabular-nums">${intl ? `<strong>US$ ${intl.usdPerLb.toFixed(4)}</strong> por libra${change ? ` (${change})` : ''}` : 'No disponible'}</p>
      </article>
      <article class="value-card">
        <h3>Dólar</h3>
        <p class="tabular-nums">${fx ? `<strong>${cop.format(fx.rate)}</strong> por dólar` : 'No disponible'}</p>
      </article>
    </div>`;
}

function renderPricePage({ region } = {}) {
  const summary = marketSummaryService.getMarketSummary();
  const comparison = cooperativeService.getComparison();
  const fnc = comparison.fncReference;
  const regions = regionsOf(comparison.cooperatives);

  const cooperatives = region
    ? comparison.cooperatives.filter((c) => c.region && slugify(c.region) === region.slug)
    : comparison.cooperatives;

  const place = region ? region.name : 'Colombia';
  const path = region ? `/precio-cafe-hoy/${region.slug}` : '/precio-cafe-hoy';
  const priceText = fnc ? cop.format(fnc.priceCopCarga) : null;
  const dateText = longDate(fnc && fnc.scrapedAt);
  const best = cooperatives[0];
  const history = fncReferenceRepository.dailyHistory(10);
  const faq = faqFor(fnc);

  // La fecha en el título le dice a Google (y a quien busca) que el dato es de hoy.
  const titlePlace = region ? ` en ${place}` : '';
  const title = priceText
    ? `Precio del café hoy${titlePlace} ${shortDate(fnc.scrapedAt)}: ${priceText} la carga | AgroValor`
    : `Precio del café hoy${titlePlace} | AgroValor`;

  const description = priceText
    ? `Precio del café hoy en ${place}, ${dateText}: ${priceText} por carga de 125 kg según la FNC.${
        best ? ` Mejor pago: ${best.name} con ${cop.format(best.estimatedPriceCopCarga)}.` : ''
      } Bolsa de Nueva York y dólar, actualizado a diario.`
    : `Precio del café hoy en ${place} por carga de 125 kg, cotización de Nueva York y qué cooperativa paga mejor.`;

  const regionLinks = regions.length
    ? `<section class="panel landing-panel">
        <div class="panel-header"><h2>Precio del café por departamento</h2></div>
        <p class="landing-legal-links">
          ${regions
            .map((r) => `<a href="/precio-cafe-hoy/${r.slug}">Precio del café en ${escapeHtml(r.name)}</a>`)
            .join(' · ')}
          ${region ? ' · <a href="/precio-cafe-hoy">Todo Colombia</a>' : ''}
        </p>
      </section>`
    : '';

  const body = `
    <main>
      <section class="hero">
        <h1>Precio del café hoy en ${escapeHtml(place)}</h1>
        <p class="hero-meta">
          <time datetime="${escapeHtml(fnc ? fnc.scrapedAt : new Date().toISOString())}">${escapeHtml(dateText)}</time>
        </p>
        <div class="hero-price">
          ${
            priceText
              ? `<span class="tabular-nums">${priceText}</span><span class="hero-price-unit">por carga de 125 kg</span>`
              : 'Precio no disponible en este momento'
          }
        </div>
        <p class="hero-sub">
          ${priceText ? `El precio del café hoy es de ${priceText} por carga de 125 kg de café pergamino seco, según el precio interno de referencia de la Federación Nacional de Cafeteros (FNC). ${escapeHtml(changeText(history))}` : ''}
          Aquí también ves la cotización de la Bolsa de Nueva York, el dólar y qué cooperativa paga mejor${
            region ? ` en ${escapeHtml(place)}` : ''
          }.
        </p>
        <div class="hero-cta">
          <a class="btn-primary btn-lg" href="/#/registro">Calcula cuánto te queda a ti</a>
        </div>
      </section>

      ${marketBlock(summary, fnc)}

      ${unitBlock(fnc)}

      <section class="panel landing-panel">
        <div class="panel-header"><h2>Qué cooperativa paga mejor el café hoy${region ? ` en ${escapeHtml(place)}` : ''}</h2></div>
        ${
          cooperatives.length
            ? `<div class="table-scroll">
                <table class="coop-table">
                  <thead><tr><th>#</th><th>Cooperativa</th><th>Región</th><th>Precio por carga (125 kg)</th></tr></thead>
                  <tbody>${cooperativeRows(cooperatives)}</tbody>
                </table>
              </div>`
            : '<p class="empty-state">Todavía no tenemos cooperativas registradas en esta región.</p>'
        }
        <p class="disclaimer">${escapeHtml(comparison.disclaimer)}</p>
      </section>

      ${historyBlock(history)}

      ${regionLinks}

      <section class="panel landing-panel">
        <div class="panel-header"><h2>Preguntas frecuentes</h2></div>
        ${faq.map((f) => `<h3>${escapeHtml(f.q)}</h3><p class="panel-intro">${escapeHtml(f.a)}</p>`).join('')}
      </section>
    </main>`;

  const breadcrumb = [
    { name: 'Inicio', url: `${env.publicBaseUrl}/` },
    { name: 'Precio del café hoy', url: `${env.publicBaseUrl}/precio-cafe-hoy` },
  ];
  if (region) breadcrumb.push({ name: region.name, url: `${env.publicBaseUrl}${path}` });

  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description,
      url: `${env.publicBaseUrl}${path}`,
      inLanguage: 'es-CO',
      dateModified: fnc ? fnc.scrapedAt : new Date().toISOString(),
      isPartOf: { '@type': 'WebSite', name: 'AgroValor', url: `${env.publicBaseUrl}/` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumb.map((b, i) => ({ '@type': 'ListItem', position: i + 1, name: b.name, item: b.url })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ];

  return layout({ title, description, path, body, structuredData });
}

function sendHtml(res, html) {
  // El precio cambia a lo largo del día: caché corto para no servir un dato viejo.
  res.set('Cache-Control', 'public, max-age=600');
  res.type('html').send(html);
}

router.get('/precio-cafe-hoy', (req, res) => sendHtml(res, renderPricePage()));

router.get('/precio-cafe-hoy/:region', (req, res, next) => {
  const comparison = cooperativeService.getComparison();
  const region = regionsOf(comparison.cooperatives).find((r) => r.slug === req.params.region);
  if (!region) return next();
  sendHtml(res, renderPricePage({ region }));
});

router.get('/sitemap.xml', (req, res) => {
  const comparison = cooperativeService.getComparison();
  const lastmod = (comparison.fncReference ? new Date(comparison.fncReference.scrapedAt) : new Date())
    .toISOString()
    .slice(0, 10);

  const urls = [
    { loc: '/', changefreq: 'daily', priority: '1.0' },
    { loc: '/precio-cafe-hoy', changefreq: 'daily', priority: '0.9' },
    ...regionsOf(comparison.cooperatives).map((r) => ({
      loc: `/precio-cafe-hoy/${r.slug}`,
      changefreq: 'daily',
      priority: '0.7',
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${env.publicBaseUrl}${u.loc}</loc><lastmod>${lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
  )
  .join('\n')}
</urlset>`;

  res.set('Cache-Control', 'public, max-age=3600');
  res.type('application/xml').send(xml);
});

module.exports = router;
