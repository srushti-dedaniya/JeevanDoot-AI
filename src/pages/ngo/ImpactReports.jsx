import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import LineChart from '../../components/charts/LineChart';
import PieChart from '../../components/charts/PieChart';
import { useNotification } from '../../hooks/useNotification';
import { downloadImpactReportPDF } from '../../utils/pdfUtils';
import { useTranslation } from 'react-i18next';
import { NGO_NAV } from './ngoNav';

export default function ImpactReports() {
  const { notify } = useNotification();
  const { t } = useTranslation();

  const IMPACT_STATS = [
    { labelKey: 'patientsReached', label: 'Patients Reached', value: '18,420', icon: 'group', noteKey: 'thisYear', note: 'This year' },
    { labelKey: 'villagesCovered', label: 'Villages Covered', value: '27', icon: 'location_on', noteKey: 'acrossBlock', note: 'Across the block' },
    { labelKey: 'vaccinations', label: 'Vaccinations', value: '9,310', icon: 'vaccines', noteKey: 'driveCompletion', note: 'Drive completion 94%' },
    { labelKey: 'trainingSessions', label: 'Training Sessions', value: '84', icon: 'school', noteKey: 'forVolunteers', note: 'For volunteers & staff' },
  ];

  const sidebarItems = NGO_NAV.items.map((item) => ({ ...item, label: t(`nav.${item.labelKey}`) }));

  const stats = IMPACT_STATS.map((stat) => ({
    ...stat,
    label: t(`ngo.impact.${stat.labelKey}`),
    note: t(`ngo.impact.${stat.noteKey}`),
  }));

  const handleExport = () => {
    downloadImpactReportPDF({
      title: 'Quarterly Impact Report',
      organization: 'Seva Samiti Foundation',
      period: 'Q1 – Q4 · FY 2026',
      stats: IMPACT_STATS,
      quarterlyLabels: ['Q1', 'Q2', 'Q3', 'Q4'],
      quarterlyData: [2800, 4100, 5600, 5900],
      serviceSplit: [
        { label: 'Primary Care', value: 42 },
        { label: 'Vaccination', value: 28 },
        { label: 'Awareness', value: 20 },
        { label: 'Follow-up', value: 10 },
      ],
      activities: [
        'Completed 500-bed mosquito net distribution in Amroli',
        'Vaccination drive wrapped up at Palia School — 340 children',
        'New partner signed: Amroli General Hospital',
      ],
    });
    notify({ type: 'success', message: t('ngo.impact.exported') });
  };

  return (
    <DashboardLayout
      sidebarProps={{ items: sidebarItems }}
      headerProps={{
        title: t('ngo.impact.title'),
        subtitle: t('ngo.impact.subtitle'),
        right: <Button variant="outline" icon="download" onClick={handleExport}>{t('ngo.impact.export')}</Button>,
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-surface-container-lowest rounded-2xl p-6 card-shadow flex flex-col gap-3">
            <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined">{stat.icon}</span>
            </div>
            <div>
              <p className="font-headline text-headline-2xl font-bold text-on-surface">{stat.value}</p>
              <p className="text-label-md font-semibold text-on-surface mt-1">{stat.label}</p>
              <p className="text-label-sm text-on-surface-variant mt-0.5">{stat.note}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title={t('ngo.impact.outreachGrowth')} subtitle={t('ngo.impact.beneficiariesPerQuarter')} className="lg:col-span-2">
          <LineChart
            labels={['Q1', 'Q2', 'Q3', 'Q4']}
            data={[2800, 4100, 5600, 5900]}
            height={260}
          />
        </Card>

        <Card title={t('ngo.impact.serviceSplit')} subtitle={t('ngo.impact.shareOfActivities')}>
          <PieChart
            labels={[t('ngo.primaryCare'), t('ngo.vaccination'), t('ngo.awareness'), t('ngo.followUp')]}
            data={[42, 28, 20, 10]}
            colors={['#1B5E4F', '#C8B900', '#E8734A', '#7B61B5']}
            height={180}
          />
          <div className="flex flex-wrap gap-2 mt-4">
            {[t('ngo.primaryCare'), t('ngo.vaccination'), t('ngo.awareness'), t('ngo.followUp')].map((label, i) => (
              <Badge key={label} variant={['success', 'warning', 'critical', 'neutral'][i]}>
                {label}
              </Badge>
            ))}
          </div>
        </Card>
      </div>

      <Card title={t('ngo.impact.recentActivity')} icon="history" subtitle={t('ngo.impact.latestMilestones')}>
        <div className="space-y-4">
          {[
            { text: 'Completed 500-bed mosquito net distribution in Amroli', time: '2 hours ago', tag: 'Distribution' },
            { text: 'Vaccination drive wrapped up at Palia School — 340 children', time: 'Yesterday', tag: 'Vaccination' },
            { text: 'New partner signed: Amroli General Hospital', time: '2 days ago', tag: 'Partnership' },
          ].map((item) => (
            <div key={item.text} className="flex items-start gap-4 bg-surface-container-low rounded-lg p-4">
              <span className="w-9 h-9 shrink-0 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">check</span>
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-body-md text-on-surface">{item.text}</p>
                <p className="text-label-sm text-on-surface-variant mt-0.5">{item.time}</p>
              </div>
              <Badge variant="neutral">{item.tag}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </DashboardLayout>
  );
}
