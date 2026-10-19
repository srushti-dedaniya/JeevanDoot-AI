import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../../components/layout/DashboardLayout';
import NotificationBell from '../../components/layout/NotificationBell';
import ProfileMenu from '../../components/layout/ProfileMenu';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import KPIWidget from '../../components/charts/KPIWidget';
import LineChart from '../../components/charts/LineChart';
import PieChart from '../../components/charts/PieChart';
import { doctorService } from '../../services/doctorService';
import { patientService } from '../../services/patientService';
import { useAuth } from '../../hooks/useAuth';

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

export default function DoctorDashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [statsData, patientsData] = await Promise.all([
          doctorService.getDashboard(),
          patientService.getAll(),
        ]);
        if (!cancelled) {
          setStats(statsData);
          setPatients(patientsData);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load doctor dashboard:', err);
          setError(err?.message || 'Failed to load dashboard');
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

  const highRisk = patients.filter((p) => p.risk === 'Critical').slice(0, 4);
  const sidebarItems = SIDEBAR.items.map((item) => ({ ...item, label: t(`nav.${item.labelKey}`) }));

  const headerRight = (
    <>
      <NotificationBell />
      <ProfileMenu />
    </>
  );

  if (loading) {
    return (
      <DashboardLayout sidebarProps={{ items: sidebarItems }} headerProps={{ title: t('nav.dashboard'), subtitle: t('doctor.overview'), right: headerRight }}>
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout sidebarProps={{ items: sidebarItems }} headerProps={{ title: t('nav.dashboard'), subtitle: t('doctor.overview'), right: headerRight }}>
        <Card className="max-w-2xl mx-auto text-center py-12">
          <span className="material-symbols-outlined text-6xl text-error mb-4 block">error</span>
          <h3 className="font-headline text-title-lg font-bold mb-2">{t('common.error')}</h3>
          <p className="text-on-surface-variant mb-6">{error}</p>
          <Button onClick={() => window.location.reload()} icon="refresh">
            {t('common.refresh')}
          </Button>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      sidebarProps={{ items: sidebarItems }}
      headerProps={{ title: t('doctor.welcomeBack', { name: user?.name ?? t('role.doctor') }), subtitle: t('doctor.overviewToday'), right: headerRight }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <KPIWidget label={t('doctor.patientsToday')} value={stats?.patientsToday ?? 0} icon="people" color="primary" trend={12} />
        <KPIWidget label={t('doctor.totalPatients')} value={stats?.totalPatients?.toLocaleString() ?? '0'} icon="group" color="secondary" trend={5} />
        <KPIWidget label={t('doctor.urgentCases')} value={stats?.urgentCases ?? 0} icon="warning" color="error" trend={-3} />
        <KPIWidget label={t('doctor.avgResponseTime')} value={stats?.avgResponse ?? '0m'} unit="" icon="timer" color="tertiary" trend={8} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card
          title={t('doctor.consultationTrends')}
          subtitle={t('doctor.thisWeek')}
          className="lg:col-span-2"
          headerRight={
            <select className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 text-label-md">
              <option>{t('doctor.weekly')}</option>
              <option>{t('doctor.monthly')}</option>
            </select>
          }
        >
          <LineChart labels={[t('schedule.mon'), t('schedule.tue'), t('schedule.wed'), t('schedule.thu'), t('schedule.fri'), t('schedule.sat'), t('schedule.sun')]} data={stats?.consultations ?? []} height={280} />
        </Card>

        <Card title={t('doctor.outcomeDistribution')} subtitle={t('doctor.resolvedVsReferred')}>
          <PieChart
            labels={[t('doctor.resolved'), t('doctor.referred'), t('doctor.followUp')]}
            data={stats?.outcomes ?? [0, 0, 0]}
            colors={['#1B5E4F', '#C8B900', '#E8734A']}
            height={220}
          />
          <div className="flex flex-col gap-3 mt-4">
            {['resolved', 'referred', 'followUp'].map((key, i) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: ['#1B5E4F', '#C8B900', '#E8734A'][i] }} />
                  <span className="text-label-md text-on-surface-variant">{t(`doctor.${key}`)}</span>
                </div>
                <span className="font-bold text-on-surface">{stats?.outcomes?.[i] ?? 0}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card
        title={t('doctor.priorityQueue')}
        subtitle={t('doctor.patientsNeedingAttention')}
        headerRight={
          <Link to="/doctor/queue">
            <Button variant="outline" size="sm">{t('doctor.viewFullQueue')}</Button>
          </Link>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-primary text-on-primary">
                <th className="px-6 py-3 font-headline font-semibold">{t('doctor.patientId')}</th>
                <th className="px-6 py-3 font-headline font-semibold">{t('common.name')}</th>
                <th className="px-6 py-3 font-headline font-semibold">{t('doctor.complaint')}</th>
                <th className="px-6 py-3 font-headline font-semibold">{t('common.status')}</th>
                <th className="px-6 py-3 font-headline font-semibold">{t('common.risk')}</th>
                <th className="px-6 py-3 font-headline font-semibold">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {patients.slice(0, 5).map((p) => (
                <tr key={p.id} className="border-b border-outline-variant hover:bg-surface-container-low">
                  <td className="px-6 py-3 font-mono font-semibold text-primary">{p.id}</td>
                  <td className="px-6 py-3 font-semibold">{p.name}</td>
                  <td className="px-6 py-3 text-on-surface-variant max-w-[260px] truncate">{p.complaint}</td>
                  <td className="px-6 py-3">
                    <Badge variant={p.status === 'Waiting' ? 'warning' : 'neutral'}>
                      {p.status === 'Waiting' ? t('queue.waiting') : p.status === 'In Review' ? t('queue.inReview') : p.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-3">
                    <Badge variant={p.risk === 'Critical' ? 'critical' : p.risk === 'Moderate' ? 'warning' : 'success'}>
                      {t(`queue.${p.risk.toLowerCase()}`)}
                    </Badge>
                  </td>
                  <td className="px-6 py-3">
                    <Link to={`/doctor/case/${p.id}`}>
                      <Button size="sm">{t('doctor.viewCase')}</Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {patients.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-on-surface-variant">
                    {t('queue.noPatientsFound')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {highRisk.length > 0 && (
        <div className="bg-error-container rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-3xl text-on-error-container">emergency</span>
            <div>
              <h4 className="font-headline font-bold text-on-error-container">{t('doctor.highRiskAlert')}</h4>
              <p className="text-sm text-on-error-container/80">
                {t('doctor.criticalPatientsCount', { count: highRisk.length })}
              </p>
            </div>
          </div>
          <Link to="/doctor/queue">
            <Button variant="danger">{t('doctor.reviewNow')}</Button>
          </Link>
        </div>
      )}
    </DashboardLayout>
  );
}
