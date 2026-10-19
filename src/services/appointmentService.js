import { api, isMockMode } from './api';
import { sleep } from '../utils/helpers';
import { toAppointmentCard } from './adapters';
import { patientService } from './patientService';
import { doctorService } from './doctorService';

const MOCK_APPOINTMENTS = [
  { id: 'apt-1', doctor: 'Dr. Rajesh Kumar', specialization: 'General Physician', hospital: 'Amroli PHC', date: '2026-08-15', time: '10:30', purpose: 'Follow-up', status: 'Upcoming' },
  { id: 'apt-2', doctor: 'Dr. Kavita Nair', specialization: 'Pediatrician', hospital: 'Kanker CHC', date: '2026-08-20', time: '11:00', purpose: 'Vaccination', status: 'Upcoming' },
];

export const appointmentService = {
  async getAll(params = {}) {
    if (isMockMode()) {
      await sleep(500);
      return MOCK_APPOINTMENTS;
    }
    const { data } = await api.get('/appointments', { limit: 100, ...params });
    return (data || []).map(toAppointmentCard);
  },

  async getById(id) {
    if (isMockMode()) {
      await sleep(300);
      return MOCK_APPOINTMENTS.find((a) => a.id === id) ?? null;
    }
    const { data } = await api.get(`/appointments/${id}`);
    return toAppointmentCard(data);
  },

  async create(payload) {
    if (isMockMode()) {
      await sleep(500);
      return { id: `apt-${Date.now()}`, ...payload, status: 'Upcoming' };
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
      purpose: payload.purpose || 'general',
      date: payload.date,
      startTime: payload.startTime || payload.time,
      endTime: payload.endTime,
      notes: payload.notes || '',
    };
    const { data } = await api.post('/appointments', body);
    return toAppointmentCard(data);
  },

  async cancel(id, reason = '') {
    if (isMockMode()) {
      await sleep(400);
      return { id, status: 'Cancelled' };
    }
    const { data } = await api.post(`/appointments/${id}/cancel`, { reason });
    return toAppointmentCard(data);
  },

  async reschedule(id, { date, time }) {
    if (isMockMode()) {
      await sleep(400);
      return { id, date, time };
    }
    const { data } = await api.put(`/appointments/${id}`, {
      date: date || undefined,
      startTime: time || undefined,
    });
    return toAppointmentCard(data);
  },
};
