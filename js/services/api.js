export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.status = status;
    this.payload = payload || {};
    this.upgradeRequired = Boolean(this.payload.upgradeRequired);
  }
}

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error || `Error ${res.status}`, res.status, data);
  }

  return data;
}

const body = (payload) => ({ body: JSON.stringify(payload) });

export const api = {
  // Público
  market: () => request('/public/market'),
  plans: () => request('/public/plans'),
  privacyPolicy: () => request('/public/legal/privacy'),
  termsOfService: () => request('/public/legal/terms'),
  cookiePolicy: () => request('/public/legal/cookies'),

  // Sesión
  signup: (payload) => request('/auth/signup', { method: 'POST', ...body(payload) }),
  login: (username, password, remember = false) =>
    request('/auth/login', { method: 'POST', ...body({ username, password, remember }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  requestPasswordReset: (username) => request('/auth/password-reset/request', { method: 'POST', ...body({ username }) }),
  confirmPasswordReset: (payload) => request('/auth/password-reset/confirm', { method: 'POST', ...body(payload) }),

  // Cuenta
  profile: () => request('/account/profile'),
  updateProfile: (payload) => request('/account/profile', { method: 'PUT', ...body(payload) }),
  plan: () => request('/account/plan'),
  changePassword: (currentPassword, newPassword) =>
    request('/account/password', { method: 'PUT', ...body({ currentPassword, newPassword }) }),
  deleteAccount: (password) => request('/account', { method: 'DELETE', ...body({ password }) }),
  mpPay: () => request('/account/mercadopago/pay', { method: 'POST' }),
  mpConfirm: () => request('/account/mercadopago/confirm', { method: 'POST' }),

  // Mercado (con cuenta)
  currentPrice: () => request('/prices/current'),
  priceHistory: (days = 30) => request(`/prices/history?days=${days}`),
  cooperatives: () => request('/cooperatives'),

  // Pro
  forecast: () => request('/forecast'),
  calculate: (payload) => request('/calculator', { method: 'POST', ...body(payload) }),
  alerts: () => request('/alerts'),
  createAlert: (payload) => request('/alerts', { method: 'POST', ...body(payload) }),
  toggleAlert: (id, active) => request(`/alerts/${id}`, { method: 'PATCH', ...body({ active }) }),
  deleteAlert: (id) => request(`/alerts/${id}`, { method: 'DELETE' }),
  testAlert: () => request('/alerts/test', { method: 'POST' }),
  sales: () => request('/sales'),
  createSale: (payload) => request('/sales', { method: 'POST', ...body(payload) }),
  deleteSale: (id) => request(`/sales/${id}`, { method: 'DELETE' }),

  // Reportes colaborativos (disponible para cualquier cuenta)
  createReport: (payload) => request('/reports', { method: 'POST', ...body(payload) }),
  myReports: () => request('/reports/mine'),

  // Admin
  adminUsers: () => request('/admin/users'),
  activatePro: (userId, months) => request(`/admin/users/${userId}/activate-pro`, { method: 'POST', ...body({ months }) }),
  cancelPro: (userId) => request(`/admin/users/${userId}/cancel-pro`, { method: 'POST' }),
  adminCooperatives: () => request('/admin/cooperatives'),
  createCooperative: (payload) => request('/admin/cooperatives', { method: 'POST', ...body(payload) }),
  updateCooperative: (id, payload) => request(`/admin/cooperatives/${id}`, { method: 'PUT', ...body(payload) }),
  adminReports: () => request('/admin/reports'),
  deleteReport: (id) => request(`/admin/reports/${id}`, { method: 'DELETE' }),
  adminMetrics: () => request('/admin/metrics'),
  resetUserPassword: (userId, newPassword) =>
    request(`/admin/users/${userId}/reset-password`, { method: 'POST', ...body({ newPassword }) }),
};
