import { api, isMockMode } from './api';
import { sleep } from '../utils/helpers';

const MOCK_REGIONS = [
  { name: 'Oak Ridge Cluster', disease: 'Malaria', stage: 2, newCases: 24, growth: 14, coords: [45, 30] },
  { name: 'North-East Highlands', disease: 'Dengue', stage: 1, newCases: 8, growth: 4, coords: [60, 20] },
  { name: 'Western River Basin', disease: 'Cholera', stage: 0, newCases: 3, growth: 1, coords: [25, 60] },
];

const toStage = (risk) => {
  const level = String(risk || '').toLowerCase();
  if (level === 'critical' || level === 'high') return 2;
  if (level === 'medium' || level === 'moderate' || level === 'elevated') return 1;
  return 0;
};

const toRegions = (items) =>
  (items || []).map((r) => ({
    name: r.village || r.name,
    disease: r.disease,
    stage: toStage(r.risk),
    newCases: r.cases ?? r.newCases ?? 0,
    growth: r.growth ?? 0,
    coords: [r.lng ?? r.coords?.[0], r.lat ?? r.coords?.[1]],
  }));

export const mapService = {
  async getSurveillance() {
    if (isMockMode()) {
      await sleep(700);
      return {
        totalCases: 4129,
        activeOutbreaks: 12,
        regions: MOCK_REGIONS,
      };
    }
    const { data } = await api.get('/admin/surveillance');
    const regions = toRegions(data);
    return {
      totalCases: regions.reduce((sum, r) => sum + r.newCases, 0),
      activeOutbreaks: regions.filter((r) => r.stage >= 2).length,
      regions,
    };
  },

  async getClusters(params) {
    if (isMockMode()) {
      await sleep(500);
      return MOCK_REGIONS;
    }
    const { data } = await api.get('/admin/surveillance', params);
    return toRegions(data);
  },
};
