const priceReportRepository = require('../repositories/priceReportRepository');
const cooperativeRepository = require('../repositories/cooperativeRepository');

/** Días hacia atrás que se consideran vigentes para un reporte. */
const FRESH_DAYS = 3;
/** Reportes de personas distintas necesarios para confiar en el dato por encima de la estimación. */
const MIN_REPORTERS = 2;
/** Tope de reportes por usuario al día, para que nadie pueda inflar el promedio. */
const MAX_REPORTS_PER_DAY = 10;

const LIMITS = { min: 100000, max: 20000000 };

function createReport(userId, { cooperativeId, municipality, priceCopCarga, factor, humidity, reportedForDate }) {
  const price = parseFloat(priceCopCarga);

  if (!Number.isFinite(price) || price < LIMITS.min || price > LIMITS.max) {
    throw Object.assign(
      new Error('El precio reportado no parece válido. Debe estar en pesos por carga de 125 kg.'),
      { status: 400 }
    );
  }

  const coop = cooperativeRepository.findById(cooperativeId);
  if (!coop) {
    throw Object.assign(new Error('Cooperativa no encontrada'), { status: 400 });
  }

  if (priceReportRepository.countToday(userId) >= MAX_REPORTS_PER_DAY) {
    throw Object.assign(new Error('Ya registraste varios reportes hoy. Intenta de nuevo mañana.'), { status: 429 });
  }

  return priceReportRepository.create({
    userId,
    cooperativeId: coop.id,
    municipality: municipality || coop.municipality || coop.region || null,
    priceCopCarga: price,
    factor: factor != null ? parseFloat(factor) : null,
    humidity: humidity != null ? parseFloat(humidity) : null,
    reportedForDate: reportedForDate || new Date().toISOString().slice(0, 10),
  });
}

/** Mapa cooperativa -> precio reportado confiable (o nada si aún no hay suficientes reportes). */
function getVerifiedPrices() {
  const rows = priceReportRepository.aggregateRecent(FRESH_DAYS);
  const map = new Map();

  rows.forEach((row) => {
    if (row.reporter_count >= MIN_REPORTERS) {
      map.set(row.cooperative_id, {
        priceCopCarga: row.avg_price,
        reportCount: row.report_count,
        reporterCount: row.reporter_count,
        latestDate: row.latest_date,
      });
    }
  });

  return map;
}

function getMyReports(userId) {
  return priceReportRepository.findByUser(userId);
}

module.exports = { createReport, getVerifiedPrices, getMyReports, FRESH_DAYS, MIN_REPORTERS };
