import { api } from '../services/api.js';
import { usdPerLbToCarga } from '../utils/currency.js';

/** Cada cuánto el navegador vuelve a pedir la cotización sin recargar la página. */
const REFRESH_MS = 60000;

const PERIODS = [
  { id: '7D', days: 7, ma: 3 },
  { id: '30D', days: 30, ma: 7 },
  { id: '90D', days: 90, ma: 14 },
  { id: '1A', days: 365, ma: 30 },
];

const TZ = 'America/Bogota';

const fmtInt = (value) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value);
const fmt2 = (value) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

/**
 * El precio interno de la FNC está definido para factor de rendimiento 94 (ver
 * server/services/netPriceService.js). A menor factor, mejor rendimiento y más valor,
 * en proporción inversa: basta con escalar por 94/factor.
 */
const REFERENCE_FACTOR = 94;
function copPerCargaAtFactor(basePriceAtFactor94, factor) {
  return basePriceAtFactor94 * (REFERENCE_FACTOR / factor);
}

function timeAgo(iso) {
  if (!iso) return '';
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'hace un momento';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

function liveBadge(international) {
  if (international && international.source === 'real') {
    return international.granularity === 'mensual'
      ? { text: 'Dato mensual', cls: 'pv-pill-gold' }
      : { text: 'En vivo', cls: 'pv-pill-live' };
  }
  return { text: 'Simulado', cls: 'pv-pill-gold' };
}

// --- Tarjetas de precio ---------------------------------------------------------

function renderInternal(el, internal) {
  if (!internal) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const date = new Date(internal.scrapedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: TZ });
  const price94 = internal.copPerCarga;
  const price88 = copPerCargaAtFactor(internal.copPerCarga, 88);
  el.innerHTML = `
    <p class="pv-label">Lo que le pagan al caficultor</p>
    <div class="pv-hero">
      <span class="pv-mono pv-hero-value">${fmtInt(price94)}</span>
      <span class="pv-hero-unit">$</span>
    </div>
    <p class="pv-sub">por carga de ${internal.cargaKg} kg de pergamino seco, factor de rendimiento ${REFERENCE_FACTOR}</p>
    <div class="pv-factors">
      <div class="pv-kv"><span>Factor ${REFERENCE_FACTOR}</span><span class="pv-mono">${fmtInt(price94)} $</span></div>
      <div class="pv-kv"><span>Factor 88</span><span class="pv-mono">${fmtInt(price88)} $</span></div>
    </div>
    <div class="pv-foot">
      <span class="pv-pill pv-pill-gold">FNC</span>
      <span class="pv-sub">${internal.label} · ${date}</span>
    </div>
  `;
}

function renderMarket(el, international, exchangeRate) {
  if (!international) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const usdCarga = usdPerLbToCarga(international.usdPerLb);
  const rate = exchangeRate ? exchangeRate.rate : null;
  const badge = liveBadge(international);
  const change = international.changePct;
  const meta = [
    international.exchange || 'Bolsa',
    international.quotedAt ? `cotización ${timeAgo(international.quotedAt)}` : null,
    rate ? `1 USD ≈ ${fmtInt(rate)} $` : null,
  ].filter(Boolean);

  el.innerHTML = `
    <div class="pv-row">
      <span class="pv-label">Mercado internacional${international.contract ? ` · ${international.contract}` : ''}</span>
      <span class="pv-pill ${badge.cls} pv-pill-caps">${badge.text}</span>
    </div>
    <div class="pv-market">
      <span class="pv-mono pv-market-value">US$ ${fmt2(usdCarga)}</span>
      ${
        change != null
          ? `<span class="pv-change ${change >= 0 ? 'is-up' : 'is-down'}">${change >= 0 ? '+' : ''}${change.toFixed(2)}%</span>`
          : ''
      }
    </div>
    ${rate ? `<p class="pv-sub">≈ <span class="pv-mono pv-strong">${fmtInt(usdCarga * rate)} $</span> por carga</p>` : ''}
    <p class="pv-meta">${meta.join(' · ')}${
      international.granularity === 'mensual' ? ' · <strong>promedio del mes, no cotización viva</strong>' : ''
    }</p>
  `;
}

function renderParity(el, market) {
  const { exportParity, international, exchangeRate } = market;
  if (!exportParity) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const wasOpen = el.classList.contains('is-open');
  const rows = [
    international ? ['Precio ICE', `US$ ${fmt2(usdPerLbToCarga(international.usdPerLb))}`] : null,
    ['Prima Colombia', `+US$ ${fmt2(exportParity.premiumUsdPerLb * exportParity.excelsoLbPerCarga)}`],
    exchangeRate ? ['TRM', `${fmtInt(exchangeRate.rate)} $`] : null,
    ['Factor de rendimiento', String(exportParity.factor)],
  ].filter(Boolean);

  el.innerHTML = `
    <button type="button" class="pv-parity-toggle" aria-expanded="${wasOpen}">
      <span>
        <span class="pv-parity-title">Paridad de exportación</span>
        <span class="pv-parity-value pv-mono">${fmtInt(exportParity.copPerCarga)} <small>$ por carga</small></span>
      </span>
      <span class="pv-chevron" aria-hidden="true">⌄</span>
    </button>
    <div class="pv-parity-body">
      ${rows.map(([k, v]) => `<div class="pv-kv"><span>${k}</span><span class="pv-mono">${v}</span></div>`).join('')}
      <p class="pv-meta">${exportParity.note}</p>
    </div>
  `;
  el.querySelector('.pv-parity-toggle').addEventListener('click', () => {
    const open = el.classList.toggle('is-open');
    el.querySelector('.pv-parity-toggle').setAttribute('aria-expanded', String(open));
  });
}

// --- Velas -------------------------------------------------------------------------

/** Agrupa el histórico por día (hora Colombia) en velas de apertura/máximo/mínimo/cierre. */
function buildCandles(history, days) {
  const byDay = new Map();
  for (const row of history) {
    const at = new Date(row.fetchedAt || row.quotedAt);
    const key = at.toLocaleDateString('en-CA', { timeZone: TZ });
    const value = usdPerLbToCarga(row.usdPerLb);
    const day = byDay.get(key);
    if (!day) {
      byDay.set(key, { at, open: value, high: value, low: value, close: value });
    } else {
      day.high = Math.max(day.high, value);
      day.low = Math.min(day.low, value);
      day.close = value;
    }
  }

  const labelOpts =
    days <= 7
      ? { weekday: 'short' }
      : days <= 90
        ? { day: 'numeric', month: 'short' }
        : { month: 'short', year: '2-digit' };

  return [...byDay.values()].map((c) => ({
    ...c,
    label: c.at.toLocaleDateString('es-CO', { ...labelOpts, timeZone: TZ }),
    isUp: c.close >= c.open,
  }));
}

function movingAverage(data, w) {
  return data.map((_, i) =>
    i < w - 1 ? null : data.slice(i - w + 1, i + 1).reduce((s, c) => s + c.close, 0) / w
  );
}

const W = 360;
const H = 200;
const PAD = { top: 10, right: 8, bottom: 20, left: 46 };
const UP = '#4ade80';
const DOWN = '#f87171';

function candleSvg(data, { showMA, maWindow, hover }) {
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const n = data.length;

  const prices = data.flatMap((d) => [d.high, d.low]);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const pad = (maxP - minP) * 0.1 || maxP * 0.01 || 1;
  const lo = minP - pad;
  const hi = maxP + pad;

  const py = (p) => PAD.top + chartH - ((p - lo) / (hi - lo)) * chartH;
  const slotW = chartW / n;
  const candleW = Math.max(2, slotW * 0.6);
  const cx = (i) => PAD.left + i * slotW + slotW / 2;

  const yTicks = Array.from({ length: 6 }, (_, i) => lo + (i * (hi - lo)) / 5);

  const tickCount = Math.min(n, n <= 7 ? n : n <= 90 ? 6 : 7);
  const step = Math.max(1, Math.floor(n / Math.max(1, tickCount - 1)));
  const xTicks = [...new Set([...Array.from({ length: Math.max(0, tickCount - 1) }, (_, i) => i * step), n - 1])];

  const ma = showMA ? movingAverage(data, maWindow) : [];
  const maPts = ma.map((v, i) => (v == null ? null : `${cx(i).toFixed(1)},${py(v).toFixed(1)}`)).filter(Boolean);

  const text = (x, y, anchor, content, extra = '') =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" class="pv-axis" ${extra}>${content}</text>`;

  let svg = '';
  svg += yTicks.map((t) => `<line x1="${PAD.left}" y1="${py(t)}" x2="${W - PAD.right}" y2="${py(t)}" class="pv-grid"/>`).join('');
  svg += yTicks.map((t) => text(PAD.left - 4, py(t) + 4, 'end', t.toFixed(0))).join('');
  svg += xTicks.map((i) => text(cx(i), H + 4, 'middle', data[i].label)).join('');

  svg += data
    .map((d, i) => {
      const color = d.isUp ? UP : DOWN;
      const top = py(Math.max(d.open, d.close));
      const bodyH = Math.max(1.5, py(Math.min(d.open, d.close)) - top);
      const dim = hover != null && hover !== i ? ' opacity="0.35"' : '';
      return `<g${dim}>
        <line x1="${cx(i)}" y1="${py(d.high)}" x2="${cx(i)}" y2="${py(d.low)}" stroke="${color}" stroke-width="1.2"/>
        <rect x="${cx(i) - candleW / 2}" y="${top}" width="${candleW}" height="${bodyH}" rx="1.5"
          fill="${d.isUp ? color : 'transparent'}" stroke="${color}" stroke-width="1.5"/>
      </g>`;
    })
    .join('');

  if (showMA && maPts.length) {
    svg += `<path d="M${maPts.join(' L')}" class="pv-ma"/>`;
  }

  if (hover != null) {
    const d = data[hover];
    const y = py(d.close);
    svg += `<line x1="${cx(hover)}" y1="${PAD.top}" x2="${cx(hover)}" y2="${H - PAD.bottom}" class="pv-cross"/>`;
    svg += `<line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}" class="pv-cross pv-cross-h"/>`;
    svg += `<rect x="0" y="${y - 9}" width="${PAD.left - 2}" height="16" rx="3" fill="${d.isUp ? UP : DOWN}"/>`;
    svg += text(PAD.left - 4, y + 4, 'end', d.close.toFixed(0), 'class="pv-axis-tag"');
  }

  return { svg, slotW };
}

function tooltipHtml(d) {
  const change = ((d.close - d.open) / d.open) * 100;
  return `
    <p class="pv-tip-date">${d.label}</p>
    ${[
      ['Apertura', d.open],
      ['Máximo', d.high],
      ['Mínimo', d.low],
      ['Cierre', d.close],
    ]
      .map(([k, v]) => `<div class="pv-tip-row"><span>${k}</span><span class="pv-mono">${fmt2(v)}</span></div>`)
      .join('')}
    <div class="pv-tip-change">
      <span>Cambio</span>
      <span class="pv-mono ${d.isUp ? 'is-up' : 'is-down'}">${d.isUp ? '+' : ''}${change.toFixed(2)}%</span>
    </div>
  `;
}

function renderChartPanel(el) {
  const state = { period: '30D', showMA: true, hover: null, data: [], loading: false };
  const cache = new Map();

  el.innerHTML = `
    <div class="pv-chart-head">
      <div class="pv-row pv-row-top">
        <div>
          <p class="pv-eyebrow">Histórico · US$ por carga</p>
          <div class="pv-chart-last"></div>
        </div>
        <div class="pv-updown"></div>
      </div>
      <div class="pv-row pv-controls">
        <div class="pv-seg" role="tablist">
          ${PERIODS.map((p) => `<button type="button" role="tab" data-period="${p.id}">${p.id}</button>`).join('')}
        </div>
        <button type="button" class="pv-ma-toggle"></button>
      </div>
    </div>
    <div class="pv-chart-body">
      <svg class="pv-svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Gráfico de velas del precio"></svg>
      <div class="pv-tip" hidden></div>
      <p class="pv-empty" hidden>Aún no hay suficiente histórico para este periodo.</p>
    </div>
    <div class="pv-ohlc"></div>
  `;

  const svgEl = el.querySelector('.pv-svg');
  const tipEl = el.querySelector('.pv-tip');
  const emptyEl = el.querySelector('.pv-empty');
  const lastEl = el.querySelector('.pv-chart-last');
  const upDownEl = el.querySelector('.pv-updown');
  const ohlcEl = el.querySelector('.pv-ohlc');
  const maBtn = el.querySelector('.pv-ma-toggle');
  const period = () => PERIODS.find((p) => p.id === state.period);

  let slotW = 0;

  function drawChart() {
    const { data } = state;
    const enough = data.length >= 2;
    svgEl.style.display = enough ? '' : 'none';
    emptyEl.hidden = enough;
    if (!enough) {
      tipEl.hidden = true;
      return;
    }
    const res = candleSvg(data, { showMA: state.showMA, maWindow: period().ma, hover: state.hover });
    svgEl.innerHTML = res.svg;
    slotW = res.slotW;

    if (state.hover != null) {
      const d = data[state.hover];
      tipEl.innerHTML = tooltipHtml(d);
      tipEl.className = `pv-tip ${d.isUp ? 'is-up' : 'is-down'} ${state.hover > data.length / 2 ? 'at-left' : 'at-right'}`;
      tipEl.hidden = false;
    } else {
      tipEl.hidden = true;
    }
  }

  function drawChrome() {
    el.querySelectorAll('[data-period]').forEach((b) => {
      const active = b.dataset.period === state.period;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', String(active));
    });
    maBtn.textContent = `MA ${period().ma}`;
    maBtn.classList.toggle('is-active', state.showMA);

    const { data } = state;
    if (data.length < 2) {
      lastEl.innerHTML = '';
      upDownEl.innerHTML = '';
      ohlcEl.innerHTML = '';
      return;
    }
    const last = data[data.length - 1];
    const prev = data[data.length - 2];
    const isUp = last.close >= prev.close;
    const changePct = ((last.close - prev.close) / prev.close) * 100;
    const upCount = data.filter((d) => d.isUp).length;

    lastEl.innerHTML = `
      <span class="pv-mono pv-last-value">${fmt2(last.close)}</span>
      <span class="pv-delta ${isUp ? 'is-up' : 'is-down'}">${isUp ? '▲' : '▼'} ${Math.abs(changePct).toFixed(2)}%</span>
    `;
    upDownEl.innerHTML = `
      <div class="pv-updown-counts">
        <span class="pv-mono is-up">▲${upCount}</span>
        <span class="pv-mono is-down">▼${data.length - upCount}</span>
      </div>
      <div class="pv-updown-bar"><div style="width:${(upCount / data.length) * 100}%"></div></div>
    `;
    ohlcEl.innerHTML = [
      ['Apertura', last.open, ''],
      ['Máximo', last.high, 'is-up'],
      ['Mínimo', last.low, 'is-down'],
      ['Cierre', last.close, ''],
    ]
      .map(([k, v, cls]) => `<div><p class="pv-ohlc-label">${k}</p><p class="pv-mono pv-ohlc-value ${cls}">${fmt2(v)}</p></div>`)
      .join('');
  }

  async function load() {
    const p = period();
    drawChrome();
    try {
      if (!cache.has(p.id)) cache.set(p.id, buildCandles(await api.priceHistory(p.days), p.days));
      if (p.id !== state.period) return;
      state.data = cache.get(p.id);
      state.hover = null;
      drawChrome();
      drawChart();
    } catch (err) {
      emptyEl.hidden = false;
      emptyEl.textContent = `No se pudo cargar el histórico: ${err.message}`;
      svgEl.style.display = 'none';
    }
  }

  function hoverAt(clientX) {
    const rect = svgEl.getBoundingClientRect();
    if (!rect.width || !slotW) return;
    const svgX = ((clientX - rect.left) / rect.width) * W;
    const i = Math.round((svgX - PAD.left) / slotW - 0.5);
    const next = i >= 0 && i < state.data.length ? i : null;
    if (next !== state.hover) {
      state.hover = next;
      drawChart();
    }
  }

  svgEl.addEventListener('pointermove', (e) => hoverAt(e.clientX));
  svgEl.addEventListener('pointerdown', (e) => hoverAt(e.clientX));
  svgEl.addEventListener('pointerleave', () => {
    state.hover = null;
    drawChart();
  });

  el.querySelectorAll('[data-period]').forEach((b) =>
    b.addEventListener('click', () => {
      if (state.period === b.dataset.period) return;
      state.period = b.dataset.period;
      load();
    })
  );
  maBtn.addEventListener('click', () => {
    state.showMA = !state.showMA;
    drawChrome();
    drawChart();
  });

  return load();
}

// --- Sección completa ------------------------------------------------------------

export async function renderPriceChart(container) {
  container.innerHTML = `
    <div class="pv">
      <article class="pv-card pv-internal"><span class="skeleton" style="width: 220px; height: 2.6rem;"></span></article>
      <article class="pv-card pv-market-card" hidden></article>
      <article class="pv-card pv-chart"></article>
      <article class="pv-card pv-parity" hidden></article>
    </div>
  `;

  const internalEl = container.querySelector('.pv-internal');
  const marketEl = container.querySelector('.pv-market-card');
  const chartEl = container.querySelector('.pv-chart');
  const parityEl = container.querySelector('.pv-parity');

  function renderPrices(market) {
    renderInternal(internalEl, market.internal);
    renderMarket(marketEl, market.international, market.exchangeRate);
    renderParity(parityEl, market);
  }

  try {
    const market = await api.currentPrice();
    renderPrices(market);
    renderChartPanel(chartEl);
    startAutoRefresh();
  } catch (err) {
    internalEl.innerHTML = `<p class="panel-error">No se pudo cargar el precio: ${err.message}</p>`;
  }

  /** Repinta solo los números; el gráfico se deja quieto para no parpadear. */
  function startAutoRefresh() {
    let stopped = false;

    async function refresh() {
      try {
        renderPrices(await api.currentPrice());
      } catch (err) {
        // Un fallo puntual de red no debe romper la pantalla: se reintenta al siguiente ciclo.
      }
    }

    function stop() {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    }

    // Al volver a la app el usuario ve el dato fresco de una vez, sin esperar el ciclo.
    function onVisible() {
      if (stopped || document.hidden) return;
      if (!document.body.contains(container)) return stop();
      refresh();
    }

    const timer = setInterval(() => {
      // Al cambiar de pantalla el nodo deja de existir: se corta el ciclo.
      if (!document.body.contains(container)) return stop();

      // Con la pestaña en segundo plano no tiene sentido gastar los datos del usuario.
      if (document.hidden) return;

      refresh();
    }, REFRESH_MS);

    document.addEventListener('visibilitychange', onVisible);
  }
}
