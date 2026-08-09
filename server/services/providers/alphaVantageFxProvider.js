const env = require('../../config/env');
const fetchWithTimeout = require('../../utils/fetchWithTimeout');

const PROVIDER_NAME = 'alphavantage';

function isConfigured() {
  return Boolean(env.alphaVantageApiKey);
}

async function fetchLatestRate() {
  if (!isConfigured()) {
    throw new Error('alphaVantageFxProvider no configurado (falta ALPHA_VANTAGE_API_KEY)');
  }

  const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=USD&to_currency=COP&apikey=${env.alphaVantageApiKey}`;
  const res = await fetchWithTimeout(url);

  if (!res.ok) {
    throw new Error(`alphaVantageFxProvider: HTTP ${res.status}`);
  }

  const data = await res.json();
  const payload = data['Realtime Currency Exchange Rate'];

  if (!payload) {
    throw new Error(`alphaVantageFxProvider: ${data.Note || data.Information || 'respuesta con error'}`);
  }

  const rate = parseFloat(payload['5. Exchange Rate']);
  if (!Number.isFinite(rate)) {
    throw new Error('alphaVantageFxProvider: payload inesperado, no se pudo leer la tasa');
  }

  return { rate, provider: PROVIDER_NAME };
}

module.exports = { fetchLatestRate, isConfigured, name: PROVIDER_NAME };
