import { api, isMockMode } from './api';
import { sleep } from '../utils/helpers';
import { toNotification } from './adapters';

export const notificationService = {
  async getAll() {
    if (isMockMode()) {
      await sleep(400);
      return [
        { id: 'n1', title: 'Lab report uploaded', message: 'S. Dhillon - Blood Panel', type: 'report', read: false, time: '2 mins ago' },
        { id: 'n2', title: 'Pharmacy alert', message: 'Refill requested for A. Dhillon', type: 'alert', read: false, time: '12 mins ago' },
        { id: 'n3', title: 'Consultation completed', message: 'K. Singh - Virtual Bridge', type: 'success', read: true, time: '1 hour ago' },
      ];
    }
    const { data } = await api.get('/notifications', { limit: 50 });
    return (data || []).map(toNotification);
  },

  async markAllRead() {
    if (isMockMode()) {
      await sleep(200);
      return { success: true };
    }
    const { data } = await api.post('/notifications/read-all');
    return { success: true, modifiedCount: data.modifiedCount };
  },

  async markRead(id) {
    if (isMockMode()) {
      await sleep(150);
      return { success: true };
    }
    await api.post(`/notifications/${id}/read`);
    return { success: true };
  },

  async send(payload) {
    if (isMockMode()) {
      await sleep(300);
      return { id: `n-${Date.now()}`, ...payload };
    }
    const { data } = await api.post('/notifications', payload);
    return toNotification(data);
  },
};
