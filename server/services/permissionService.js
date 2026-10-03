/** Permisos por rol del negocio. El operador registra compras y pesadas pero no ve costos ni utilidad. */
const PERMISSIONS = {
  admin: ['registrar', 'ver_costos', 'ver_margenes', 'ver_rentabilidad', 'anular', 'cerrar_jornada', 'gestionar_lotes', 'vender', 'gestionar_equipo'],
  operador: ['registrar'],
  contador: ['ver_costos', 'ver_margenes', 'ver_rentabilidad'],
};

function can(role, permission) {
  return (PERMISSIONS[role] || []).includes(permission);
}

function assert(role, permission) {
  if (!can(role, permission)) {
    throw Object.assign(new Error('No tienes permiso para esta acción'), { status: 403 });
  }
}

/** Quita campos sensibles de una fila/objeto si el rol no puede verlos. */
function stripFields(role, permission, obj, fields) {
  if (can(role, permission)) return obj;
  const copy = { ...obj };
  fields.forEach((f) => delete copy[f]);
  return copy;
}

module.exports = { PERMISSIONS, can, assert, stripFields };
