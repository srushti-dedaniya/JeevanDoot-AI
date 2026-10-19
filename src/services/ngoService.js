import { api, isMockMode } from './api';
import { sleep } from '../utils/helpers';
import { formatDate, titleCase } from './adapters';

const toCampCard = (c) => ({
  id: c.campId || c._id,
  _id: c._id,
  name: c.name,
  type: (c.services && c.services[0]) || '',
  location: c.location,
  village: c.village,
  doctor: c.doctor,
  date: c.date ? formatDate(c.date).replace(/^\w+ (\d{1,2}).*/, '$1') : '',
  fullDate: c.date,
  beneficiaries: c.beneficiaries ?? 0,
  status: titleCase(c.status),
  services: c.services || [],
  notes: c.notes,
});

export const ngoService = {
  async getDashboard() {
    if (isMockMode()) {
      await sleep(500);
      return {
        campsConducted: 18,
        beneficiariesServed: '4,200',
        activeVolunteers: 96,
        vaccinationsDelivered: '2,180',
        upcomingCamps: MOCK_CAMPS,
      };
    }
    const { data } = await api.get('/ngo/dashboard');
    return {
      ...data,
      upcomingCamps: (data.upcomingCamps || []).map(toCampCard),
    };
  },

  async getCamps(params = {}) {
    if (isMockMode()) {
      await sleep(500);
      return MOCK_CAMPS;
    }
    const { data } = await api.get('/ngo/camps', { limit: 100, ...params });
    return (data || []).map(toCampCard);
  },

  async createCamp(payload) {
    if (isMockMode()) {
      await sleep(500);
      return { id: `HC-${Date.now()}`, ...payload, status: 'Planned', beneficiaries: 0 };
    }
    const { data } = await api.post('/ngo/camps', payload);
    return toCampCard(data);
  },

  async updateCamp(id, patch) {
    if (isMockMode()) {
      await sleep(400);
      return { id, ...patch };
    }
    const { data } = await api.put(`/ngo/camps/${id}`, patch);
    return toCampCard(data);
  },

  async deleteCamp(id) {
    if (isMockMode()) {
      await sleep(300);
      return { success: true };
    }
    await api.delete(`/ngo/camps/${id}`);
    return { success: true };
  },

  async getImpact() {
    if (isMockMode()) {
      await sleep(600);
      return {
        stats: { patientsReached: 18420, villagesCovered: 42, vaccinations: 6240, trainingSessions: 96 },
        serviceSplit: [{ label: 'Primary Care', value: 42 }, { label: 'Vaccination', value: 28 }, { label: 'Awareness', value: 20 }, { label: 'Follow-up', value: 10 }],
      };
    }
    const { data } = await api.get('/ngo/impact');
    const serviceLabels = { primaryCare: 'Primary Care', vaccination: 'Vaccination', awareness: 'Awareness', followUp: 'Follow-up' };
    return {
      stats: data.stats,
      serviceSplit: (data.serviceSplit || []).map((s) => ({ label: serviceLabels[s._id] || s._id, value: s.count })),
      camps: (data.camps || []).map(toCampCard),
    };
  },
};
