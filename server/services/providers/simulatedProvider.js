const env = require('../../config/env');
const randomWalk = require('../../utils/randomWalk');

const VOLATILITY = 0.004;
const MEAN_REVERSION = 0.02;

/** Random walk con reversión a la media, usado como respaldo cuando no hay precio real disponible. */
function fetchLatestPrice(lastPrice) {
  const price = randomWalk({
    last: lastPrice,
    basePrice: env.coffeeBasePriceCents,
    volatility: VOLATILITY,
    meanReversion: MEAN_REVERSION,
  });

  return {
    price,
    currency: 'USD',
    unit: 'cents_per_lb',
    provider: null,
  };
}

module.exports = { fetchLatestPrice, name: 'simulated' };
