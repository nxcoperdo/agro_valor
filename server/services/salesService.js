const saleRepository = require('../repositories/saleRepository');
const cooperativeRepository = require('../repositories/cooperativeRepository');

function recordSale(userId, { cooperativeId, cargas, priceCopCarga, factor, humidity, soldOn, notes }) {
  const parsedCargas = parseFloat(cargas);
  const parsedPrice = parseFloat(priceCopCarga);

  if (!Number.isFinite(parsedCargas) || parsedCargas <= 0) {
    throw Object.assign(new Error('La cantidad de cargas debe ser mayor a cero'), { status: 400 });
  }

  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    throw Object.assign(new Error('El precio por carga debe ser mayor a cero'), { status: 400 });
  }

  const coop = cooperativeId ? cooperativeRepository.findById(cooperativeId) : null;

  return saleRepository.create({
    userId,
    cooperativeId: coop ? coop.id : null,
    cooperativeName: coop ? coop.name : null,
    cargas: parsedCargas,
    priceCopCarga: parsedPrice,
    factor: factor != null && factor !== '' ? parseFloat(factor) : null,
    humidity: humidity != null && humidity !== '' ? parseFloat(humidity) : null,
    soldOn: soldOn || new Date().toISOString().slice(0, 10),
    notes: notes || null,
  });
}

/**
 * Historial con el contexto de mercado de cada venta: compara lo que recibió el
 * caficultor contra el precio de referencia vigente ese día. Es la forma de
 * mostrarle si la herramienta le está sirviendo o no.
 */
function getHistory(userId) {
  const sales = saleRepository.findByUser(userId);

  const enriched = sales.map((sale) => {
    const reference = saleRepository.referencePriceOn(sale.sold_on);
    const referencePrice = reference ? reference.price_cop_carga : null;

    return {
      id: sale.id,
      cooperativeName: sale.cooperative_name,
      cargas: sale.cargas,
      priceCopCarga: sale.price_cop_carga,
      factor: sale.factor,
      humidity: sale.humidity,
      soldOn: sale.sold_on,
      notes: sale.notes,
      total: sale.cargas * sale.price_cop_carga,
      referencePriceCopCarga: referencePrice,
      vsReference: referencePrice != null ? sale.price_cop_carga - referencePrice : null,
      vsReferencePct: referencePrice != null ? ((sale.price_cop_carga - referencePrice) / referencePrice) * 100 : null,
    };
  });

  const summary = saleRepository.summary(userId);
  const comparable = enriched.filter((s) => s.vsReference != null);
  const totalVsReference = comparable.reduce((acc, s) => acc + s.vsReference * s.cargas, 0);

  return {
    sales: enriched,
    summary: {
      salesCount: summary.sales_count,
      totalCargas: summary.total_cargas,
      totalIncome: summary.total_income,
      avgPrice: summary.avg_price,
      totalVsReference,
      comparableCount: comparable.length,
    },
  };
}

function deleteSale(userId, id) {
  const changes = saleRepository.remove(id, userId);
  if (!changes) {
    throw Object.assign(new Error('Venta no encontrada'), { status: 404 });
  }
}

module.exports = { recordSale, getHistory, deleteSale };
