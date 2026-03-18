/**
 * API client for the HiVoid panel backend.
 */

const BASE = '/api';

function getToken() {
  return localStorage.getItem('hivoid_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    localStorage.removeItem('hivoid_token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────
export const auth = {
  login: (username, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => request('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    }),
  updateProfile: (newUsername) =>
    request(`/auth/profile?new_username=${encodeURIComponent(newUsername)}`, {
      method: 'POST',
    }),
  resetPassword: (newPassword) =>
    request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ new_password: newPassword }),
    }),
};

// ── Users ─────────────────────────────────────────────────────
export const users = {
  list: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.enabled !== undefined) qs.set('enabled', params.enabled);
    if (params.skip) qs.set('skip', params.skip);
    if (params.limit) qs.set('limit', params.limit);
    return request(`/users?${qs.toString()}`);
  },
  count: () => request('/users/count'),
  get: (id) => request(`/users/${id}`),
  create: (data) =>
    request('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) =>
    request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  toggle: (id) => request(`/users/${id}/toggle`, { method: 'POST' }),
  generateUuid: () => request('/users/generate-uuid'),
};

// ── System ────────────────────────────────────────────────────
export const system = {
  stats: () => request('/system/stats'),
  history: () => request('/system/stats/history'),
};

// ── Protocol ──────────────────────────────────────────────────
export const protocol = {
  status: () => request('/protocol/status'),
  start: () => request('/protocol/start', { method: 'POST' }),
  stop: () => request('/protocol/stop', { method: 'POST' }),
  restart: () => request('/protocol/restart', { method: 'POST' }),
  syncConfig: () => request('/protocol/sync-config', { method: 'POST' }),
};

// ── Settings ──────────────────────────────────────────────────
export const settings = {
  get: () => request('/settings'),
  update: (data) =>
    request('/settings', { method: 'PUT', body: JSON.stringify(data) }),
};
