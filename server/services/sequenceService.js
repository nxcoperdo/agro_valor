const db = require('../db/connection');

const PREFIX = { compra: 'COMP', lote: 'AGV', jornada: 'JOR', venta: 'VTA' };

const pad = (n, width) => String(n).padStart(width, '0');

/**
 * Siguiente consecutivo atómico. UPSERT ... RETURNING es una sola sentencia, así que dos
 * peticiones concurrentes nunca reciben el mismo número (SQLite serializa las escrituras).
 */
function nextValue(businessId, key, period) {
  const row = db
    .prepare(
      `INSERT INTO sequences (business_id, key, period, last_value) VALUES (?, ?, ?, 1)
       ON CONFLICT(business_id, key, period) DO UPDATE SET last_value = last_value + 1
       RETURNING last_value`
    )
    .get(businessId, key, period);
  return row.last_value;
}

/** Fecha YYYY-MM-DD en la zona horaria del negocio (por defecto Bogotá). */
function today(now = new Date(), timeZone = 'America/Bogota') {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** COMP-AAAA-000001, AGV-AAAA-000001, VTA-AAAA-000001 */
function nextYearlyCode(businessId, key, now = new Date()) {
  const year = today(now).slice(0, 4);
  return `${PREFIX[key]}-${year}-${pad(nextValue(businessId, key, year), 6)}`;
}

/** JOR-AAAA-MM-DD-001 (consecutivo reinicia cada día) */
function nextWorkdayCode(businessId, now = new Date()) {
  const day = today(now);
  return `${PREFIX.jornada}-${day}-${pad(nextValue(businessId, 'jornada', day), 3)}`;
}

module.exports = { nextValue, nextYearlyCode, nextWorkdayCode, today };
