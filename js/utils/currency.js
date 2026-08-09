const CARGA_KG = 125;
const LB_PER_KG = 2.2046226218;
export const LB_PER_CARGA = CARGA_KG * LB_PER_KG;

export function copPerLbToCarga(copPerLb) {
  return copPerLb * LB_PER_CARGA;
}

export function formatUsd(value) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function formatCop(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(
    value
  );
}
