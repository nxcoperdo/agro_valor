const { getMarket } = require('../config/markets');
const { numberInRange } = require('../utils/inputs');

/**
 * Calculadora de precio neto para el cacaotero.
 *
 * Parte del precio de referencia semanal de Agronet (lo que paga la industria, en COP/kg). Si
 * todavía no hay dato de Agronet, usa de respaldo la cotización internacional (ICE, USD/t)
 * convertida con la TRM del día por la fracción que suele llegar al productor
 * (`farmgateFactor`, un supuesto). Sobre esa referencia:
 *  - Humedad: el cacao seco se transa al 7%; más agua es peso que se paga sin ser cacao.
 *    Se corrige a masa seca equivalente: (100 - humedad) / (100 - 7).
 *  - Grano defectuoso (violeta, pizarroso, mohoso, germinado): proporción no aprovechable.
 *  - Fermentación: el cacao sin fermentar se castiga (FERMENTATION_FACTOR).
 *  - Descuento del comprador: porcentaje adicional que aplique el punto de compra.
 *  - Transporte: COP por kilo hasta el punto de compra, restado al final.
 *
 * Es una estimación, no la tabla de ninguna comercializadora.
 */

const BASE_HUMIDITY = 7;
const UNFERMENTED_FACTOR = 0.9;

const LIMITS = {
  kg: { min: 0, max: 1000000 },
  humidity: { min: 0, max: 30 },
  defectPct: { min: 0, max: 40 },
  buyerDiscountPct: { min: 0, max: 50 },
  transport: { min: 0, max: 100000 },
};

function toNumber(value, fallback) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * @param {object} input
 * @param {number} [input.referenceCopPerKg] Precio de referencia de Agronet en COP/kg.
 * @param {number} [input.iceCopPerKg] Cotización ICE ya convertida a COP/kg (solo respaldo).
 * @param {number} [input.kg] Kilos a vender.
 * @param {number} [input.humidity] Humedad en porcentaje.
 * @param {number} [input.defectPct] Porcentaje de grano defectuoso.
 * @param {boolean} [input.fermented] Si el cacao está fermentado (por defecto sí).
 * @param {number} [input.buyerDiscountPct] Descuento adicional del comprador.
 * @param {number} [input.transportCostCopKg] Transporte por kilo.
 */
function calculate(input = {}) {
  const agronetCopPerKg = toNumber(input.referenceCopPerKg, 0);
  const iceCopPerKg = toNumber(input.iceCopPerKg, 0);
  if (!(agronetCopPerKg > 0) && !(iceCopPerKg > 0)) {
    throw Object.assign(new Error('Se necesita un precio de referencia válido para calcular'), { status: 400 });
  }

  const market = getMarket('cocoa');
  const kg = numberInRange(input.kg, 'Los kilos', LIMITS.kg, 0);
  const humidity = numberInRange(input.humidity, 'La humedad', LIMITS.humidity, BASE_HUMIDITY);
  const defectPct = numberInRange(input.defectPct, 'El grano defectuoso', LIMITS.defectPct, 0);
  const buyerDiscountPct = numberInRange(input.buyerDiscountPct, 'El descuento del comprador', LIMITS.buyerDiscountPct, 0);
  const transport = numberInRange(input.transportCostCopKg, 'El transporte', LIMITS.transport, 0);
  const fermented = input.fermented !== false && input.fermented !== 'false';

  const referenceSource = agronetCopPerKg > 0 ? 'agronet' : 'ice';
  const referenceCopPerKg = agronetCopPerKg > 0 ? agronetCopPerKg : iceCopPerKg * market.farmgateFactor;
  // Más seco que la base no se paga de más: solo se descuenta el agua que sobra.
  const humidityFactor = Math.min((100 - humidity) / (100 - BASE_HUMIDITY), 1);
  const defectFactor = 1 - defectPct / 100;
  const fermentationFactor = fermented ? 1 : UNFERMENTED_FACTOR;
  const discountFactor = 1 - buyerDiscountPct / 100;

  const adjusted = referenceCopPerKg * humidityFactor * defectFactor * fermentationFactor * discountFactor;
  const netCopPerKg = Math.max(adjusted - transport, 0);

  return {
    referenceSource,
    iceCopPerKg: iceCopPerKg > 0 ? iceCopPerKg : null,
    farmgateFactor: referenceSource === 'ice' ? market.farmgateFactor : null,
    referenceCopPerKg,
    adjustments: {
      humidityLossCopPerKg: referenceCopPerKg * (1 - Math.min(humidityFactor, 1)),
      humidityBonusCopPerKg: referenceCopPerKg * Math.max(humidityFactor - 1, 0),
      defectLossCopPerKg: referenceCopPerKg * humidityFactor * (1 - defectFactor),
      fermentationLossCopPerKg: referenceCopPerKg * humidityFactor * defectFactor * (1 - fermentationFactor),
      buyerDiscountCopPerKg: referenceCopPerKg * humidityFactor * defectFactor * fermentationFactor * (1 - discountFactor),
      transportCopPerKg: transport,
    },
    netCopPerKg,
    kg,
    totalCop: netCopPerKg * kg,
    inputs: { humidity, defectPct, fermented, buyerDiscountPct, transportCostCopKg: transport },
  };
}

module.exports = { calculate, BASE_HUMIDITY, UNFERMENTED_FACTOR };
