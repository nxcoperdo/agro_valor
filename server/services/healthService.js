const db = require('../db/connection');
const coffeePriceRepository = require('../repositories/coffeePriceRepository');
const fncReferenceRepository = require('../repositories/fncReferenceRepository');

/** Un precio sin refrescarse en este tiempo indica que los proveedores o el workflow dejaron de funcionar. */
const STALE_AFTER_HOURS = 72;

// SQLite guarda datetime('now') en UTC y sin zona ("2026-10-26 14:00:00").
const toDate = (sqliteDate) => (sqliteDate ? new Date(`${sqliteDate.replace(' ', 'T')}Z`) : null);

function ageHours(sqliteDate, now) {
  const date = toDate(sqliteDate);
  return date ? Math.round(((now - date) / 3600000) * 10) / 10 : null;
}

function describe(label, sqliteDate, now) {
  const hours = ageHours(sqliteDate, now);
  return { label, at: sqliteDate || null, ageHours: hours, stale: hours == null || hours > STALE_AFTER_HOURS };
}

/**
 * Estado para vigilancia externa (UptimeRobot, etc.). "error" = la base no responde (503);
 * "degraded" = responde pero algún dato lleva demasiado sin actualizarse.
 */
function check(now = new Date()) {
  try {
    db.prepare('SELECT 1').get();
  } catch {
    return { status: 'error', database: false };
  }

  const sources = [
    describe('Precio del café', coffeePriceRepository.latest('coffee')?.fetched_at, now),
    describe('Precio del cacao', coffeePriceRepository.latest('cocoa')?.fetched_at, now),
    describe('Referencia FNC', fncReferenceRepository.latest()?.scraped_at, now),
  ];

  return {
    status: sources.some((s) => s.stale) ? 'degraded' : 'ok',
    database: true,
    checkedAt: now.toISOString(),
    staleAfterHours: STALE_AFTER_HOURS,
    sources,
  };
}

module.exports = { check, STALE_AFTER_HOURS };
