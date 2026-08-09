import { api } from './api.js';

let cachedUser = null;

export async function requireAuth() {
  try {
    const { user } = await api.me();
    cachedUser = user;
    return user;
  } catch (err) {
    cachedUser = null;
    return null;
  }
}

export function getCachedUser() {
  return cachedUser;
}

export async function logout() {
  await api.logout().catch(() => {});
  cachedUser = null;
  window.location.hash = '#/login';
}
