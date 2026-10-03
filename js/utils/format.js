/** Formateadores compartidos del módulo de café (es-CO). Los pesos y kilos nunca llevan decimales de sobra. */
export const CARGA_KG = 125;

const kgFmt = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const copFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const formatKg = (v) => `${kgFmt.format(v ?? 0)} kg`;
export const formatCopValue = (v) => copFmt.format(v ?? 0);
export const formatPct = (v) => `${pctFmt.format(v ?? 0)}%`;
/** El factor de rendimiento NO es un porcentaje: se muestra como "Factor 88". */
export const formatFactor = (v) => `Factor ${pctFmt.format(v)}`;

export function formatDateTime(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(iso));
}

/** Escapa texto de usuario antes de ponerlo en innerHTML. */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Convierte "900.000" o "1.234,5" escritos por el usuario en número. */
export function parseNumber(text) {
  if (typeof text === 'number') return text;
  const clean = String(text ?? '').trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(clean);
  return Number.isFinite(n) ? n : NaN;
}
