/**
 * Lectura de entradas numéricas de las calculadoras. Vacío o ausente usa el valor por defecto;
 * un valor que no es número o queda fuera de rango se rechaza con 400 en vez de limitarse en silencio,
 * para que nadie reciba un cálculo con un valor distinto al que escribió.
 */
function numberInRange(value, label, { min, max }, fallback) {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return fallback;
  const n = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(n)) {
    throw Object.assign(new Error(`${label} debe ser un número`), { status: 400 });
  }
  if (n < min || n > max) {
    throw Object.assign(new Error(`${label} debe estar entre ${min} y ${max}`), { status: 400 });
  }
  return n;
}

module.exports = { numberInRange };
