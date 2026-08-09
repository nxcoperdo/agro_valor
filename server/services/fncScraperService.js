const cheerio = require('cheerio');
const env = require('../config/env');
const fetchWithTimeout = require('../utils/fetchWithTimeout');
const fncReferenceRepository = require('../repositories/fncReferenceRepository');
const logger = require('../utils/logger');

/**
 * Extrae el precio interno de referencia (COP/carga de 125kg) del HTML público de la FNC.
 * El selector busca cualquier texto que mencione "precio" cerca de un número con formato
 * de pesos colombianos (ej. "$ 2.150.000"), ya que la estructura exacta de la página
 * puede cambiar. Si no se encuentra, se lanza un error y el último valor cacheado se conserva.
 */
function extractPriceFromHtml(html) {
  const $ = cheerio.load(html);
  const bodyText = $('body').text();

  const match = bodyText.match(/precio[^$]{0,80}\$\s?([\d.,]{5,})/i) || bodyText.match(/\$\s?([\d.,]{7,})/);

  if (!match) return null;

  const numeric = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(numeric) || numeric < 100000) return null;

  return { price: numeric, rawLabel: match[0].trim().slice(0, 200) };
}

async function refresh() {
  try {
    const res = await fetchWithTimeout(env.fncSourceUrl, {}, 8000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const extracted = extractPriceFromHtml(html);

    if (!extracted) {
      throw new Error('No se pudo extraer el precio del HTML (estructura de la página pudo haber cambiado)');
    }

    const saved = fncReferenceRepository.insert({
      priceCopCarga: extracted.price,
      sourceUrl: env.fncSourceUrl,
      rawLabel: extracted.rawLabel,
    });

    logger.info(`Precio interno de referencia FNC actualizado: ${extracted.price} COP/carga`);
    return saved;
  } catch (err) {
    logger.warn(`fncScraperService: no se pudo actualizar el precio FNC (${err.message}). Se conserva el último valor conocido.`);
    return fncReferenceRepository.latest();
  }
}

function getLatest() {
  return fncReferenceRepository.latest();
}

module.exports = { refresh, getLatest, extractPriceFromHtml };
