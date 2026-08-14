const CARGA_KG = 125;
const LB_PER_KG = 2.2046226218;
export const LB_PER_CARGA = CARGA_KG * LB_PER_KG;

export function copPerLbToCarga(copPerLb) {
  return copPerLb * LB_PER_CARGA;
}

export function usdPerLbToCarga(usdPerLb) {
  return usdPerLb * LB_PER_CARGA;
}

export function formatUsd(value) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function formatCop(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(
    value
  );
}

/** Versión compacta ("$2.15M") para espacios chicos como celdas de calendario. */
export function formatCopShort(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${Math.round(value / 1000)}K`;
  }
  return formatCop(value);
}
