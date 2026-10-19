import { api, isMockMode } from './api';
import { sleep } from '../utils/helpers';

export const authService = {
  async login(role, credentials) {
    if (isMockMode()) {
      await sleep(1200);
      if (!credentials.email || !credentials.password) {
        throw new Error('Email and password are required');
      }
      return { token: `token-${role}`, user: { id: `usr-${role}`, role, name: role === 'admin' ? 'Admin Miller' : 'Dr. Sharma', email: credentials.email } };
    }
    const { data } = await api.post('/auth/login', { role, ...credentials });
    return data;
  },

  async register(profile) {
    if (isMockMode()) {
      await sleep(1200);
      return {
        token: `token-${profile.role}`,
        user: { id: `usr-${Date.now()}`, role: profile.role, name: profile.name, email: profile.email },
      };
    }
    const { data } = await api.post('/auth/register', profile);
    return data;
  },

  async logout() {
    if (isMockMode()) return { success: true };
    await api.post('/auth/logout');
    return { success: true };
  },

  async requestAccess(payload) {
    if (isMockMode()) {
      await sleep(1000);
      return { success: true, message: 'Access request submitted' };
    }
    const { data } = await api.post('/auth/request-access', payload);
    return data;
  },

  async verifyToken(token) {
    if (isMockMode()) return { valid: true, user: { id: 'usr-doctor', role: 'doctor', name: 'Dr. Sharma' } };
    const { data } = await api.get('/auth/verify', { token });
    return data;
  },
};
