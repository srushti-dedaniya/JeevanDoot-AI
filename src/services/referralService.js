import { api, isMockMode } from './api';
import { sleep } from '../utils/helpers';
import { toReferral } from './adapters';

const REFERRAL_DESTINATIONS = [
  { value: 'agh', label: 'Amroli General Hospital (Primary Care Facility)' },
  { value: 'dcc', label: 'District Cardiology Center (Specialist Hospital)' },
  { value: 'drr', label: 'Dr. Rajeev (Orthopedic Specialist)' },
];

const normalizePriority = (priority) => {
  const map = { Urgent: 'urgent', High: 'high', Normal: 'normal' };
  return map[priority] || priority?.toLowerCase?.() || 'normal';
};

export const referralService = {
  async create(payload) {
    if (isMockMode()) {
      await sleep(900);
      return {
        id: `REF-${Math.floor(Math.random() * 10000)}`,
        ...payload,
        status: 'Sent',
        createdAt: new Date().toISOString(),
      };
    }
    const { data } = await api.post('/referrals', {
      patientId: payload.patientId,
      destination: payload.destination,
      priority: normalizePriority(payload.priority),
      reason: payload.reason,
      notes: payload.notes,
    });
    return toReferral(data);
  },

  async getByPatient(patientId) {
    if (isMockMode()) {
      await sleep(400);
      return [];
    }
    const { data } = await api.get('/referrals', { limit: 100 });
    return (data || []).filter((r) => {
      const patient = r.patient && typeof r.patient === 'object' ? r.patient : {};
      return !patientId || patient.patientId === patientId;
    }).map(toReferral);
  },

  async getDestinations() {
    if (isMockMode()) {
      await sleep(200);
      return REFERRAL_DESTINATIONS;
    }
    const { data } = await api.get('/referrals/destinations');
    return (data || []).map((d) => ({ value: d.code, label: d.label }));
  },

  async trackStatus(referralId) {
    if (isMockMode()) {
      await sleep(300);
      return { id: referralId, status: 'Pending Review' };
    }
    const { data } = await api.get(`/referrals/${referralId}/status`);
    return { id: referralId, status: data.status, referral: data.referral };
  },
};
