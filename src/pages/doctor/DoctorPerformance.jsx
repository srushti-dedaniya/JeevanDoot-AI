import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import KPIWidget from '../../components/charts/KPIWidget';
import LineChart from '../../components/charts/LineChart';
import BarChart from '../../components/charts/BarChart';
import HeatMap from '../../components/charts/HeatMap';
import Button from '../../components/common/Button';
import { doctorService } from '../../services/doctorService';

const SIDEBAR = {
  items: [
    { labelKey: 'dashboard', to: '/doctor/dashboard', icon: 'dashboard', end: true },
    { labelKey: 'patientQueue', to: '/doctor/queue', icon: 'groups' },
    { labelKey: 'liveConsultation', to: '/doctor/consultation', icon: 'call' },
    { labelKey: 'consultationHistory', to: '/doctor/consultation-history', icon: 'video_library' },
    { labelKey: 'performanceAnalytics', to: '/doctor/performance', icon: 'query_stats' },
    { labelKey: 'aiAssistant', to: '/doctor/ai-assistant', icon: 'smart_toy' },
  ],
};

export default function DoctorPerformance() {
  const { t } = useTranslation();
  const sidebarItems = SIDEBAR.items.map((item) => ({ ...item, label: t(`nav.${item.labelKey}`) }));
  const HEATMAP_ROWS = [
    { label: t('performance.general'), values: [1, 2, 3, 2, 1, 0, 0] },
    { label: t('performance.prenatal'), values: [0, 1, 2, 2, 3, 1, 0] },
    { label: t('performance.vaccination'), values: [2, 2, 1, 0, 1, 3, 2] },
    { label: t('performance.chronic'), values: [3, 2, 2, 1, 2, 1, 1] },
  ];
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await doctorService.getDashboard();
        if (!cancelled) {
          setStats(data);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load performance analytics:', err);
          setError(err?.message || 'Failed to load performance analytics');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const achievements = [
    { label: t('performance.ach1'), icon: 'verified', done: true },
    { label: t('performance.ach2'), icon: 'group', done: true },
    { label: t('performance.ach3'), icon: 'timer', done: true },
    { label: t('performance.ach4'), icon: 'videocam', done: false },
  ];

  return (
    <DashboardLayout
      sidebarProps={{ items: sidebarItems }}
      headerProps={{ title: t('performance.title'), subtitle: t('performance.subtitle') }}
    >
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        </div>
      ) : error ? (
        <Card className="max-w-2xl mx-auto text-center py-12">
          <span className="material-symbols-outlined text-6xl text-error mb-4 block">error</span>
          <h3 className="font-headline text-title-lg font-bold mb-2">{t('common.error')}</h3>
          <p className="text-on-surface-variant mb-6">{error}</p>
          <Button onClick={() => window.location.reload()} icon="refresh">
            {t('common.refresh')}
          </Button>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <KPIWidget label={t('performance.totalPatients')} value={stats?.totalPatients?.toLocaleString() ?? '0'} icon="group" color="primary" trend={8} />
            <KPIWidget label={t('performance.resolutionRate')} value="92%" icon="verified" color="secondary" trend={3} />
            <KPIWidget label={t('performance.avgConsultTime')} value="18m" icon="timer" color="tertiary" trend={-5} />
            <KPIWidget label={t('performance.patientSatisfaction')} value="4.8/5" icon="star" color="error" trend={2} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title={t('performance.weeklyConsultations')} subtitle={t('performance.trendLastWeek')}>
              <LineChart labels={[t('schedule.mon'), t('schedule.tue'), t('schedule.wed'), t('schedule.thu'), t('schedule.fri'), t('schedule.sat'), t('schedule.sun')]} data={stats?.consultations ?? []} height={280} />
            </Card>
            <Card title={t('performance.byType')} subtitle={t('performance.typeDistribution')}>
              <BarChart
                labels={[t('performance.general'), t('performance.prenatal'), t('performance.vaccination'), t('performance.chronic'), t('performance.emergency')]}
                data={[140, 95, 120, 80, 45]}
                colors={['#1B5E4F', '#E8734A', '#7C5800', '#00639B', '#BA1A1A']}
                height={280}
              />
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card title={t('performance.serviceCoverage')} subtitle={t('performance.visitsPerWeekday')} className="lg:col-span-2">
              <HeatMap rows={HEATMAP_ROWS} />
            </Card>
            <Card title={t('performance.achievements')} icon="emoji_events" subtitle={t('performance.thisQuarter')}>
              <div className="space-y-3">
                {achievements.map((a) => (
                  <div key={a.label} className="flex items-center gap-3 bg-surface-container-low rounded-lg p-3">
                    <span
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        a.done ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-highest text-outline'
                      }`}
                    >
                      <span className="material-symbols-outlined">{a.icon}</span>
                    </span>
                    <p className={`flex-1 font-medium ${a.done ? 'text-on-surface' : 'text-on-surface-variant'}`}>{a.label}</p>
                    <Badge variant={a.done ? 'success' : 'neutral'}>{a.done ? t('performance.earned') : t('performance.pending')}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
