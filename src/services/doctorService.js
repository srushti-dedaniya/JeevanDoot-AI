import { api, isMockMode } from './api';
import { sleep } from '../utils/helpers';
import { toDoctorCard, toDoctorStats } from './adapters';

const toId = (doctor) => doctor._id || doctor.id;

export const doctorService = {
  async getDashboard() {
    if (isMockMode()) {
      await sleep(500);
      return MOCK_DOCTOR_STATS;
    }
    const { data } = await api.get('/doctor/dashboard');
    return toDoctorStats(data);
  },

  async getAll() {
    if (isMockMode()) {
      await sleep(500);
      return MOCK_DOCTORS;
    }
    const { data } = await api.get('/doctors', { limit: 100 });
    return (data || []).map(toDoctorCard);
  },

  async getById(id) {
    if (isMockMode()) {
      await sleep(300);
      return MOCK_DOCTORS.find((d) => d.id === id) ?? null;
    }
    const { data } = await api.get(`/doctors/${id}`);
    return toDoctorCard(data);
  },

  async getMe() {
    const { data } = await api.get('/doctors/me');
    return toDoctorCard(data);
  },

  async create(payload) {
    if (isMockMode()) {
      await sleep(500);
      return { ...payload, id: `JD-${Math.floor(Math.random() * 9000) + 1000}` };
    }
    const { data: registered } = await api.post('/auth/register', {
      role: 'doctor',
      name: payload.name,
      email: payload.email,
      password: payload.password || 'Password@123',
      phone: payload.phone || '',
    });
    const { data } = await api.post('/doctors', {
      user: registered.user.id,
      name: payload.name,
      specialization: payload.specialty,
      hospital: payload.hospital || '',
      experience: payload.experience,
      email: payload.email,
      phone: payload.phone,
    });
    return toDoctorCard(data);
  },

  async update(id, patch) {
    if (isMockMode()) {
      await sleep(400);
      return { id, ...patch };
    }
    const { data } = await api.put(`/doctors/${id}`, patch);
    return toDoctorCard(data);
  },

  async toggleStatus(id) {
    if (isMockMode()) {
      await sleep(300);
      return { id, deactivated: true };
    }
    const { data } = await api.post(`/doctors/${id}/toggle-status`);
    return data;
  },
};

export const toDoctorId = toId;
