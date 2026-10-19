import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PatientSidebar from '../../components/layout/PatientSidebar';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { formatDate } from '../../utils/formatDate';
import { cx } from '../../utils/helpers';
import { usePatient } from '../../hooks/usePatient';

const greetingKey = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'patient.dashboard.greetingMorning';
  if (hour < 17) return 'patient.dashboard.greetingAfternoon';
  return 'patient.dashboard.greetingEvening';
};

const STAT_CARDS = [
  {
    labelKey: 'upcomingAppointments',
    value: 2,
    icon: 'event',
    color: 'bg-primary',
    iconBg: 'bg-primary-container text-on-primary-container',
    sublabelKey: 'statNextAppointment',
    sublabelArgs: { date: 'Aug 15, 2026' },
    to: '/patient/appointments',
  },
  {
    labelKey: 'activePrescriptions',
    value: 1,
    icon: 'medication',
    color: 'bg-secondary',
    iconBg: 'bg-secondary-container text-on-secondary-container',
    sublabelKey: 'statPrescriptionRunning',
    sublabelArgs: { id: 'RX-2025-0098' },
    to: '/patient/prescriptions',
  },
  {
    labelKey: 'reportsAvailable',
    value: 5,
    icon: 'description',
    color: 'bg-tertiary',
    iconBg: 'bg-tertiary-container text-on-tertiary-container',
    sublabelKey: 'statLatestReport',
    sublabelArgs: { date: 'Aug 5, 2026' },
    to: '/patient/reports',
  },
  {
    labelKey: 'healthScore',
    value: '84',
    unit: '/100',
    icon: 'favorite',
    color: 'bg-primary',
    iconBg: 'bg-error-container text-on-error-container',
    sublabelKey: 'statHealthScoreSublabel',
    to: '/patient/monitoring',
  },
];

const QUICK_ACTIONS = [
  {
    titleKey: 'bookAppointment',
    descKey: 'bookAppointmentDesc',
    icon: 'calendar_add_on',
    to: '/patient/appointments',
  },
  {
    titleKey: 'viewPrescriptions',
    descKey: 'viewPrescriptionsDesc',
    icon: 'medical_information',
    to: '/patient/prescriptions',
  },
  {
    titleKey: 'viewReports',
    descKey: 'viewReportsDesc',
    icon: 'folder_open',
    to: '/patient/reports',
  },
];

const RECENT_ACTIVITY = [
  {
    icon: 'description',
    titleKey: 'activityReportAvailable',
    desc: 'Amroli PHC · CBC & lipid profile',
    date: 'Aug 5, 2026',
    badgeKey: 'new',
    badgeVariant: 'primary',
  },
  {
    icon: 'event_available',
    titleKey: 'activityAppointmentConfirmed',
    desc: 'Dr. Rajesh Kumar · Aug 15, 10:30 AM',
    date: 'Aug 4, 2026',
  },
  {
    icon: 'monitor_heart',
    titleKey: 'activityBpRecorded',
    desc: '135/84 mmHg — within target range',
    date: 'Aug 4, 2026',
  },
  {
    icon: 'medication',
    titleKey: 'activityRefillApproved',
    desc: 'RX-2025-0098 · Metformin 500mg',
    date: 'Aug 2, 2026',
  },
  {
    icon: 'vaccines',
    titleKey: 'activityVaccinationReminder',
    desc: 'Seasonal flu vaccine recommended before monsoon',
    date: 'Jul 30, 2026',
  },
];

const HEALTH_FACTORS = [
  { labelKey: 'factorBloodPressure', value: '135/84', statusKey: 'statusStable', pct: 82, tone: 'bg-primary' },
  { labelKey: 'factorBloodSugar', value: '118 mg/dL', statusKey: 'statusNormal', pct: 78, tone: 'bg-tertiary' },
  { labelKey: 'factorBmi', value: '22.1', statusKey: 'statusIdeal', pct: 90, tone: 'bg-primary' },
  { labelKey: 'factorHeartRate', value: '76 bpm', statusKey: 'statusNormal', pct: 74, tone: 'bg-tertiary' },
];

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { patient } = usePatient();

  return (
    <DashboardLayout
      sidebar={<PatientSidebar />}
      headerProps={{ title: t('nav.dashboard'), subtitle: t('patient.dashboard.subtitle') }}
    >
      <div className="space-y-6">
        <section className="bg-gradient-to-r from-primary to-tertiary rounded-2xl p-6 sm:p-8 text-on-primary relative overflow-hidden">
          <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-[140px] opacity-10">
            favorite
          </span>
          <div className="relative">
            <p className="font-headline text-headline-lg font-bold">
              {t(greetingKey())}, {patient.name.split(' ')[0]} 👋
            </p>
            <p className="text-on-primary/80 mt-1">{formatDate(new Date(), 'EEEE, MMMM d, yyyy')}</p>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <Badge variant="primary" icon="badge">{patient.patientId}</Badge>
              <Badge variant="primary" icon="water_drop">{patient.bloodGroup}</Badge>
              <Badge variant="primary" icon="monitor_heart">
                {t('patient.dashboard.healthScoreValue', { value: '84' })}
              </Badge>
            </div>
            <p className="mt-4 max-w-xl text-on-primary/90">
              {t('patient.dashboard.nextAppointment', {
                doctor: 'Dr. Rajesh Kumar',
                date: 'Aug 15, 2026',
                time: '10:30 AM',
              })}
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {STAT_CARDS.map((card) => (
            <button
              key={card.labelKey}
              type="button"
              onClick={() => navigate(card.to)}
              className="text-left bg-surface-container-lowest rounded-2xl p-5 card-shadow border border-outline-variant/20 transition-transform hover:-translate-y-1"
            >
              <div className="flex items-center justify-between">
                <span className={cx('w-11 h-11 rounded-full flex items-center justify-center', card.iconBg)}>
                  <span className="material-symbols-outlined">{card.icon}</span>
                </span>
                <span className="material-symbols-outlined text-on-surface-variant">arrow_outward</span>
              </div>
              <p className="mt-4 font-headline text-headline-2xl font-bold text-on-surface">
                {card.value}
                {card.unit && <span className="text-body-lg text-on-surface-variant font-normal"> {card.unit}</span>}
              </p>
              <p className="font-bold text-on-surface text-sm">{t(`patient.dashboard.${card.labelKey}`)}</p>
              <p className="text-label-md text-on-surface-variant mt-0.5">
                {t(`patient.dashboard.${card.sublabelKey}`, card.sublabelArgs)}
              </p>
            </button>
          ))}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card
              title={t('patient.dashboard.quickActions')}
              subtitle={t('patient.dashboard.quickActionsSubtitle')}
              icon="bolt"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.titleKey}
                    type="button"
                    onClick={() => navigate(action.to)}
                    className="group text-left bg-surface-container-low rounded-xl p-5 border border-outline-variant/20 hover:bg-primary-container/40 hover:border-primary/40 transition-colors"
                  >
                    <span className="w-11 h-11 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined">{action.icon}</span>
                    </span>
                    <p className="mt-3 font-bold text-on-surface text-sm">{t(`patient.dashboard.${action.titleKey}`)}</p>
                    <p className="text-label-md text-on-surface-variant mt-0.5">{t(`patient.dashboard.${action.descKey}`)}</p>
                  </button>
                ))}
              </div>
            </Card>

            <Card
              title={t('patient.dashboard.recentActivity')}
              subtitle={t('patient.dashboard.recentActivitySubtitle')}
              icon="history"
              headerRight={
                <Button variant="ghost" size="sm" icon="arrow_forward" onClick={() => navigate('/patient/notifications')}>
                  {t('common.viewAll')}
                </Button>
              }
            >
              <div className="divide-y divide-outline-variant">
                {RECENT_ACTIVITY.map((item) => (
                  <div key={item.titleKey} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
                    <span className="w-10 h-10 rounded-full bg-surface-container-high text-primary flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-lg">{item.icon}</span>
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-on-surface text-sm">{t(`patient.dashboard.${item.titleKey}`)}</p>
                        {item.badgeKey && <Badge variant={item.badgeVariant}>{t(`patient.dashboard.${item.badgeKey}`)}</Badge>}
                      </div>
                      <p className="text-label-md text-on-surface-variant">{item.desc}</p>
                    </div>
                    <span className="text-label-md text-on-surface-variant shrink-0">{item.date}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card
            title={t('patient.dashboard.healthScore')}
            subtitle={t('patient.dashboard.healthScoreSubtitle')}
            icon="favorite"
          >
            <div className="flex items-center justify-center py-4">
              <div className="relative w-36 h-36">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  <circle cx="60" cy="60" r="52" fill="none" strokeWidth="12" className="stroke-surface-container-high" />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    strokeWidth="12"
                    strokeLinecap="round"
                    className="stroke-primary"
                    strokeDasharray={`${(84 / 100) * 326.7} 326.7`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-headline text-headline-2xl font-bold text-on-surface">84</span>
                  <span className="text-label-md text-on-surface-variant">/ 100</span>
                </div>
              </div>
            </div>
            <div className="flex justify-center mb-4">
              <Badge variant="success" icon="monitor_heart">{t('patient.dashboard.good')}</Badge>
            </div>
            <div className="space-y-3">
              {HEALTH_FACTORS.map((f) => (
                <div key={f.labelKey}>
                  <div className="flex items-center justify-between text-label-md">
                    <span className="font-bold text-on-surface">{t(`patient.dashboard.${f.labelKey}`)}</span>
                    <span className="text-on-surface-variant">{f.value} · {t(`patient.dashboard.${f.statusKey}`)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                    <div className={cx('h-full rounded-full', f.tone)} style={{ width: `${f.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5">
              <Button variant="secondary" fullWidth icon="monitoring" onClick={() => navigate('/patient/monitoring')}>
                {t('patient.dashboard.viewMonitoring')}
              </Button>
            </div>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}
