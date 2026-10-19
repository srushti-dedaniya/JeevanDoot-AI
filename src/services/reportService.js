import { api, isMockMode } from './api';
import { sleep } from '../utils/helpers';
import { formatDateTime, titleCase } from './adapters';

export const reportService = {
  async generate(config) {
    if (isMockMode()) {
      await sleep(1200);
      return { generatedOn: new Date().toISOString(), config };
    }

    const [reportsRes, patientsRes] = await Promise.all([
      api.get('/reports', { limit: 100 }),
      api.get('/patients', { limit: 1 }),
    ]);
    const reports = reportsRes.data || [];
    const totalPatients = patientsRes.meta?.total ?? 0;

    const typeLabels = { laboratory: 'Lab Reports', radiology: 'Radiology', pathology: 'Pathology', diagnostic: 'Diagnostics' };
    const byType = {};
    reports.forEach((r) => {
      const key = typeLabels[r.type] || 'Other';
      byType[key] = (byType[key] || 0) + 1;
    });
    const conditionTrends = Object.entries(byType).map(([label, value]) => ({ label, value }));
    const resolved = reports.filter((r) => r.impression).length;
    const resolutionRate = reports.length ? Math.round((resolved / reports.length) * 100) : 0;

    return {
      title: `Regional Health Impact Report - ${config?.region || 'All Regions'}`,
      resolutionRate,
      patientsServed: totalPatients.toLocaleString(),
      sdgAlignment: 'High',
      generatedOn: new Date().toISOString(),
      config,
      conditionTrends: conditionTrends.length
        ? conditionTrends
        : [],
    };
  },

  async getAuditLogs() {
    if (isMockMode()) {
      await sleep(500);
      return [];
    }
    const { data } = await api.get('/admin/audit');
    return (data || []).map((log) => ({
      timestamp: formatDateTime(log.createdAt),
      patientId: log.patient,
      risk: titleCase(log.severity),
      handledBy: log.actor,
      outcome: titleCase(log.type),
      summary: log.summary,
    }));
  },

  async exportCsv() {
    if (isMockMode()) {
      await sleep(400);
      return { success: true, filename: 'audit-log.csv' };
    }
    const { data } = await api.get('/reports/export');
    return { success: true, filename: 'audit-log.csv', rows: data || [] };
  },
};
