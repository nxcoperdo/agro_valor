/**
 * Calculadora de precio neto para el caficultor.
 *
 * El precio interno de referencia de la FNC está definido para café pergamino seco
 * de FACTOR DE RENDIMIENTO 94 y 12% de humedad, por carga de 125 kg. Casi ningún
 * café cumple exactamente esas condiciones, así que lo que realmente le pagan al
 * caficultor sale de ajustar ese precio por la calidad de SU café y de descontarle
 * lo que le cuesta llevarlo hasta el punto de compra.
 *
 * Ajustes aplicados:
 *  - Factor de rendimiento: el factor son los kg de pergamino necesarios para sacar
 *    un saco de 70 kg de café excelso. A menor factor, mejor rendimiento y mayor
 *    valor, en proporción inversa: valor ∝ 1 / factor.
 *  - Humedad: por encima del 12% se está pagando agua, no café. Se corrige a masa
 *    seca equivalente: (100 - humedad) / (100 - 12).
 *  - Pasilla (grano defectuoso): se descuenta como proporción no aprovechable.
 *  - Transporte: costo por carga hasta el punto de compra, restado al final.
 *
 * Es una estimación cercana a la práctica comercial, no la tabla oficial de ninguna
 * cooperativa: cada punto de compra aplica sus propios castigos y bonificaciones.
 */

const { CARGA_KG } = require('../utils/currency');

const BASE_FACTOR = 94;
const BASE_HUMIDITY = 12;

const LIMITS = {
  factor: { min: 60, max: 140 },
  humidity: { min: 0, max: 30 },
  pasillaPct: { min: 0, max: 40 },
  cargas: { min: 0, max: 10000 },
  transport: { min: 0, max: 1000000 },
};

function clamp(value, { min, max }) {
  return Math.min(Math.max(value, min), max);
}

function toNumber(value, fallback) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * @param {object} input
 * @param {number} input.basePriceCopCarga Precio de referencia (o el de la cooperativa elegida).
 * @param {number} [input.factor] Factor de rendimiento del café del usuario.
 * @param {number} [input.humidity] Humedad en porcentaje.
 * @param {number} [input.pasillaPct] Porcentaje de pasilla.
 * @param {number} [input.cargas] Cantidad de cargas a vender.
 * @param {number} [input.transportCostCopCarga] Costo de transporte por carga.
 */
function calculate(input = {}) {
  const basePrice = toNumber(input.basePriceCopCarga, 0);

  if (!(basePrice > 0)) {
    throw Object.assign(new Error('Se necesita un precio base válido para calcular'), { status: 400 });
  }

  const factor = clamp(toNumber(input.factor, BASE_FACTOR), LIMITS.factor);
  const humidity = clamp(toNumber(input.humidity, BASE_HUMIDITY), LIMITS.humidity);
  const pasillaPct = clamp(toNumber(input.pasillaPct, 0), LIMITS.pasillaPct);
  const cargas = clamp(toNumber(input.cargas, 1), LIMITS.cargas);
  const transportCost = clamp(toNumber(input.transportCostCopCarga, 0), LIMITS.transport);

  const factorMultiplier = BASE_FACTOR / factor;
  const humidityMultiplier = (100 - humidity) / (100 - BASE_HUMIDITY);
  const pasillaMultiplier = 1 - pasillaPct / 100;

  const afterFactor = basePrice * factorMultiplier;
  const afterHumidity = afterFactor * humidityMultiplier;
  const afterPasilla = afterHumidity * pasillaMultiplier;
  const netPerCarga = Math.max(afterPasilla - transportCost, 0);

  const breakdown = [
    {
      key: 'base',
      label: 'Precio base por carga',
      detail: 'Referencia para factor 94 y 12% de humedad',
      amount: basePrice,
      delta: 0,
    },
    {
      key: 'factor',
      label: `Ajuste por factor de rendimiento (${factor})`,
      detail:
        factor === BASE_FACTOR
          ? 'Tu café está justo en el factor base'
          : factor < BASE_FACTOR
            ? 'Tu café rinde más que el estándar: vale más'
            : 'Tu café rinde menos que el estándar: vale menos',
      amount: afterFactor,
      delta: afterFactor - basePrice,
    },
    {
      key: 'humidity',
      label: `Ajuste por humedad (${humidity}%)`,
      detail:
        humidity <= BASE_HUMIDITY
          ? 'Está en el punto de humedad o más seco'
          : 'Humedad por encima del 12%: parte del peso es agua',
      amount: afterHumidity,
      delta: afterHumidity - afterFactor,
    },
    {
      key: 'pasilla',
      label: `Descuento por pasilla (${pasillaPct}%)`,
      detail: pasillaPct === 0 ? 'Sin pasilla declarada' : 'Grano defectuoso que no se paga como excelso',
      amount: afterPasilla,
      delta: afterPasilla - afterHumidity,
    },
    {
      key: 'transport',
      label: 'Transporte hasta el punto de compra',
      detail: transportCost === 0 ? 'Sin costo de transporte declarado' : 'Costo por carga',
      amount: netPerCarga,
      delta: -Math.min(transportCost, afterPasilla),
    },
  ];

  return {
    inputs: { basePriceCopCarga: basePrice, factor, humidity, pasillaPct, cargas, transportCostCopCarga: transportCost },
    netPerCarga,
    total: netPerCarga * cargas,
    differenceVsBase: netPerCarga - basePrice,
    differenceVsBasePct: ((netPerCarga - basePrice) / basePrice) * 100,
    breakdown,
    assumptions: {
      baseFactor: BASE_FACTOR,
      baseHumidity: BASE_HUMIDITY,
      cargaKg: CARGA_KG,
    },
    disclaimer:
      'Estimación basada en la práctica comercial habitual (factor 94 y 12% de humedad como base). ' +
      'Cada punto de compra aplica sus propias tablas de castigo y bonificación, así que el valor final puede variar.',
  };
}

/** Compara el precio neto del usuario en cada cooperativa, para saber a quién conviene venderle. */
function compareAcrossCooperatives(cooperatives, input = {}) {
  return cooperatives
    .map((coop) => {
      const result = calculate({ ...input, basePriceCopCarga: coop.estimatedPriceCopCarga });
      return {
        cooperativeId: coop.id,
        name: coop.name,
        region: coop.region,
        priceSource: coop.priceSource,
        basePriceCopCarga: coop.estimatedPriceCopCarga,
        netPerCarga: result.netPerCarga,
        total: result.total,
      };
    })
    .sort((a, b) => b.netPerCarga - a.netPerCarga)
    .map((row, idx, arr) => ({
      ...row,
      rank: idx + 1,
      isBest: idx === 0,
      isWorst: idx === arr.length - 1,
      lostVsBest: arr[0].total - row.total,
    }));
}

module.exports = { calculate, compareAcrossCooperatives, BASE_FACTOR, BASE_HUMIDITY };
