const supplierRepository = require('../repositories/supplierRepository');
const auditService = require('./auditService');

const ID_TYPES = ['CC', 'NIT', 'CE', 'PASAPORTE', 'OTRO'];
const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });
const clean = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim());

function normalize(input) {
  const idType = String(input.idType || 'CC').toUpperCase();
  if (!ID_TYPES.includes(idType)) throw fail('Tipo de identificación inválido');
  const idNumber = clean(input.idNumber);
  const name = clean(input.name);
  if (!idNumber) throw fail('El número de identificación es obligatorio');
  if (!name) throw fail('El nombre del proveedor es obligatorio');
  return {
    idType,
    idNumber: idNumber.replace(/[\s.]/g, ''),
    name,
    legalName: clean(input.legalName),
    phone: clean(input.phone),
    address: clean(input.address),
    municipality: clean(input.municipality),
    notes: clean(input.notes),
  };
}

function serialize(row) {
  return row && {
    id: row.id,
    idType: row.id_type,
    idNumber: row.id_number,
    name: row.name,
    legalName: row.legal_name,
    phone: row.phone,
    address: row.address,
    municipality: row.municipality,
    notes: row.notes,
  };
}

/** Crea el proveedor; si ya existe esa identificación responde 409 con el existente. */
function create(ctx, input) {
  const data = normalize(input);
  const existing = supplierRepository.findByIdentification(ctx.businessId, data.idType, data.idNumber);
  if (existing) {
    throw Object.assign(fail(`Ya existe un proveedor con ${data.idType} ${data.idNumber}: ${existing.name}`, 409), {
      supplier: serialize(existing),
    });
  }
  const row = supplierRepository.create(ctx.businessId, data);
  auditService.log({ businessId: ctx.businessId, userId: ctx.userId, action: 'CREAR', entity: 'supplier', entityId: row.id });
  return serialize(row);
}

/** Usado al comprar: por id, o por identificación (reusa si existe, crea si no). */
function resolveForPurchase(ctx, { supplierId, supplier }) {
  if (supplierId != null && supplierId !== '') {
    const row = supplierRepository.findById(ctx.businessId, Number(supplierId));
    if (!row) throw fail('Proveedor no encontrado', 404);
    return row;
  }
  if (!supplier) throw fail('Selecciona o crea un proveedor');
  const data = normalize(supplier);
  const existing = supplierRepository.findByIdentification(ctx.businessId, data.idType, data.idNumber);
  if (existing) return existing;
  const row = supplierRepository.create(ctx.businessId, data);
  auditService.log({ businessId: ctx.businessId, userId: ctx.userId, action: 'CREAR', entity: 'supplier', entityId: row.id });
  return row;
}

function search(ctx, query) {
  return supplierRepository.search(ctx.businessId, String(query || '').trim()).map(serialize);
}

module.exports = { create, search, resolveForPurchase, serialize };
