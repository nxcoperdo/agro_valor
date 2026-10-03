const businessService = require('../services/businessService');
const permissionService = require('../services/permissionService');

/** Deja req.business = { businessId, role, name }. Requiere loadUser antes. */
function requireBusiness(req, res, next) {
  try {
    req.business = businessService.ensureForUser(req.fullUser);
    next();
  } catch (err) {
    next(err);
  }
}

/** requirePermission('anular') — responde 403 si el rol del negocio no lo tiene. */
const requirePermission = (permission) => (req, res, next) => {
  try {
    permissionService.assert(req.business.role, permission);
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { requireBusiness, requirePermission };
