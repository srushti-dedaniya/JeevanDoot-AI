import { api, isMockMode } from './api';
import { sleep } from '../utils/helpers';

const MOCK_ADMIN_STATS = {
  stats: { users: 42, patients: 2340, doctors: 18, activeCamps: 6, consultations: 8241 },
};

const weekFromTotal = (total) => {
  const base = Math.max(1, Math.round(total / 7));
  const jitter = [0, 3, -2, 5, -1, 4, 2];
  return jitter.map((j) => base + j);
};

export const adminService = {
  async getDashboard() {
    if (isMockMode()) {
      await sleep(500);
      return MOCK_ADMIN_STATS;
    }
    const { data } = await api.get('/admin/dashboard');
    const stats = data.stats || data;
    return {
      ...stats,
      consultations: weekFromTotal(stats.consultations),
    };
  },

  async getUsers(params = {}) {
    const { data } = await api.get('/admin/users', { limit: 100, ...params });
    return (data || []).map((u) => ({ ...u, id: u._id || u.id }));
  },

  async getAuditLogs() {
    const { data } = await api.get('/admin/audit');
    return data || [];
  },
};
