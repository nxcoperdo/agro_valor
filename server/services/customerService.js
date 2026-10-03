const db = require('../db/connection');
const auditService = require('./auditService');

const ID_TYPES = ['CC', 'NIT', 'CE', 'PASAPORTE', 'OTRO'];
const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });
const clean = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim());

function normalize(input) {
  const idType = String(input.idType || 'NIT').toUpperCase();
  if (!ID_TYPES.includes(idType)) throw fail('Tipo de identificación inválido');
  const idNumber = clean(input.idNumber);
  const name = clean(input.name);
  if (!idNumber) throw fail('El número de identificación es obligatorio');
  if (!name) throw fail('El nombre del cliente es obligatorio');
  return { idType, idNumber: idNumber.replace(/[\s.]/g, ''), name, phone: clean(input.phone), address: clean(input.address), municipality: clean(input.municipality), notes: clean(input.notes) };
}

const serialize = (r) => r && { id: r.id, idType: r.id_type, idNumber: r.id_number, name: r.name, phone: r.phone, address: r.address, municipality: r.municipality, notes: r.notes };
const byId = (businessId, id) => db.prepare('SELECT * FROM customers WHERE business_id = ? AND id = ?').get(businessId, id);
const byIdent = (businessId, t, n) => db.prepare('SELECT * FROM customers WHERE business_id = ? AND id_type = ? AND id_number = ?').get(businessId, t, n);

function insert(ctx, d) {
  const info = db
    .prepare('INSERT INTO customers (business_id, id_type, id_number, name, phone, address, municipality, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(ctx.businessId, d.idType, d.idNumber, d.name, d.phone, d.address, d.municipality, d.notes);
  auditService.log({ businessId: ctx.businessId, userId: ctx.userId, action: 'CREAR', entity: 'customer', entityId: Number(info.lastInsertRowid) });
  return byId(ctx.businessId, info.lastInsertRowid);
}

function create(ctx, input) {
  const d = normalize(input);
  const existing = byIdent(ctx.businessId, d.idType, d.idNumber);
  if (existing) throw Object.assign(fail(`Ya existe un cliente con ${d.idType} ${d.idNumber}: ${existing.name}`, 409), { supplier: serialize(existing) });
  return serialize(insert(ctx, d));
}

function resolveForSale(ctx, { customerId, customer }) {
  if (customerId != null && customerId !== '') {
    const r = byId(ctx.businessId, Number(customerId));
    if (!r) throw fail('Cliente no encontrado', 404);
    return r;
  }
  if (!customer) throw fail('Selecciona o crea un cliente');
  const d = normalize(customer);
  return byIdent(ctx.businessId, d.idType, d.idNumber) || insert(ctx, d);
}

function search(ctx, q) {
  const like = `%${String(q || '').trim()}%`;
  return db.prepare('SELECT * FROM customers WHERE business_id = ? AND (name LIKE ? OR id_number LIKE ?) ORDER BY name LIMIT 20').all(ctx.businessId, like, like).map(serialize);
}

module.exports = { create, resolveForSale, search, serialize };
