const env = require('../../config/env');
const fetchWithTimeout = require('../../utils/fetchWithTimeout');

const PROVIDER_NAME = 'alphavantage';

function isConfigured() {
  return Boolean(env.alphaVantageApiKey);
}

async function fetchLatestPrice() {
  if (!isConfigured()) {
    throw new Error('alphaVantageProvider no configurado (falta ALPHA_VANTAGE_API_KEY)');
  }

  // Alpha Vantage expone el precio global de café solo con granularidad mensual (no diaria).
  const url = `https://www.alphavantage.co/query?function=COFFEE&interval=monthly&apikey=${env.alphaVantageApiKey}`;
  const res = await fetchWithTimeout(url);

  if (!res.ok) {
    throw new Error(`alphaVantageProvider: HTTP ${res.status}`);
  }

  const data = await res.json();

  if (data.Note || data.Information || data['Error Message']) {
    throw new Error(`alphaVantageProvider: ${data.Note || data.Information || data['Error Message']}`);
  }

  const point = Array.isArray(data.data) ? data.data[0] : null;
  const price = point ? parseFloat(point.value) : NaN;
  if (!Number.isFinite(price)) {
    throw new Error('alphaVantageProvider: payload inesperado, no se pudo leer el precio');
  }

  return { price, currency: 'USD', unit: 'cents_per_lb', provider: PROVIDER_NAME };
}

module.exports = { fetchLatestPrice, isConfigured, name: PROVIDER_NAME };
