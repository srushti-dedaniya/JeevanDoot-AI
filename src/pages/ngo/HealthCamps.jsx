import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import SearchBar from '../../components/common/SearchBar';
import { useNotification } from '../../hooks/useNotification';
import { NGO_NAV } from './ngoNav';

const CAMP_TYPES = ['General Checkup', 'Vaccination Drive', 'Eye Camp', 'Nutrition Camp', 'Screening Camp'];

const STATUS_STYLE = {
  Planned: 'warning',
  Active: 'success',
  Completed: 'neutral',
};

export default function HealthCamps() {
  const { notify } = useNotification();
  const { t } = useTranslation();
  const [camps, setCamps] = useState([
    { id: 'HC-2214', name: 'Amroli Eye Checkup Camp', type: 'Eye Camp', location: 'Amroli PHC', date: 'Oct 27', beneficiaries: 0, status: 'Planned' },
    { id: 'HC-2213', name: 'Palia Vaccination Drive', type: 'Vaccination Drive', location: 'Palia School', date: 'Oct 29', beneficiaries: 0, status: 'Planned' },
    { id: 'HC-2212', name: 'Devgram Nutrition Camp', type: 'Nutrition Camp', location: 'Devgram Anganwadi', date: 'Oct 22', beneficiaries: 412, status: 'Active' },
    { id: 'HC-2211', name: 'Bijapur Screening Camp', type: 'Screening Camp', location: 'Bijapur Sector 2', date: 'Oct 15', beneficiaries: 618, status: 'Completed' },
  ]);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ name: '', type: CAMP_TYPES[0], location: '', date: '', doctor: '' });

  const STATUS_FLOW = ['Planned', 'Active', 'Completed'];

  const STATUS_LABELS = {
    Planned: t('ngo.planned'),
    Active: t('common.active'),
    Completed: t('common.completed'),
  };

  const sidebarItems = NGO_NAV.items.map((item) => ({ ...item, label: t(`nav.${item.labelKey}`) }));

  const filtered = camps.filter(
    (c) =>
      !query ||
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.location.toLowerCase().includes(query.toLowerCase())
  );

  const changeStatus = (id, status) => {
    const camp = camps.find((c) => c.id === id);
    if (!camp || camp.status === status) return;
    setCamps((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status } : c))
    );
    notify({ type: 'success', message: t('ngo.camps.markedAs', { id: camp.id, status: STATUS_LABELS[status] }) });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const entry = { id: `HC-${Date.now().toString().slice(-4)}`, ...form, beneficiaries: 0, status: 'Planned' };
    setCamps((prev) => [entry, ...prev]);
    setShowForm(false);
    setForm({ name: '', type: CAMP_TYPES[0], location: '', date: '', doctor: '' });
    notify({ type: 'success', message: t('ngo.camps.scheduled', { id: entry.id }) });
  };

  return (
    <DashboardLayout
      sidebarProps={{ items: sidebarItems }}
      headerProps={{
        title: t('ngo.camps.title'),
        subtitle: t('ngo.camps.subtitle', { count: camps.length }),
        right: <Button icon="add" onClick={() => setShowForm(true)}>{t('ngo.camps.newCamp')}</Button>,
      }}
    >
      {showForm && (
        <form onSubmit={handleSubmit}>
          <Card title={t('ngo.camps.formTitle')} icon="vaccines">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-label-lg font-semibold text-on-surface ml-1 mb-2">{t('ngo.camps.campName')}</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t('ngo.camps.campNamePlaceholder')}
                  required
                  className="w-full h-14 px-4 bg-surface-container-low border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-label-lg font-semibold text-on-surface ml-1 mb-2">{t('common.type')}</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full h-14 bg-surface-container-low border border-outline-variant rounded-lg px-4 focus:ring-2 focus:ring-primary"
                >
                  {CAMP_TYPES.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-label-lg font-semibold text-on-surface ml-1 mb-2">{t('ngo.camps.location')}</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder={t('ngo.camps.locationPlaceholder')}
                  required
                  className="w-full h-14 px-4 bg-surface-container-low border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-label-lg font-semibold text-on-surface ml-1 mb-2">{t('common.date')}</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  required
                  className="w-full h-14 px-4 bg-surface-container-low border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-label-lg font-semibold text-on-surface ml-1 mb-2">{t('ngo.camps.doctor')}</label>
                <input
                  value={form.doctor}
                  onChange={(e) => setForm((f) => ({ ...f, doctor: e.target.value }))}
                  placeholder={t('ngo.camps.doctorPlaceholder')}
                  className="w-full h-14 px-4 bg-surface-container-low border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button type="submit" icon="send">{t('ngo.camps.scheduleCamp')}</Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
            </div>
          </Card>
        </form>
      )}

      <Card
        title={t('ngo.camps.allCamps')}
        subtitle={t('ngo.camps.shown', { count: filtered.length })}
        headerRight={<SearchBar placeholder={t('ngo.camps.searchPlaceholder')} onSearch={setQuery} containerClassName="w-64" />}
      >
        {filtered.length === 0 ? (
          <p className="text-center text-on-surface-variant py-12">{t('ngo.camps.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-primary text-on-primary">
                  <th className="px-6 py-3 font-headline font-semibold">{t('common.id')}</th>
                  <th className="px-6 py-3 font-headline font-semibold">{t('ngo.camps.camp')}</th>
                  <th className="px-6 py-3 font-headline font-semibold">{t('common.type')}</th>
                  <th className="px-6 py-3 font-headline font-semibold">{t('ngo.camps.location')}</th>
                  <th className="px-6 py-3 font-headline font-semibold">{t('common.date')}</th>
                  <th className="px-6 py-3 font-headline font-semibold">{t('ngo.camps.beneficiaries')}</th>
                  <th className="px-6 py-3 font-headline font-semibold">{t('common.status')}</th>
                  <th className="px-6 py-3 font-headline font-semibold">{t('ngo.camps.action')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-outline-variant hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-4 font-mono font-semibold text-primary">{c.id}</td>
                    <td className="px-6 py-4 font-semibold">{c.name}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{c.type}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{c.location}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{c.date}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{c.beneficiaries || '—'}</td>
                    <td className="px-6 py-4">
                      <Badge variant={STATUS_STYLE[c.status]} dot>{STATUS_LABELS[c.status]}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={c.status}
                        onChange={(e) => changeStatus(c.id, e.target.value)}
                        className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 text-label-md focus:ring-2 focus:ring-primary"
                        aria-label={t('ngo.camps.updateStatusAria', { name: c.name })}
                      >
                        {STATUS_FLOW.map((status) => (
                          <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </DashboardLayout>
  );
}
