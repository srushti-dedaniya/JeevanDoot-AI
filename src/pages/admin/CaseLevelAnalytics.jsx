import { useTranslation } from 'react-i18next';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import KPIWidget from '../../components/charts/KPIWidget';
import BarChart from '../../components/charts/BarChart';
import HeatMap from '../../components/charts/HeatMap';

const SIDEBAR = {
  items: [
    { labelKey: 'dashboard', to: '/admin/dashboard', icon: 'dashboard', end: true },
    { labelKey: 'diseaseSurveillance', to: '/admin/surveillance', icon: 'public_health' },
    { labelKey: 'caseAnalytics', to: '/admin/case-analytics', icon: 'analytics' },
    { labelKey: 'auditLog', to: '/admin/audit-log', icon: 'verified_user' },
    { labelKey: 'reportGeneration', to: '/admin/reports', icon: 'summarize' },
    { labelKey: 'doctorManagement', to: '/admin/doctors', icon: 'medical_services' },
    { labelKey: 'configuration', to: '/admin/settings', icon: 'settings' },
    { labelKey: 'aiAssistant', to: '/admin/ai-assistant', icon: 'smart_toy' },
    { labelKey: 'agentAudit', to: '/admin/agent-audit', icon: 'monitor_heart' },
  ],
};

const RISK_ROWS = [
  { label: 'Meera Sharma', values: [2, 4, 4, 4, 4, 3, 4] },
  { label: 'Gopal Prasad', values: [1, 2, 4, 4, 3, 2, 2] },
  { label: 'Rajesh Kumar', values: [0, 1, 2, 2, 3, 2, 1] },
  { label: 'Arjun Singh', values: [1, 1, 2, 1, 0, 1, 1] },
];

export default function CaseLevelAnalytics() {
  const { t } = useTranslation();
  const sidebarItems = SIDEBAR.items.map((item) => ({ ...item, label: t(`nav.${item.labelKey}`) }));

  return (
    <DashboardLayout
      sidebarProps={{ items: sidebarItems }}
      headerProps={{ title: t('analytics.title'), subtitle: t('analytics.subtitle') }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <KPIWidget label={t('analytics.totalCases')} value="2,410" icon="description" color="primary" trend={9} />
        <KPIWidget label={t('analytics.resolved')} value="1,940" icon="verified" color="secondary" trend={12} />
        <KPIWidget label={t('analytics.escalated')} value="320" icon="north_east" color="tertiary" trend={-5} />
        <KPIWidget label={t('analytics.inFollowUp')} value="150" icon="schedule" color="error" trend={3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title={t('analytics.casesByDiagnosis')} subtitle={t('analytics.topConditions')} className="lg:col-span-2">
          <BarChart
            labels={['Malaria', 'Fever', 'Prenatal', 'Chronic', 'Respiratory', 'Other']}
            data={[540, 480, 390, 350, 260, 390]}
            colors={['#1B5E4F', '#00639B', '#7C5800', '#722000', '#E8734A', '#C8B900']}
            height={300}
          />
        </Card>
        <Card title={t('analytics.caseOutcomeFlow')} subtitle={t('analytics.escalationFunnel')}>
          <div className="space-y-4">
            {[
              { label: t('analytics.resolvedAtPhc'), value: 81, color: 'bg-primary' },
              { label: t('analytics.referredToChc'), value: 13, color: 'bg-tertiary' },
              { label: t('analytics.hospitalized'), value: 6, color: 'bg-error' },
            ].map((r) => (
              <div key={r.label}>
                <div className="flex justify-between text-label-md mb-1">
                  <span className="text-on-surface-variant">{r.label}</span>
                  <span className="font-bold text-on-surface">{r.value}%</span>
                </div>
                <div className="h-3 rounded-full bg-surface-container-high overflow-hidden">
                  <div className={`h-full ${r.color} rounded-full`} style={{ width: `${r.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title={t('analytics.riskEvolution')} subtitle={t('analytics.riskIntensity')}>
        <HeatMap rows={RISK_ROWS} weekLabels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title={t('analytics.timeToTreatment')} subtitle={t('analytics.medianMinutes')}>
          <div className="text-center py-8">
            <p className="font-headline text-headline-2xl font-bold text-primary">38 min</p>
            <p className="text-on-surface-variant text-label-md mt-1">{t('analytics.downVsLastMonth')}</p>
          </div>
        </Card>
        <Card title={t('analytics.recoveryRate')} subtitle={t('analytics.byRiskGroup')}>
          <div className="space-y-3 mt-2">
            {[
              { label: t('queue.low'), value: 98 },
              { label: t('queue.moderate'), value: 91 },
              { label: t('queue.high'), value: 78 },
              { label: t('queue.critical'), value: 62 },
            ].map((r) => (
              <div key={r.label} className="flex items-center gap-3">
                <span className="w-20 text-label-md text-on-surface-variant">{r.label}</span>
                <div className="flex-1 h-2.5 rounded-full bg-surface-container-high overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${r.value}%` }} />
                </div>
                <span className="font-bold text-on-surface text-label-md">{r.value}%</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title={t('analytics.criticalCases')} subtitle={t('analytics.activeHighRisk')}>
          <div className="space-y-3">
            {['JD-9921', 'JD-1209', 'JD-1023'].map((id) => (
              <div key={id} className="flex items-center justify-between bg-surface-container-low rounded-lg p-3">
                <span className="font-mono font-semibold text-primary">{id}</span>
                <Badge variant="critical">{t('queue.critical')}</Badge>
              </div>
            ))}
            <p className="text-label-sm text-on-surface-variant">{t('analytics.flaggedForReview', { count: 3 })}</p>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
