const env = require('../../config/env');
const randomWalk = require('../../utils/randomWalk');

const VOLATILITY = 0.0015;
const MEAN_REVERSION = 0.03;

function fetchLatestRate(lastRate) {
  const rate = randomWalk({
    last: lastRate,
    basePrice: env.exchangeRateFallbackCop,
    volatility: VOLATILITY,
    meanReversion: MEAN_REVERSION,
    min: 1,
  });

  return { rate, provider: null };
}

module.exports = { fetchLatestRate, name: 'simulated' };
