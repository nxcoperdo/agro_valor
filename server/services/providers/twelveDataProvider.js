const env = require('../../config/env');
const fetchWithTimeout = require('../../utils/fetchWithTimeout');

const PROVIDER_NAME = 'twelvedata';
// Símbolo de futuro continuo de café (Coffee C) en la convención de Twelve Data.
const SYMBOL = 'KC1:COM';

function isConfigured() {
  return Boolean(env.twelveDataApiKey);
}

async function fetchLatestPrice() {
  if (!isConfigured()) {
    throw new Error('twelveDataProvider no configurado (falta TWELVE_DATA_API_KEY)');
  }

  const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(SYMBOL)}&apikey=${env.twelveDataApiKey}`;
  const res = await fetchWithTimeout(url);

  if (!res.ok) {
    throw new Error(`twelveDataProvider: HTTP ${res.status}`);
  }

  const data = await res.json();

  if (data.status === 'error' || data.code) {
    throw new Error(`twelveDataProvider: ${data.message || 'respuesta con error'}`);
  }

  const price = parseFloat(data.price);
  if (!Number.isFinite(price)) {
    throw new Error('twelveDataProvider: payload inesperado, no se pudo leer el precio');
  }

  return { price, currency: 'USD', unit: 'cents_per_lb', provider: PROVIDER_NAME };
}

module.exports = { fetchLatestPrice, isConfigured, name: PROVIDER_NAME };
