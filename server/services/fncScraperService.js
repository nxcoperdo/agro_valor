const env = require('../config/env');
const fetchWithTimeout = require('../utils/fetchWithTimeout');
const fncReferenceRepository = require('../repositories/fncReferenceRepository');
const logger = require('../utils/logger');
const { extractPriceFromHtml } = require('../utils/fncPriceExtractor');

async function refresh() {
  try {
    const res = await fetchWithTimeout(
      env.fncSourceUrl,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-CO,es;q=0.9',
        },
      },
      15000
    );
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
    const cause = err.cause ? ` — causa: ${err.cause.code || err.cause.message || err.cause}` : '';
    logger.warn(`fncScraperService: no se pudo actualizar el precio FNC (${err.message}${cause}). Se conserva el último valor conocido.`);
    return fncReferenceRepository.latest();
  }
}

function getLatest() {
  return fncReferenceRepository.latest();
}

module.exports = { refresh, getLatest, extractPriceFromHtml };
