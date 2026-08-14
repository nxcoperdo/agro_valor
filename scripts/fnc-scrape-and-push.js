#!/usr/bin/env node
/**
 * Corre desde GitHub Actions (no desde el VPS): el VPS tiene su rango de IPs
 * bloqueado por federaciondecafeteros.org, pero los runners de GitHub no.
 * Scrapea el precio interno de referencia y lo empuja al endpoint protegido
 * del servidor, así el valor se actualiza solo sin copiar/pegar nada a mano.
 *
 * Variables de entorno requeridas:
 *   FNC_SOURCE_URL   - página pública de la FNC a scrapear
 *   VPS_BASE_URL     - ej. https://agrovalor.example.com (sin slash final)
 *   FNC_INGEST_TOKEN - debe coincidir con el configurado en el .env del VPS
 */
const { extractPriceFromHtml } = require('../server/utils/fncPriceExtractor');

const FNC_SOURCE_URL = process.env.FNC_SOURCE_URL || 'https://federaciondecafeteros.org/estadisticas-cafeteras/';
const VPS_BASE_URL = process.env.VPS_BASE_URL;
const FNC_INGEST_TOKEN = process.env.FNC_INGEST_TOKEN;

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  if (!VPS_BASE_URL || !FNC_INGEST_TOKEN) {
    throw new Error('Faltan VPS_BASE_URL o FNC_INGEST_TOKEN en el entorno');
  }

  const res = await fetchWithTimeout(
    FNC_SOURCE_URL,
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
  if (!res.ok) throw new Error(`HTTP ${res.status} al pedir ${FNC_SOURCE_URL}`);

  const html = await res.text();
  const extracted = extractPriceFromHtml(html);
  if (!extracted) {
    throw new Error('No se pudo extraer el precio del HTML (la estructura de la página pudo haber cambiado)');
  }

  const pushRes = await fetchWithTimeout(
    `${VPS_BASE_URL}/api/internal/fnc-price`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${FNC_INGEST_TOKEN}`,
      },
      body: JSON.stringify({
        priceCopCarga: extracted.price,
        sourceUrl: FNC_SOURCE_URL,
        rawLabel: extracted.rawLabel,
      }),
    },
    15000
  );

  const body = await pushRes.json().catch(() => ({}));
  if (!pushRes.ok) {
    throw new Error(`El servidor rechazó el precio (HTTP ${pushRes.status}): ${JSON.stringify(body)}`);
  }

  console.log(`Precio FNC actualizado: ${extracted.price} COP/carga (${extracted.rawLabel})`);
}

main().catch((err) => {
  console.error(`fnc-scrape-and-push: ${err.message}`);
  process.exit(1);
});
