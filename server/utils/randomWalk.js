/** Random walk con reversión a la media, reutilizado por los providers simulados (precio café, tasa de cambio). */
function randomWalk({ last, basePrice, volatility, meanReversion, min = 0.01 }) {
  const current = Number.isFinite(last) ? last : basePrice;
  const shock = (Math.random() * 2 - 1) * volatility;
  const next = current * (1 + shock) + meanReversion * (basePrice - current);
  return Math.max(next, min);
}

module.exports = randomWalk;
