import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import SearchBar from '../../components/common/SearchBar';
import Select from '../../components/common/Select';
import Pagination from '../../components/common/Pagination';
import EmptyState from '../../components/common/EmptyState';
import { patientService } from '../../services/patientService';
import { useDebounce } from '../../hooks/useDebounce';

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

const RISK_BADGE = {
  Critical: 'critical',
  High: 'warning',
  Moderate: 'warning',
  Low: 'success',
};

export default function PatientQueue() {
  const { t } = useTranslation();
  const sidebarItems = SIDEBAR.items.map((item) => ({ ...item, label: t(`nav.${item.labelKey}`) }));
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const all = await patientService.getAll();
      if (!active) return;
      setPatients(all);
      setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const filtered = patients.filter((p) => {
    const matchesQuery =
      !debouncedQuery ||
      p.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      p.village.toLowerCase().includes(debouncedQuery.toLowerCase());
    const matchesRisk = !riskFilter || p.risk === riskFilter;
    return matchesQuery && matchesRisk;
  });

  return (
    <DashboardLayout
      sidebarProps={{ items: sidebarItems }}
      headerProps={{ title: t('queue.title'), subtitle: t('queue.subtitle') }}
    >
      <Card
        title={t('queue.currentQueue')}
        subtitle={t('queue.patientsShown', { count: filtered.length })}
        headerRight={
          <div className="flex items-center gap-3">
            <SearchBar placeholder={t('queue.search')} value={query} onSearch={setQuery} containerClassName="w-72" />
            <Select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              options={[{ value: '', label: t('queue.allRiskLevels') }, ...['Critical', 'High', 'Moderate', 'Low'].map((r) => ({ value: r, label: t(`queue.${r.toLowerCase()}`) }))]}
              className="!h-11 w-44"
            />
          </div>
        }
      >
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="person_off" title={t('queue.noPatientsFound')} description={t('queue.tryAdjusting')} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-primary text-on-primary">
                    <th className="px-6 py-3 font-headline font-semibold">{t('doctor.patientId')}</th>
                    <th className="px-6 py-3 font-headline font-semibold">{t('common.name')}</th>
                    <th className="px-6 py-3 font-headline font-semibold">{t('common.village')}</th>
                    <th className="px-6 py-3 font-headline font-semibold">{t('doctor.complaint')}</th>
                    <th className="px-6 py-3 font-headline font-semibold">{t('common.status')}</th>
                    <th className="px-6 py-3 font-headline font-semibold">{t('common.risk')}</th>
                    <th className="px-6 py-3 font-headline font-semibold">{t('queue.checkIn')}</th>
                    <th className="px-6 py-3 font-headline font-semibold">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b border-outline-variant hover:bg-surface-container-low transition-colors">
                      <td className="px-6 py-4 font-mono font-semibold text-primary">{p.id}</td>
                      <td className="px-6 py-4 font-semibold text-on-surface">{p.name}</td>
                      <td className="px-6 py-4 text-on-surface-variant">{p.village}</td>
                      <td className="px-6 py-4 text-on-surface-variant max-w-[240px] truncate">{p.complaint}</td>
                      <td className="px-6 py-4">
                        <Badge variant={p.status === 'Waiting' ? 'warning' : p.status === 'In Review' ? 'secondary' : 'success'} dot>
                          {p.status === 'Waiting' ? t('queue.waiting') : p.status === 'In Review' ? t('queue.inReview') : p.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={RISK_BADGE[p.risk] ?? 'neutral'}>{t(`queue.${p.risk.toLowerCase()}`)}</Badge>
                      </td>
                      <td className="px-6 py-4 text-on-surface-variant">{p.lastCheckIn}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Link to={`/doctor/case/${p.id}`}>
                            <Button size="sm" variant="outline">{t('common.view')}</Button>
                          </Link>
                          <Link to="/doctor/prescription">
                            <Button size="sm">{t('queue.start')}</Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination items={filtered} perPage={8} />
          </>
        )}
      </Card>
    </DashboardLayout>
  );
}
