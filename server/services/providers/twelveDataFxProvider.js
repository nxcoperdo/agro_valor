const env = require('../../config/env');
const fetchWithTimeout = require('../../utils/fetchWithTimeout');

const PROVIDER_NAME = 'twelvedata';
const SYMBOL = 'USD/COP';

function isConfigured() {
  return Boolean(env.twelveDataApiKey);
}

async function fetchLatestRate() {
  if (!isConfigured()) {
    throw new Error('twelveDataFxProvider no configurado (falta TWELVE_DATA_API_KEY)');
  }

  const url = `https://api.twelvedata.com/exchange_rate?symbol=${encodeURIComponent(SYMBOL)}&apikey=${env.twelveDataApiKey}`;
  const res = await fetchWithTimeout(url);

  if (!res.ok) {
    throw new Error(`twelveDataFxProvider: HTTP ${res.status}`);
  }

  const data = await res.json();

  if (data.status === 'error' || data.code) {
    throw new Error(`twelveDataFxProvider: ${data.message || 'respuesta con error'}`);
  }

  const rate = parseFloat(data.rate);
  if (!Number.isFinite(rate)) {
    throw new Error('twelveDataFxProvider: payload inesperado, no se pudo leer la tasa');
  }

  return { rate, provider: PROVIDER_NAME };
}

module.exports = { fetchLatestRate, isConfigured, name: PROVIDER_NAME };
