const cheerio = require('cheerio');

/**
 * Extrae el precio interno de referencia (COP/carga de 125kg) del HTML público de la FNC.
 * El selector busca cualquier texto que mencione "precio" cerca de un número con formato
 * de pesos colombianos (ej. "$ 2.150.000"), ya que la estructura exacta de la página
 * puede cambiar. Si no se encuentra, se devuelve null.
 *
 * Sin dependencias de la base de datos a propósito: la reutiliza tanto el scraper del
 * servidor como el script standalone que corre desde GitHub Actions.
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

module.exports = { extractPriceFromHtml };
