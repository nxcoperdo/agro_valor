const CARGA_KG = 125;
const LB_PER_KG = 2.2046226218;
const LB_PER_CARGA = CARGA_KG * LB_PER_KG;

function centsToUsdPerLb(cents) {
  return cents / 100;
}

function usdPerLbToCop(usdPerLb, rate) {
  return usdPerLb * rate;
}

function copPerCargaToUsdPerLb(copPerCarga, rate) {
  return copPerCarga / rate / LB_PER_CARGA;
}

module.exports = { centsToUsdPerLb, usdPerLbToCop, copPerCargaToUsdPerLb, LB_PER_CARGA };
