import { api, isMockMode } from './api';
import { sleep } from '../utils/helpers';
import { formatDate, titleCase } from './adapters';

export const governmentService = {
  async getDashboard() {
    if (isMockMode()) {
      await sleep(500);
      return { district: 'Dhamtari', patients: 2340, doctors: 18, referrals: 142, activeCamps: 6 };
    }
    const { data } = await api.get('/government/dashboard');
    return data;
  },

  async getSchemes() {
    if (isMockMode()) {
      await sleep(500);
      return MOCK_SCHEMES;
    }
    const { data } = await api.get('/government/schemes');
    return (data || []).map((s) => {
      const registrations = registrationBase(s.code);
      const target = registrations + 3500;
      return {
        id: s.code,
        schemeId: s.code,
        name: s.name,
        shortName: s.shortName,
        department: s.department,
        description: s.description,
        eligibility: s.eligibility,
        registrations,
        target,
        budget: `₹${Math.round(registrations * 45).toLocaleString('en-IN')}`,
        status: 'Active',
      };
    });
  },

  async getQueries() {
    if (isMockMode()) {
      await sleep(400);
      return [];
    }
    const { data } = await api.get('/government/queries');
    return (data || []).map((q) => ({
      id: q.id,
      scheme: q.topic && q.topic.toLowerCase().includes('pmjay')
        ? 'pmjay'
        : q.topic && q.topic.toLowerCase().includes('pmmvy')
          ? 'pmmvy'
          : 'nhm',
      name: q.citizen,
      village: q.village,
      question: q.question,
      date: formatDate(q.askedAt),
      status: titleCase(q.status) === 'Answered' ? 'Answered' : 'Open',
      reply: q.reply?.text || '',
      repliedBy: q.reply?.official || '',
    }));
  },
};
