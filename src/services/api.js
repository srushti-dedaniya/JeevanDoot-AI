import { sleep } from '../utils/helpers';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const USE_MOCK = import.meta.env.VITE_ENABLE_MOCK_API !== 'false';

export const AUTH_EVENT = 'jd-auth-expired';

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

const getToken = () => {
  try {
    const stored = localStorage.getItem('jd_user');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.token || null;
  } catch {
    return null;
  }
};

const notifyAuthExpired = () => {
  try {
    localStorage.removeItem('jd_user');
    window.dispatchEvent(new CustomEvent(AUTH_EVENT));
  } catch {
    /* ignore */
  }
};

const parseError = async (response) => {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const message = payload?.message || `Request failed: ${response.statusText}`;
  const details = payload?.details;
  if (response.status === 401 && getToken()) {
    notifyAuthExpired();
  }
  return new ApiError(response.status, message, details);
};

/**
 * Base HTTP client. When USE_MOCK is enabled all requests resolve via
 * the mocked service responses (no network call).
 */
export const api = {
  async request(path, { method = 'GET', body, params } = {}) {
    if (USE_MOCK) {
      await sleep(400 + Math.random() * 400);
      return { data: null, meta: { path, method, params } };
    }

    const query = params
      ? `?${new URLSearchParams(params).toString()}`
      : '';

    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}${path}${query}`, {
      method,
      headers,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw await parseError(response);
    }

    if (response.status === 204) {
      return { data: null };
    }

    return response.json();
  },

  async upload(path, { field = 'file', file, extra = {} } = {}) {
    const form = new FormData();
    form.append(field, file);
    Object.entries(extra).forEach(([key, value]) => form.append(key, value));

    const token = getToken();
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: form,
    });

    if (!response.ok) {
      throw await parseError(response);
    }
    return response.json();
  },

  get(path, params) {
    return this.request(path, { params });
  },

  post(path, body) {
    return this.request(path, { method: 'POST', body });
  },

  put(path, body) {
    return this.request(path, { method: 'PUT', body });
  },

  delete(path) {
    return this.request(path, { method: 'DELETE' });
  },
};

export const isMockMode = () => USE_MOCK;
