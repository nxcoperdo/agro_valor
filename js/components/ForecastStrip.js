import { usdPerLbToCarga } from '../utils/currency.js';

/**
 * Franja de velas bajo el gráfico: 30 días reales hacia atrás + proyección hacia adelante,
 * con selector entre "Por carga" (US$) y "Bolsa NY" (centavos por libra, solo café).
 * Recibe los datos ya pedidos; no hace peticiones.
 */

const CSS_HREF = 'css/forecastStrip.css';
const TZ = 'America/Bogota';
const PAST_DAYS = 30;

const fmt2 = (v) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const fmtNy = (v) => new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const dayKey = (d) => d.toLocaleDateString('en-CA', { timeZone: TZ });

function ensureStyles() {
  if (document.querySelector('link[data-forecast-strip]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = CSS_HREF;
  link.dataset.forecastStrip = '';
  document.head.appendChild(link);
}

function pctText(v) {
  if (v == null) return '';
  return Math.abs(v) < 0.005 ? '● 0,00%' : `${v > 0 ? '▲ +' : '▼ '}${v.toFixed(2).replace('.', ',')}%`;
}

/** Velas diarias reales a partir del histórico (café: centavos/libra; cacao: USD/tonelada). */
function buildPastDays(history, cocoa) {
  const byDay = new Map();
  for (const row of history) {
    const at = new Date(row.fetchedAt || row.quotedAt);
    const value = cocoa ? row.usdPerTonne : row.centsPerLb;
    if (!Number.isFinite(value)) continue;
    const key = dayKey(at);
    const d = byDay.get(key);
    if (!d) byDay.set(key, { key, date: new Date(`${key}T12:00:00`), open: value, high: value, low: value, close: value });
    else {
      d.high = Math.max(d.high, value);
      d.low = Math.min(d.low, value);
      d.close = value;
    }
  }
  const days = [...byDay.values()].slice(-PAST_DAYS);
  days.forEach((d, i) => {
    d.pct = i > 0 ? ((d.close - days[i - 1].close) / days[i - 1].close) * 100 : null;
    d.past = true;
    d.today = d.key === dayKey(new Date());
  });
  return days;
}

/** Velas proyectadas; mismas unidades base que las reales. */
function buildFutureDays(forecast, cocoa) {
  return (forecast && forecast.daily ? forecast.daily : []).map((f) => ({
    date: new Date(`${f.predictedForDate}T12:00:00`),
    open: cocoa ? f.openUsdPerTonne : f.openCentsPerLb,
    high: cocoa ? f.highUsdPerTonne : f.highCentsPerLb,
    low: cocoa ? f.lowUsdPerTonne : f.lowCentsPerLb,
    close: cocoa ? f.usdPerTonne : f.centsPerLb,
    pct: f.dayChangePct,
    past: false,
  }));
}

export function renderForecastStrip(el, { market = 'coffee', forecast = null, history = null } = {}) {
  const cocoa = market === 'cocoa';
  const past = history ? buildPastDays(history, cocoa) : [];
  const future = buildFutureDays(forecast, cocoa);
  if (!past.length && !future.length) {
    el.hidden = true;
    return;
  }
  ensureStyles();

  const all = [...past, ...future];
  const locked = forecast && forecast.locked && forecast.locked.dailyCount > 0 ? forecast.locked.dailyCount : 0;
  let unit = 'carga';
  // La franja abre en la tarjeta de hoy (o, si no hay, en la primera de proyección).
  const anchor = past.find((d) => d.today) || future[0];

  const value = (v) => {
    if (v == null) return '—';
    if (cocoa) return fmt2(v);
    return unit === 'ny' ? fmtNy(v) : fmt2(usdPerLbToCarga(v / 100));
  };
  const unitLabel = () => (cocoa ? 'US$ por tonelada' : unit === 'ny' ? 'Bolsa NY · c/lb' : 'US$ por carga');

  function draw(keepScroll) {
    const prevRow = el.querySelector('.pv-fcst-row');
    const prevScroll = prevRow ? prevRow.scrollLeft : 0;

    el.innerHTML = `
      <div class="pv-fcst-head">
        <p class="pv-fcst-title">Histórico y proyección · ${unitLabel()}</p>
        ${
          cocoa
            ? ''
            : `<div class="pv-seg pv-fcst-seg" role="tablist">
                <button type="button" role="tab" data-unit="carga" class="${unit === 'carga' ? 'is-active' : ''}">Por carga</button>
                <button type="button" role="tab" data-unit="ny" class="${unit === 'ny' ? 'is-active' : ''}">Bolsa NY</button>
              </div>`
        }
      </div>
      <div class="pv-fcst-row">${all
        .map((d) => {
          const cls = d.pct > 0.005 ? 'is-up' : d.pct < -0.005 ? 'is-down' : '';
          const tag = d.past ? (d.today ? 'Hoy' : 'Real') : 'Proyección';
          return `<div class="pv-fcst-card${d.past ? ' is-past' : ''}"${d === anchor ? ' data-anchor' : ''}>
            <p class="pv-fcst-date">${d.date.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
            <p class="pv-fcst-pct ${cls}">${pctText(d.pct)}</p>
            <p class="pv-fcst-tag">${tag}</p>
            ${[['Apertura', d.open], ['Máximo', d.high], ['Mínimo', d.low], ['Cierre', d.close]]
              .map(([k, v]) => `<p class="pv-fcst-line"><span>${k}</span><span class="pv-mono">${value(v)}</span></p>`)
              .join('')}
          </div>`;
        })
        .join('')}</div>
      ${locked ? `<p class="pv-fcst-lock">Con <a href="#/pro">Pro</a> ves ${locked} días más.</p>` : ''}`;
    el.hidden = false;

    const row = el.querySelector('.pv-fcst-row');
    if (keepScroll) {
      row.scrollLeft = prevScroll;
    } else {
      // Arranca en hoy; el pasado queda a la izquierda y la proyección a la derecha.
      const first = row.querySelector('[data-anchor]');
      if (first) row.scrollLeft = first.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft - 12;
      else row.scrollLeft = row.scrollWidth;
    }

    el.querySelectorAll('[data-unit]').forEach((b) =>
      b.addEventListener('click', () => {
        if (unit === b.dataset.unit) return;
        unit = b.dataset.unit;
        draw(true);
      })
    );
  }

  draw(false);
}
