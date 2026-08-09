const CARGA_KG = 125;
const LB_PER_KG = 2.2046226218;
const LB_PER_CARGA = CARGA_KG * LB_PER_KG;

/** Un saco de exportación son 70 kg de café excelso. */
const SACO_EXCELSO_KG = 70;
/** Factor de rendimiento base: kg de pergamino seco necesarios para un saco de 70 kg de excelso. */
const BASE_FACTOR = 94;

function centsToUsdPerLb(cents) {
  return cents / 100;
}

function usdPerLbToCop(usdPerLb, rate) {
  return usdPerLb * rate;
}

function copPerCargaToUsdPerLb(copPerCarga, rate) {
  return copPerCarga / rate / LB_PER_CARGA;
}

/**
 * Cuánto café EXCELSO exportable sale de una carga de pergamino seco.
 *
 * Es la conversión que hace comparable la cotización internacional con el precio
 * que recibe el caficultor: la bolsa de Nueva York cotiza café verde/excelso, pero
 * el caficultor vende pergamino, y 125 kg de pergamino no son 125 kg de excelso.
 * Con factor 94, una carga rinde unos 93 kg (≈205 lb), no 275 lb.
 */
function cargaToExcelsoLb(factor = BASE_FACTOR) {
  const safeFactor = Number.isFinite(factor) && factor > 0 ? factor : BASE_FACTOR;
  const excelsoKg = SACO_EXCELSO_KG * (CARGA_KG / safeFactor);
  return excelsoKg * LB_PER_KG;
}

/**
 * Paridad de exportación: cuánto valdría en pesos una carga si se liquidara contra
 * la bolsa de Nueva York. Es una referencia teórica de mercado, NO una oferta de
 * compra: el precio que realmente pagan las cooperativas lo fija la FNC.
 *
 * Se suma una prima porque los suaves colombianos se cotizan por encima del
 * contrato "C"; esa prima se expone en la respuesta para que quede a la vista.
 */
function exportParityCopPerCarga({ usdPerLb, exchangeRate, factor = BASE_FACTOR, premiumUsdPerLb = 0 }) {
  if (!Number.isFinite(usdPerLb) || !Number.isFinite(exchangeRate)) return null;

  const lbExcelso = cargaToExcelsoLb(factor);
  return (usdPerLb + premiumUsdPerLb) * lbExcelso * exchangeRate;
}

module.exports = {
  centsToUsdPerLb,
  usdPerLbToCop,
  copPerCargaToUsdPerLb,
  cargaToExcelsoLb,
  exportParityCopPerCarga,
  LB_PER_CARGA,
  CARGA_KG,
  BASE_FACTOR,
  SACO_EXCELSO_KG,
};
