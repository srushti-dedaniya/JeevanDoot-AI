import { api, isMockMode } from './api';
import { sleep } from '../utils/helpers';
import {
  toPatientCard,
  toPatientProfile,
  toAppointmentCard,
  toPrescriptionCard,
  toConsultationCard,
  toReportCard,
} from './adapters';

export const patientService = {
  async getAll() {
    if (isMockMode()) {
      await sleep(600);
      return MOCK_PATIENTS;
    }
    const { data } = await api.get('/patients', { limit: 100 });
    return (data || []).map(toPatientCard);
  },

  async getById(id) {
    if (isMockMode()) {
      await sleep(400);
      return MOCK_PATIENTS.find((p) => p.id === id) ?? null;
    }
    if (!id) return null;
    const { data } = await api.get('/patients', { search: id, limit: 50 });
    const match = (data || []).find((p) => p.patientId === id);
    return match ? toPatientCard(match) : null;
  },

  async resolveId(patientId) {
    if (isMockMode()) return patientId;
    if (!patientId) return null;
    const { data } = await api.get('/patients', { search: patientId, limit: 10 });
    const match = (data || []).find((p) => p.patientId === patientId);
    return match?._id || null;
  },

  async getMyProfile() {
    const { data } = await api.get('/patients/me');
    return toPatientProfile(data);
  },

  async updateMyProfile(patch) {
    const { data } = await api.put('/patients/me', patch);
    return toPatientProfile(data);
  },

  async getMyAppointments() {
    const { data } = await api.get('/patients/me/appointments', { limit: 100 });
    return (data || []).map(toAppointmentCard);
  },

  async getMyPrescriptions() {
    const { data } = await api.get('/patients/me/prescriptions');
    return (data || []).map(toPrescriptionCard);
  },

  async getMyConsultations() {
    const { data } = await api.get('/patients/me/consultations');
    return (data || []).map(toConsultationCard);
  },

  async getMyReports() {
    const { data } = await api.get('/patients/me/reports');
    return (data || []).map(toReportCard);
  },

  async search(query) {
    const all = await this.getAll();
    const term = query.toLowerCase();
    return all.filter(
      (p) =>
        p.name.toLowerCase().includes(term) || p.id.toLowerCase().includes(term)
    );
  },

  async create(payload) {
    if (isMockMode()) {
      await sleep(500);
      return { ...payload, id: `JD-${Math.floor(Math.random() * 9000) + 1000}` };
    }
    const { data } = await api.post('/patients', payload);
    return toPatientCard(data);
  },
};
