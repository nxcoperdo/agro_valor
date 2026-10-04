const env = require('../config/env');
const fetchWithTimeout = require('../utils/fetchWithTimeout');
const cocoaReferenceRepository = require('../repositories/cocoaReferenceRepository');
const logger = require('../utils/logger');
const { extractCocoaWeeks } = require('../utils/agronetCocoaExtractor');
const { toIso } = require('../utils/datetime');

/** Más de 10 días sin una semana nueva: Agronet dejó de publicar o la lectura está fallando. */
const STALE_AFTER_DAYS = 10;

async function refresh() {
  try {
    const res = await fetchWithTimeout(
      env.cocoaReferenceUrl,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'es-CO,es;q=0.9',
        },
      },
      20000
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const weeks = extractCocoaWeeks(await res.text());
    if (weeks.length === 0) {
      throw new Error('No se encontró la tabla de precios (la estructura de la página pudo haber cambiado)');
    }

    cocoaReferenceRepository.upsertMany(weeks, env.cocoaReferenceUrl);
    logger.info(
      `Referencia semanal del cacao (Agronet) actualizada: ${weeks[0].priceCopKg} COP/kg, ${weeks[0].weekLabel} (${weeks.length} semanas)`
    );
  } catch (err) {
    const cause = err.cause ? ` — causa: ${err.cause.code || err.cause.message || err.cause}` : '';
    logger.warn(`cocoaReferenceService: no se pudo actualizar (${err.message}${cause}). Se conserva el último valor conocido.`);
  }
  return cocoaReferenceRepository.latest();
}

/** Última semana publicada, ya con la forma que consumen las rutas. */
function getLatest() {
  const row = cocoaReferenceRepository.latest();
  if (!row) return null;

  const weekEndMs = new Date(`${row.week_end}T23:59:59-05:00`).getTime();
  return {
    priceCopKg: row.price_cop_kg,
    weekLabel: row.week_label,
    weekEnd: row.week_end,
    scrapedAt: toIso(row.scraped_at),
    sourceUrl: row.source_url,
    isStale: Date.now() - weekEndMs > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000,
  };
}

module.exports = { refresh, getLatest };
