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

  // Sesión
  signup: (payload) => request('/auth/signup', { method: 'POST', ...body(payload) }),
  login: (username, password) => request('/auth/login', { method: 'POST', ...body({ username, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  // Cuenta
  profile: () => request('/account/profile'),
  updateProfile: (payload) => request('/account/profile', { method: 'PUT', ...body(payload) }),
  plan: () => request('/account/plan'),

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
};
