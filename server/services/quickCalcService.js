const coffeeMath = require('../domain/coffeeMath');

const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });
const pos = (v, label) => {
  const n = parseFloat(v);
  if (!Number.isFinite(n) || n <= 0) throw fail(`${label} debe ser mayor a cero`);
  return n;
};

/** Calculadora rápida: no guarda nada ni crea compras. */
function calculate({ kilos, factor = null, precioCarga }) {
  const r = coffeeMath.calcularRapido({ kilos: pos(kilos, 'La cantidad de kg'), precioCarga: pos(precioCarga, 'El precio por carga') });
  return { factorRendimientoTrilla: factor == null || factor === '' ? null : pos(factor, 'El factor'), kilos: parseFloat(kilos), precioCarga: parseFloat(precioCarga), ...r };
}

/**
 * Compara factores. Cada opción trae su precioCarga; o bien se manda `referencia`
 * ({ factor, precioCarga }, ingresada por el usuario) y el precio de cada factor se calcula
 * con factorReferencia / factorEvaluado × precioReferencia. Nunca hay precios fijos en el código.
 */
function compare({ kilos, opciones, referencia }) {
  const k = pos(kilos, 'La cantidad de kg');
  if (!Array.isArray(opciones) || opciones.length < 2) throw fail('Agrega al menos dos opciones para comparar');
  const ref = referencia && referencia.precioCarga != null && referencia.precioCarga !== '' ? referencia : null;
  const parsed = opciones.map((o, i) => {
    const factor = pos(o.factor, `El factor de la opción ${i + 1}`);
    const precioCarga = ref
      ? coffeeMath.precioSegunFactor({ factorReferencia: pos(ref.factor, 'El factor de referencia'), factorEvaluado: factor, precioReferencia: pos(ref.precioCarga, 'El precio de referencia') })
      : pos(o.precioCarga, `El precio de la opción ${i + 1}`);
    return { factor, precioCarga };
  });
  const t = coffeeMath.compararFactores({ kilos: k, opciones: parsed });
  // esMayor se marca por posición: con dos opciones del mismo factor, resaltar por factor marcaría las dos.
  const idxMayor = t.mayorValor ? t.filas.findIndex((f) => f.valorTotal === t.mayorValor.valorTotal) : -1;
  return {
    filas: t.filas.map((f, i) => ({ factor: f.factor, precioCarga: f.precioCarga, precioKg: f.precioKg, kilos: f.kilos, cargas: f.numeroCargas, total: f.valorTotal, diferencia: f.diferencia, esMayor: i === idxMayor })),
    mayorValor: t.mayorValor ? { factor: t.mayorValor.factor, total: t.mayorValor.valorTotal } : null,
  };
}

module.exports = { calculate, compare };
