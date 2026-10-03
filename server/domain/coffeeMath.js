/**
 * Fórmulas de negocio del ciclo compra → venta de café. Funciones puras, sin acceso a BD:
 * servicios y pantallas deben calcular siempre desde aquí.
 *
 * Tres conceptos que NO se mezclan:
 *  - porcentajeMermaInicial: descuento al comprar (café verde 8%).
 *  - porcentajeRendimientoSecado: kg secos por cada 100 kg pagables (55%).
 *  - factorRendimientoTrilla: 84, 88, 90, 94... Es un factor, NO un porcentaje.
 */
const { CARGA_KG } = require('../utils/currency');

const MERMA_POR_TIPO = {
  cafe_verde: 8,
  cafe_merma_5: 5,
  cafe_sin_merma: 0,
  otro: 0,
};
const RENDIMIENTO_SECADO_DEFECTO = 55;

function num(value, field) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(n)) {
    throw Object.assign(new Error(`Valor inválido: ${field}`), { status: 400 });
  }
  return n;
}

function nonNeg(value, field) {
  const n = num(value, field);
  if (n < 0) throw Object.assign(new Error(`${field} no puede ser negativo`), { status: 400 });
  return n;
}

/** Kilos con 2 decimales. */
const roundKg = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
/** Pesos colombianos enteros. */
const roundCop = (v) => Math.round(v);
const roundPct = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

function mermaPorDefecto(tipoCafe) {
  return Object.prototype.hasOwnProperty.call(MERMA_POR_TIPO, tipoCafe) ? MERMA_POR_TIPO[tipoCafe] : 0;
}

function sumarPesadas(pesadasKg) {
  return roundKg(pesadasKg.reduce((acc, p) => acc + nonNeg(p, 'peso de la pesada'), 0));
}

function calcularPesoPagable(pesoTotalCompra, porcentajeMermaInicial) {
  const total = nonNeg(pesoTotalCompra, 'peso total');
  const merma = nonNeg(porcentajeMermaInicial, 'merma inicial');
  if (merma > 100) throw Object.assign(new Error('La merma no puede superar 100%'), { status: 400 });
  const kgDescontados = roundKg((total * merma) / 100);
  return { kgDescontados, pesoPagable: roundKg(total - kgDescontados) };
}

function precioKgDesdeCarga(precioCarga) {
  return nonNeg(precioCarga, 'precio por carga') / CARGA_KG;
}

/** Compra completa: pesadas + merma + precio por carga. */
function calcularCompra({ pesadasKg, porcentajeMermaInicial, precioCarga }) {
  const pesoTotalCompra = sumarPesadas(pesadasKg);
  const { kgDescontados, pesoPagable } = calcularPesoPagable(pesoTotalCompra, porcentajeMermaInicial);
  const precioKg = precioKgDesdeCarga(precioCarga);
  return {
    pesoTotalCompra,
    kgDescontados,
    pesoPagable,
    precioKg: roundCop(precioKg * 100) / 100,
    totalCompra: roundCop(pesoPagable * precioKg),
  };
}

function sumarCostos(costos) {
  return roundCop(costos.reduce((acc, c) => acc + nonNeg(c.valor, 'valor del costo'), 0));
}

function calcularCostoAdquisicion(totalCompra, costosAsociados) {
  return roundCop(nonNeg(totalCompra, 'total compra') + sumarCostos(costosAsociados || []));
}

function calcularKilosSecosProyectados(pesoPagable, porcentajeRendimientoSecado = RENDIMIENTO_SECADO_DEFECTO) {
  return roundKg((nonNeg(pesoPagable, 'peso pagable') * nonNeg(porcentajeRendimientoSecado, 'rendimiento de secado')) / 100);
}

/**
 * Un costo proyectado se da total o por kg seco: { valor, modo: 'total' | 'por_kg' }.
 * Por kg se multiplica por los kilos secos (ej. secado $300/kg).
 */
function costoProyectadoTotal(costo, kilosSecos) {
  const valor = nonNeg(costo.valor, 'valor del costo');
  return roundCop(costo.modo === 'por_kg' ? valor * kilosSecos : valor);
}

function calcularProyeccion({
  pesoPagable,
  totalCompra,
  costosAsociados = [],
  costosProyectados = [],
  porcentajeRendimientoSecado = RENDIMIENTO_SECADO_DEFECTO,
  destareProyectadoKg = 0,
  precioVentaCarga = null,
}) {
  const kilosSecosProyectados = calcularKilosSecosProyectados(pesoPagable, porcentajeRendimientoSecado);
  const kilosNetosProyectados = roundKg(kilosSecosProyectados - nonNeg(destareProyectadoKg, 'destare'));
  const costosProcesamiento = roundCop(
    costosProyectados.reduce((acc, c) => acc + costoProyectadoTotal(c, kilosSecosProyectados), 0)
  );
  const costoTotalProyectado = roundCop(totalCompra + sumarCostos(costosAsociados) + costosProcesamiento);
  const costoMinimoKg = kilosNetosProyectados > 0 ? costoTotalProyectado / kilosNetosProyectados : null;
  const result = {
    kilosSecosProyectados,
    kilosNetosProyectados,
    costosProcesamientoProyectados: costosProcesamiento,
    costoTotalProyectado,
    costoMinimoKg: costoMinimoKg == null ? null : roundCop(costoMinimoKg),
    costoMinimoCarga: costoMinimoKg == null ? null : roundCop(costoMinimoKg * CARGA_KG),
    precioVentaKg: null,
    ingresoProyectado: null,
    utilidadProyectada: null,
    margen: null,
  };
  if (precioVentaCarga != null && precioVentaCarga !== '') {
    const precioVentaKg = nonNeg(precioVentaCarga, 'precio de venta') / CARGA_KG;
    const ingreso = roundCop(kilosNetosProyectados * precioVentaKg);
    result.precioVentaKg = roundCop(precioVentaKg);
    result.ingresoProyectado = ingreso;
    result.utilidadProyectada = ingreso - costoTotalProyectado;
    result.margen = ingreso > 0 ? roundPct((result.utilidadProyectada / ingreso) * 100) : null;
  }
  return result;
}

/** Resultado real del secado: rendimiento sobre peso pagable, netos y costo real por kg/carga. */
function calcularResultadoReal({
  pesoPagable,
  totalCompra,
  costosCompra = [],
  costosProcesamientoReales = [],
  kilosSecosReales,
  destareRealKg = 0,
}) {
  const secos = nonNeg(kilosSecosReales, 'kilos secos reales');
  const kilosNetosReales = roundKg(secos - nonNeg(destareRealKg, 'destare real'));
  const rendimientoReal = pesoPagable > 0 ? roundPct((secos / pesoPagable) * 100) : null;
  const costoRealTotal = roundCop(totalCompra + sumarCostos(costosCompra) + sumarCostos(costosProcesamientoReales));
  const costoRealKg = kilosNetosReales > 0 ? costoRealTotal / kilosNetosReales : null;
  return {
    kilosSecosReales: roundKg(secos),
    kilosNetosReales,
    rendimientoReal,
    costoRealTotal,
    costoRealKg: costoRealKg == null ? null : roundCop(costoRealKg),
    costoRealCarga: costoRealKg == null ? null : roundCop(costoRealKg * CARGA_KG),
  };
}

/** Calculadora rápida: no crea compra. */
function calcularRapido({ kilos, precioCarga }) {
  const k = nonNeg(kilos, 'cantidad de kg');
  const precioKg = precioKgDesdeCarga(precioCarga);
  return { numeroCargas: roundKg(k / CARGA_KG), precioKg: roundCop(precioKg), valorTotal: roundCop(k * precioKg) };
}

/** Precio equivalente a otro factor, a partir de un precio de referencia que ingresa el usuario. */
function precioSegunFactor({ factorReferencia, factorEvaluado, precioReferencia }) {
  const ref = num(factorReferencia, 'factor de referencia');
  const ev = num(factorEvaluado, 'factor evaluado');
  if (ref <= 0 || ev <= 0) throw Object.assign(new Error('El factor debe ser mayor a cero'), { status: 400 });
  return roundCop((ref / ev) * nonNeg(precioReferencia, 'precio de referencia'));
}

/** Tabla comparativa por factor. La diferencia es contra la opción de menor valor. */
function compararFactores({ kilos, opciones }) {
  const filas = opciones.map((o) => {
    const r = calcularRapido({ kilos, precioCarga: o.precioCarga });
    return { factor: o.factor, precioCarga: roundCop(o.precioCarga), ...r, kilos: roundKg(kilos) };
  });
  const min = filas.length ? Math.min(...filas.map((f) => f.valorTotal)) : 0;
  const max = filas.length ? Math.max(...filas.map((f) => f.valorTotal)) : 0;
  return {
    filas: filas.map((f) => ({ ...f, diferencia: f.valorTotal - min })),
    mayorValor: filas.find((f) => f.valorTotal === max) || null,
  };
}

/** Costo de la mercancía vendida a costo unitario congelado (costo real/kg del lote). */
function calcularRentabilidadVenta({ ingresoVenta, kgVendidos, costoUnitarioKg }) {
  const costoMercanciaVendida = roundCop(nonNeg(kgVendidos, 'kg vendidos') * nonNeg(costoUnitarioKg, 'costo unitario'));
  const utilidadReal = roundCop(ingresoVenta) - costoMercanciaVendida;
  return {
    ingresoVenta: roundCop(ingresoVenta),
    costoMercanciaVendida,
    utilidadReal,
    margenReal: ingresoVenta > 0 ? roundPct((utilidadReal / ingresoVenta) * 100) : null,
  };
}

module.exports = {
  CARGA_KG,
  MERMA_POR_TIPO,
  RENDIMIENTO_SECADO_DEFECTO,
  mermaPorDefecto,
  sumarPesadas,
  calcularPesoPagable,
  precioKgDesdeCarga,
  calcularCompra,
  sumarCostos,
  calcularCostoAdquisicion,
  calcularKilosSecosProyectados,
  calcularProyeccion,
  calcularResultadoReal,
  calcularRapido,
  precioSegunFactor,
  compararFactores,
  calcularRentabilidadVenta,
  roundKg,
  roundCop,
};
