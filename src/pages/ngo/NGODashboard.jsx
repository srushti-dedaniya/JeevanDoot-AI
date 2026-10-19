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
import { useAuth } from '../../hooks/useAuth';
import { NGO_NAV } from './ngoNav';

const UPCOMING_CAMPS = [
  { id: 'camp-1', name: 'Amroli Eye Checkup Camp', location: 'Amroli PHC', date: 'Fri, Oct 27', status: 'Planned' },
  { id: 'camp-2', name: 'Palia Vaccination Drive', location: 'Palia School', date: 'Sun, Oct 29', status: 'Planned' },
  { id: 'camp-3', name: 'Devgram Nutrition Camp', location: 'Devgram Anganwadi', date: 'Wed, Nov 01', status: 'Planned' },
];

const RECENT_DONATIONS = [
  { id: 'D-2210', donor: 'Seva Foundation', amount: '₹2,50,000', purpose: 'Malaria prevention kits' },
  { id: 'D-2209', donor: 'Rotary Club', amount: '₹1,20,000', purpose: 'Maternal health drive' },
  { id: 'D-2208', donor: 'Azim Premji Trust', amount: '₹3,00,000', purpose: 'Nutrition program' },
];

export default function NGODashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const sidebarItems = NGO_NAV.items.map((item) => ({ ...item, label: t(`nav.${item.labelKey}`) }));

  const headerRight = (
    <>
      <NotificationBell />
      <ProfileMenu />
    </>
  );

  return (
    <DashboardLayout
      sidebarProps={{ items: sidebarItems }}
      headerProps={{
        title: t('ngo.welcomeBack', { name: user?.name ?? t('role.ngo') }),
        subtitle: t('ngo.overviewToday'),
        right: headerRight,
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <KPIWidget label={t('ngo.campsConducted')} value="32" icon="vaccines" color="primary" trend={12} />
        <KPIWidget label={t('ngo.beneficiariesServed')} value="18,420" icon="group" color="secondary" trend={8} />
        <KPIWidget label={t('ngo.activeVolunteers')} value="146" icon="volunteer_activism" color="tertiary" trend={5} />
        <KPIWidget label={t('ngo.fundsRaised')} value="₹8.4L" unit="" icon="payments" color="error" trend={15} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card
          title={t('ngo.outreachTrends')}
          subtitle={t('ngo.beneficiariesByMonth')}
          className="lg:col-span-2"
          headerRight={
            <select className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 text-label-md">
              <option>{t('ngo.monthly')}</option>
              <option>{t('ngo.quarterly')}</option>
            </select>
          }
        >
          <LineChart
            labels={[t('schedule.mon'), t('schedule.tue'), t('schedule.wed'), t('schedule.thu'), t('schedule.fri'), t('ngo.sat'), t('ngo.sun')]}
            data={[1200, 1450, 1320, 1680, 1540, 980, 760]}
            height={280}
          />
        </Card>

        <Card title={t('ngo.coverageDistribution')} subtitle={t('ngo.servicesBreakdown')}>
          <PieChart
            labels={[t('ngo.primaryCare'), t('ngo.vaccination'), t('ngo.awareness'), t('ngo.followUp')]}
            data={[42, 28, 20, 10]}
            colors={['#1B5E4F', '#C8B900', '#E8734A', '#7B61B5']}
            height={200}
          />
          <div className="flex flex-col gap-3 mt-4">
            {['primaryCare', 'vaccination', 'awareness', 'followUp'].map((key, i) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: ['#1B5E4F', '#C8B900', '#E8734A', '#7B61B5'][i] }} />
                  <span className="text-label-md text-on-surface-variant">{t(`ngo.${key}`)}</span>
                </div>
                <span className="font-bold text-on-surface">{[42, 28, 20, 10][i]}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title={t('ngo.upcomingCamps')}
          subtitle={t('ngo.plannedCamps')}
          headerRight={
            <Link to="/ngo/camps">
              <Button variant="outline" size="sm">{t('ngo.viewAllCamps')}</Button>
            </Link>
          }
        >
          <div className="space-y-3">
            {UPCOMING_CAMPS.map((camp) => (
              <div key={camp.id} className="flex items-center gap-4 bg-surface-container-low rounded-lg p-4">
                <span className="w-10 h-10 shrink-0 rounded-xl bg-tertiary-fixed-dim text-tertiary flex items-center justify-center">
                  <span className="material-symbols-outlined">vaccines</span>
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-on-surface truncate">{camp.name}</p>
                  <p className="text-label-sm text-on-surface-variant">{camp.location} · {camp.date}</p>
                </div>
                <Badge variant="warning" dot>{t('ngo.planned')}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card title={t('ngo.recentDonations')} subtitle={t('ngo.latestContributions')}>
          <div className="space-y-3">
            {RECENT_DONATIONS.map((donation) => (
              <div key={donation.id} className="flex items-center gap-4 bg-surface-container-low rounded-lg p-4">
                <span className="w-10 h-10 shrink-0 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center">
                  <span className="material-symbols-outlined">volunteer_activism</span>
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-on-surface truncate">{donation.donor}</p>
                  <p className="text-label-sm text-on-surface-variant">{donation.purpose}</p>
                </div>
                <span className="font-bold text-primary">{donation.amount}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Link to="/ngo/donations">
              <Button variant="ghost" size="sm" icon="arrow_forward">{t('ngo.manageDonations')}</Button>
            </Link>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
