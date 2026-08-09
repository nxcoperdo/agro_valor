/**
 * SQLite guarda las fechas con `datetime('now')`, que devuelve UTC en formato
 * "YYYY-MM-DD HH:MM:SS", sin ninguna marca de zona horaria.
 *
 * Si ese texto se envía tal cual al navegador, `new Date(...)` lo interpreta como
 * hora LOCAL del usuario y la fecha queda corrida (en Colombia, 5 horas). Por eso
 * todo lo que sale por la API se normaliza a ISO-8601 con la Z de UTC, y el
 * navegador se encarga de mostrarlo en la hora de quien lo esté viendo.
 */
function toIso(sqliteTimestamp) {
  if (!sqliteTimestamp) return null;

  // Si ya viene en ISO (por ejemplo la hora de la bolsa), se deja igual.
  if (typeof sqliteTimestamp !== 'string' || sqliteTimestamp.includes('T')) {
    return sqliteTimestamp;
  }

  return `${sqliteTimestamp.replace(' ', 'T')}Z`;
}

/** Convierte una fecha de SQLite a milisegundos, interpretándola correctamente como UTC. */
function toEpoch(sqliteTimestamp) {
  const iso = toIso(sqliteTimestamp);
  return iso ? new Date(iso).getTime() : NaN;
}

module.exports = { toIso, toEpoch };
