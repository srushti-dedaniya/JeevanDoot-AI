import { api, isMockMode } from './api';
import { sleep } from '../utils/helpers';
import { toPrescriptionCard } from './adapters';
import { patientService } from './patientService';
import { doctorService } from './doctorService';

export const prescriptionService = {
  async getAll(params = {}) {
    if (isMockMode()) {
      await sleep(500);
      return [];
    }
    const { data } = await api.get('/prescriptions', { limit: 100, ...params });
    return (data || []).map(toPrescriptionCard);
  },

  async getById(id) {
    if (isMockMode()) {
      await sleep(300);
      return null;
    }
    const { data } = await api.get(`/prescriptions/${id}`);
    return toPrescriptionCard(data);
  },

  async create(payload) {
    if (isMockMode()) {
      await sleep(500);
      return { id: `rx-${Date.now()}`, ...payload, status: 'Active' };
    }
    const patient =
      payload.patient ||
      (payload.patientId ? await patientService.resolveId(payload.patientId) : null);
    let doctor = payload.doctor;
    if (!doctor) {
      if (payload.doctorId) {
        doctor = (await doctorService.toDoctorId(payload.doctorId)) || payload.doctorId;
      } else {
        const me = await doctorService.getMe();
        doctor = me?._id || me?.id;
      }
    }
    const body = {
      patient,
      doctor,
      diagnosis: payload.diagnosis || '',
      advice: payload.advice || '',
      medicines: (payload.medicines || []).map((m) => ({
        medicineName: m.medicineName || m.name,
        dosage: m.dosage || '',
        frequency: m.frequency || '',
        duration: m.duration || '',
        durationDays: Number(m.durationDays) || Number.parseInt(m.duration, 10) || 7,
        schedule: m.schedule || { morning: false, afternoon: false, night: false },
        notes: m.notes || '',
      })),
    };
    const { data } = await api.post('/prescriptions', body);
    return toPrescriptionCard(data);
  },

  async update(id, patch) {
    if (isMockMode()) {
      await sleep(400);
      return { id, ...patch };
    }
    const { data } = await api.put(`/prescriptions/${id}`, patch);
    return toPrescriptionCard(data);
  },

  async dispense(id) {
    if (isMockMode()) {
      await sleep(300);
      return { id, status: 'Dispensed' };
    }
    const { data } = await api.post(`/prescriptions/${id}/dispense`);
    return toPrescriptionCard(data);
  },
};
