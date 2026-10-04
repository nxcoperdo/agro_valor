const env = require('../../config/env');
const randomWalk = require('../../utils/randomWalk');

const VOLATILITY = 0.004;
const MEAN_REVERSION = 0.02;

/** Random walk con reversión a la media, usado como respaldo cuando no hay precio real disponible. */
function fetchLatestPrice(lastPrice, market = { unit: 'cents_per_lb', simulatedBase: env.coffeeBasePriceCents }) {
  const price = randomWalk({
    last: lastPrice,
    basePrice: market.simulatedBase,
    volatility: VOLATILITY,
    meanReversion: MEAN_REVERSION,
  });

  return {
    price,
    currency: 'USD',
    unit: market.unit,
    provider: null,
  };
}

module.exports = { fetchLatestPrice, name: 'simulated' };
