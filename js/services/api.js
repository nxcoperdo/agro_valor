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

  // Compras de café
  coffeeMe: () => request('/coffee/me'),
  searchSuppliers: (q) => request(`/coffee/suppliers?q=${encodeURIComponent(q || '')}`),
  purchases: (params = {}) => request(`/coffee/purchases?${new URLSearchParams(params)}`),
  purchase: (id) => request(`/coffee/purchases/${id}`),
  createPurchase: (payload) => request('/coffee/purchases', { method: 'POST', ...body(payload) }),
  currentWorkday: () => request('/coffee/workdays/current'),
  workdays: () => request('/coffee/workdays'),
  closeWorkday: (id) => request(`/coffee/workdays/${id}/close`, { method: 'POST' }),
  daySummary: (date) => request(`/coffee/day-summary${date ? `?date=${date}` : ''}`),
  purchaseCosts: (id) => request(`/coffee/purchases/${id}/costs`),
  addPurchaseCost: (id, payload) => request(`/coffee/purchases/${id}/costs`, { method: 'POST', ...body(payload) }),
  removePurchaseCost: (id, costId) => request(`/coffee/purchases/${id}/costs/${costId}`, { method: 'DELETE' }),
  projection: (id) => request(`/coffee/purchases/${id}/projection`),
  saveProjection: (id, payload) => request(`/coffee/purchases/${id}/projection`, { method: 'PUT', ...body(payload) }),
  quickCalc: (payload) => request('/coffee/calculator', { method: 'POST', ...body(payload) }),
  compareFactors: (payload) => request('/coffee/calculator/compare', { method: 'POST', ...body(payload) }),
  lots: () => request('/coffee/lots'),
  lot: (id) => request(`/coffee/lots/${id}`),
  createLot: (payload) => request('/coffee/lots', { method: 'POST', ...body(payload) }),
  changeLotStatus: (id, status) => request(`/coffee/lots/${id}/status`, { method: 'POST', ...body({ status }) }),
  removeLotPurchase: (id, purchaseId) => request(`/coffee/lots/${id}/purchases/${purchaseId}`, { method: 'DELETE' }),
  lotProcessing: (id) => request(`/coffee/lots/${id}/processing`),
  saveLotShipment: (id, payload) => request(`/coffee/lots/${id}/processing`, { method: 'PUT', ...body(payload) }),
  addLotCost: (id, payload) => request(`/coffee/lots/${id}/processing/costs`, { method: 'POST', ...body(payload) }),
  removeLotCost: (id, costId) => request(`/coffee/lots/${id}/processing/costs/${costId}`, { method: 'DELETE' }),
  finishLot: (id, payload) => request(`/coffee/lots/${id}/processing/finish`, { method: 'POST', ...body(payload) }),
  inventory: (available) => request(`/coffee/inventory${available ? '?available=1' : ''}`),
  inventoryMovements: (id) => request(`/coffee/inventory/${id}/movements`),
  enterInventory: (lotId, payload) => request(`/coffee/lots/${lotId}/inventory`, { method: 'POST', ...body(payload) }),
  searchCustomers: (q) => request(`/coffee/customers?q=${encodeURIComponent(q || '')}`),
  tradeSales: () => request('/coffee/sales'),
  createTradeSale: (payload) => request('/coffee/sales', { method: 'POST', ...body(payload) }),
  voidTradeSale: (id, reason) => request(`/coffee/sales/${id}/void`, { method: 'POST', ...body({ reason }) }),
  receipt: (id) => request(`/coffee/purchases/${id}/receipt`),
  business: () => request('/coffee/business'),
  updateBusiness: (payload) => request('/coffee/business', { method: 'PUT', ...body(payload) }),
  voidPurchase: (id, reason) => request(`/coffee/purchases/${id}/void`, { method: 'POST', ...body({ reason }) }),

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
