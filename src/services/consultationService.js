import { api, isMockMode } from './api';
import { sleep } from '../utils/helpers';
import { toConsultationCard } from './adapters';

let doctorIdCache = null;

const getDoctorId = async () => {
  if (doctorIdCache) return doctorIdCache;
  const { data } = await api.get('/doctors/me');
  doctorIdCache = data?._id || data?.id || null;
  return doctorIdCache;
};

export const consultationService = {
  async createSession(patientId) {
    if (isMockMode()) {
      await sleep(600);
      return {
        sessionId: `sess-${Date.now()}`,
        patientId,
        startedAt: new Date().toISOString(),
        status: 'live',
      };
    }
    const doctor = await getDoctorId();
    const { data } = await api.post('/consultations', { patientId, doctor });
    return {
      id: data.id,
      sessionId: data.sessionId,
      patientId,
      startedAt: data.startedAt,
      status: 'live',
    };
  },

  async endSession(sessionId, data) {
    if (isMockMode()) {
      await sleep(400);
      return { sessionId, notes: data, status: 'ended', endedAt: new Date().toISOString() };
    }
    const body = typeof data === 'string' ? { notes: data, transcript: data } : data;
    const { data: result } = await api.post(`/consultations/${sessionId}/end`, body);
    return {
      id: result.id,
      sessionId: result.sessionId || sessionId,
      notes: result.notes || body.notes,
      status: result.status === 'completed' ? 'ended' : result.status,
      endedAt: result.endedAt,
    };
  },

  async getAll(params = {}) {
    if (isMockMode()) {
      await sleep(400);
      return [];
    }
    const { data } = await api.get('/consultations', { limit: 100, ...params });
    return (data || []).map(toConsultationCard);
  },

  async remove(id) {
    if (isMockMode()) {
      await sleep(300);
      return { success: true };
    }
    await api.delete(`/consultations/${id}`);
    return { success: true };
  },

  async getTranscript(sessionId) {
    if (isMockMode()) {
      await sleep(300);
      return {
        sessionId,
        scribe: 'Patient reports persistent chest pain for 48 hours. No fever. Pain increases with deep breaths. History of hypertension mentioned.',
      };
    }
    const { data } = await api.get(`/consultations/${sessionId}/transcript`);
    return { sessionId, scribe: data.transcript || '', scribeSections: data.scribeSections || [] };
  },
};
