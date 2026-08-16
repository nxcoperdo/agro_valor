import { api } from '../services/api.js';
import { paywall } from '../ui/shell.js';
import { formatCop, formatCopShort } from '../utils/currency.js';

const TABS = [
  { key: 'daily', label: 'Día' },
  { key: 'weekly', label: 'Semana' },
  { key: 'monthly', label: 'Mes' },
];

const WEEKDAY_HEADERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const dayNumFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric' });
const dayMonthFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });
const monthYearFmt = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' });

/**
 * predictedForDate llega como "YYYY-MM-DD" sin hora. new Date(str) lo interpreta como
 * medianoche UTC, y en Colombia (UTC-5) eso cae en el día anterior al mostrarlo local.
 * Se arma la fecha a mano para que quede en el día calendario correcto.
 */
function parseCalendarDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function changeBadge(changePct) {
  if (changePct == null) return '';
  const up = changePct >= 0;
  return `<span class="cal-change ${up ? 'delta-up' : 'delta-down'} tabular-nums">${up ? '▲' : '▼'} ${
    up ? '+' : ''
  }${changePct.toFixed(1)}%</span>`;
}

function renderDayView(daily) {
  if (!daily.length) return '<p class="empty-state">Sin datos suficientes todavía.</p>';

  const firstDate = parseCalendarDate(daily[0].predictedForDate);
  const mondayIndex = (firstDate.getDay() + 6) % 7; // 0 = lunes

  const leadingBlanks = Array.from({ length: mondayIndex })
    .map(() => '<div class="cal-cell cal-day-cell cal-blank"></div>')
    .join('');

  const cells = daily
    .map((f) => {
      const date = parseCalendarDate(f.predictedForDate);
      // El día de la semana solo se ve en móvil, donde la grilla se vuelve lista.
      const weekday = WEEKDAY_HEADERS[(date.getDay() + 6) % 7];
      return `
        <div class="cal-cell cal-day-cell">
          <div class="cal-day-num tabular-nums">
            <span class="cal-day-weekday">${weekday}</span>${dayNumFmt.format(date)}
          </div>
          ${changeBadge(f.changePct)}
          <div class="cal-day-price tabular-nums">${
            f.impliedInternalCopPerCarga != null ? formatCopShort(f.impliedInternalCopPerCarga) : '—'
          }</div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="cal-grid cal-grid-day">
      ${WEEKDAY_HEADERS.map((h) => `<div class="cal-weekday-header">${h}</div>`).join('')}
      ${leadingBlanks}${cells}
    </div>
  `;
}

function renderWeekView(weekly) {
  if (!weekly.length) return '<p class="empty-state">Sin datos suficientes todavía.</p>';

  const cells = weekly
    .map((f) => {
      const endDate = parseCalendarDate(f.predictedForDate);
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 6);
      return `
        <div class="cal-cell cal-week-cell">
          <div class="cal-cell-label">Semana ${f.step}</div>
          <div class="cal-cell-range">${dayMonthFmt.format(startDate)} – ${dayMonthFmt.format(endDate)}</div>
          ${changeBadge(f.changePct)}
          <div class="cal-cell-price tabular-nums">${
            f.impliedInternalCopPerCarga != null ? formatCop(f.impliedInternalCopPerCarga) : '—'
          }</div>
        </div>
      `;
    })
    .join('');

  return `<div class="cal-grid cal-grid-week">${cells}</div>`;
}

function renderMonthView(monthly) {
  if (!monthly.length) return '<p class="empty-state">Sin datos suficientes todavía.</p>';

  const cells = monthly
    .map((f) => {
      const date = parseCalendarDate(f.predictedForDate);
      return `
        <div class="cal-cell cal-month-cell">
          <div class="cal-cell-label">${monthYearFmt.format(date)}</div>
          ${changeBadge(f.changePct)}
          <div class="cal-cell-price tabular-nums">${
            f.impliedInternalCopPerCarga != null ? formatCop(f.impliedInternalCopPerCarga) : '—'
          }</div>
        </div>
      `;
    })
    .join('');

  return `<div class="cal-grid cal-grid-month">${cells}</div>`;
}

const RENDERERS = { daily: renderDayView, weekly: renderWeekView, monthly: renderMonthView };

export async function renderForecastPanel(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h2>Proyección del precio</h2>
      </div>
      <div class="cal-tabs" id="forecast-tabs" role="tablist"></div>
      <div id="forecast-body" aria-live="polite">
        <span class="skeleton" style="width: 100%; height: 180px; display: block; border-radius: var(--av-radius-md);"></span>
      </div>
      <p class="disclaimer" id="forecast-note"></p>
    </div>
  `;

  const tabsEl = container.querySelector('#forecast-tabs');
  const bodyEl = container.querySelector('#forecast-body');
  const noteEl = container.querySelector('#forecast-note');

  try {
    const data = await api.forecast();
    const { daily = [], weekly = [], monthly = [], note } = data;

    if (!daily.length && !weekly.length && !monthly.length) {
      bodyEl.innerHTML =
        '<p class="empty-state">Aún no hay suficiente historial de precios para proyectar. Se necesitan al menos dos días de datos.</p>';
      return;
    }

    const views = { daily, weekly, monthly };
    let activeTab = 'daily';

    function renderActiveTab() {
      tabsEl.innerHTML = TABS.map(
        (t) => `
          <button type="button" class="cal-tab-btn ${t.key === activeTab ? 'active' : ''}"
            data-tab="${t.key}" role="tab" aria-selected="${t.key === activeTab}">${t.label}</button>
        `
      ).join('');
      bodyEl.innerHTML = RENDERERS[activeTab](views[activeTab]);

      // bodyEl es el mismo nodo siempre: hay que quitar la clase y forzar un
      // reflow para que la animación se vuelva a reproducir en cada cambio.
      bodyEl.classList.remove('av-fade-in');
      void bodyEl.offsetWidth;
      bodyEl.classList.add('av-fade-in');
    }

    tabsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.cal-tab-btn');
      if (!btn || btn.dataset.tab === activeTab) return;
      activeTab = btn.dataset.tab;
      renderActiveTab();
    });

    let touchStartX = 0;
    let touchStartY = 0;
    const SWIPE_THRESHOLD = 50;

    bodyEl.addEventListener(
      'touchstart',
      (e) => {
        touchStartX = e.changedTouches[0].clientX;
        touchStartY = e.changedTouches[0].clientY;
      },
      { passive: true }
    );

    bodyEl.addEventListener(
      'touchend',
      (e) => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        // Solo cuenta como gesto si es claramente horizontal, para no robarle el scroll.
        if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;

        const idx = TABS.findIndex((t) => t.key === activeTab);
        const nextIdx = dx < 0 ? idx + 1 : idx - 1;
        if (nextIdx < 0 || nextIdx >= TABS.length) return;

        activeTab = TABS[nextIdx].key;
        renderActiveTab();
      },
      { passive: true }
    );

    renderActiveTab();
    noteEl.textContent = note;
  } catch (err) {
    if (err.upgradeRequired) {
      container.innerHTML = paywall(
        'Proyección del precio',
        'Estima cómo puede moverse el precio del café día a día, semana a semana y mes a mes, para decidir si vender ahora o esperar.'
      );
      return;
    }
    bodyEl.innerHTML = `<p class="panel-error">No se pudo cargar la proyección: ${err.message}</p>`;
  }
}
