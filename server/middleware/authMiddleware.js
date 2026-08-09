const { verifyToken, COOKIE_NAME } = require('../services/authService');

function authMiddleware(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }

  req.user = { id: payload.sub, username: payload.username, role: payload.role };
  next();
}

module.exports = authMiddleware;
