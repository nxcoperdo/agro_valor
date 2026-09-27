import { api } from './api.js';

let cachedUser = null;

export async function refreshUser() {
  try {
    const { user } = await api.me();
    cachedUser = user;
  } catch (err) {
    cachedUser = null;
  }
  return cachedUser;
}

export function getCachedUser() {
  return cachedUser;
}

export function isPro() {
  return Boolean(cachedUser && cachedUser.isPro);
}

export function isAdmin() {
  return Boolean(cachedUser && cachedUser.role === 'admin');
}

export function setCachedUser(user) {
  cachedUser = user;
}

export async function logout() {
  await api.logout().catch(() => {});
  cachedUser = null;
  window.location.hash = '#/';
}
