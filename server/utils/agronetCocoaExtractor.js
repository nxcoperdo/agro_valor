const cheerio = require('cheerio');

const MONTHS = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

/** Quita espacios de ancho cero, &nbsp; y espacios repetidos que trae el HTML de Agronet. */
function clean(text) {
  return String(text || '')
    .replace(/[​-‍﻿]/g, '')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * La fecha de la semana viene como "28 al 4 de octubre de 2026" o "30 de agosto al 05 de
 * septiembre de 2021" (cruza de mes). El fin de semana es siempre el ÚLTIMO "D de mes de AAAA".
 */
function parseWeekEnd(label) {
  const matches = [...label.toLowerCase().matchAll(/(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)\s+(?:de\s+)?(\d{4})/g)];
  const last = matches[matches.length - 1];
  if (!last) return null;

  const month = MONTHS[last[2]];
  if (!month) return null;

  const day = parseInt(last[1], 10);
  const year = parseInt(last[3], 10);
  if (day < 1 || day > 31) return null;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * "$14.826,30/kg" -> 14826.3. Agronet mezcla formatos: casi siempre punto de miles y coma
 * decimal, pero algunas filas viejas usan punto también como decimal ("$33.968.30"). Si no hay
 * coma y el último grupo tiene exactamente 2 dígitos, ese punto es el decimal.
 */
function parsePrice(text) {
  const match = clean(text).match(/\$?\s*(\d[\d.]*(?:,\d+)?)/);
  if (!match) return null;

  let raw = match[1].replace(/\.+$/, '');
  if (raw.includes(',')) {
    raw = raw.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})*\.\d{1,2}$/.test(raw)) {
    const lastDot = raw.lastIndexOf('.');
    raw = raw.slice(0, lastDot).replace(/\./g, '') + raw.slice(lastDot);
  } else {
    raw = raw.replace(/\./g, '');
  }

  const value = parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * Extrae del HTML público de Agronet la tabla "Fecha | Precio" del precio de referencia semanal
 * del cacao (COP por kilo). Devuelve las semanas, de la más reciente a la más antigua, y omite
 * las filas que no se puedan leer. Sin dependencias de base de datos, como fncPriceExtractor.
 */
function extractCocoaWeeks(html) {
  const $ = cheerio.load(html);
  const weeks = [];

  $('table tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length < 2) return;

    const weekLabel = clean($(cells[0]).text());
    const weekEnd = parseWeekEnd(weekLabel);
    const priceCopKg = parsePrice($(cells[1]).text());

    // Un precio de cacao por debajo de $1.000/kg o por encima de $200.000/kg no es creíble.
    if (!weekEnd || priceCopKg == null || priceCopKg < 1000 || priceCopKg > 200000) return;
    weeks.push({ weekEnd, weekLabel, priceCopKg });
  });

  return weeks;
}

module.exports = { extractCocoaWeeks, parseWeekEnd, parsePrice };
