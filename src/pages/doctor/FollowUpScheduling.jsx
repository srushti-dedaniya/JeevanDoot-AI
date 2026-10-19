import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Badge from '../../components/common/Badge';
import { useNotification } from '../../hooks/useNotification';
import { appointmentService } from '../../services/appointmentService';

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

const REASON_OPTIONS = ['reasonPrenatal', 'reasonPostop', 'reasonLab', 'reasonChronic', 'reasonVaccination'];

export default function FollowUpScheduling() {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const sidebarItems = SIDEBAR.items.map((item) => ({ ...item, label: t(`nav.${item.labelKey}`) }));
  const DATE_RANGE_OPTIONS = [
    { value: '7', label: t('followup.range7') },
    { value: '14', label: t('followup.range14') },
    { value: '30', label: t('followup.range30') },
  ];
  const MODE_OPTIONS = [
    { value: 'in-person', labelKey: 'followup.inPerson', icon: 'person' },
    { value: 'virtual', labelKey: 'followup.virtual', icon: 'videocam' },
    { value: 'home', labelKey: 'followup.homeVisit', icon: 'home' },
  ];
  const [form, setForm] = useState({
    patientId: 'JD-5XA2MN',
    patientName: 'Meera Sharma',
    date: '',
    time: '',
    reason: 'reasonPrenatal',
    mode: 'in-person',
    range: DATE_RANGE_OPTIONS[0].value,
  });
  const [scheduled, setScheduled] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const rangeLabel = (value) => DATE_RANGE_OPTIONS.find((o) => o.value === value)?.label ?? value;

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!form.date || !form.time) {
      notify({ type: 'error', message: t('followup.pleasePickDateTime') });
      return;
    }
    setSubmitting(true);
    try {
      const created = await appointmentService.create({
        patientId: form.patientId,
        purpose: form.reason,
        date: form.date,
        startTime: form.time,
        notes: `${t('followup.mode')}: ${form.mode}`,
      });
      const entry = { ...form, id: created.id || `FU-${Date.now()}` };
      setScheduled((prev) => [...prev, entry]);
      notify({ type: 'success', message: t('followup.scheduledFor', { name: form.patientName }) });
      setForm((f) => ({ ...f, date: '', time: '' }));
    } catch (err) {
      notify({ type: 'error', message: err?.message || t('followup.scheduleFailed') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout
      sidebarProps={{ items: sidebarItems }}
      headerProps={{ title: t('followup.title'), subtitle: t('followup.subtitle') }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSchedule} className="space-y-6">
          <Card title={t('followup.scheduleFollowUp')} icon="event_available">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('followup.patientId')} value={form.patientId} onChange={update('patientId')} icon="badge" />
              <Input label={t('followup.patientName')} value={form.patientName} onChange={update('patientName')} icon="person" />
              <Input label={t('followup.date')} type="date" value={form.date} onChange={update('date')} icon="calendar_today" required />
              <Input label={t('followup.time')} type="time" value={form.time} onChange={update('time')} icon="schedule" required />
              <div className="md:col-span-2">
                <label className="block text-label-lg font-semibold text-on-surface ml-1 mb-2">{t('followup.reason')}</label>
                <select
                  value={form.reason}
                  onChange={update('reason')}
                  className="w-full h-14 bg-surface-container-low border border-outline-variant rounded-lg px-4 focus:ring-2 focus:ring-primary"
                >
                  {REASON_OPTIONS.map((r) => (
                    <option key={r} value={r}>{t(`followup.${r}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="font-bold text-on-surface mb-2">{t('followup.mode')}</p>
                <div className="flex gap-2">
                  {MODE_OPTIONS.map((mode) => (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, mode: mode.value }))}
                      className={`flex flex-col items-center gap-1 px-4 py-3 rounded-lg border text-label-md transition-all ${
                        form.mode === mode.value
                          ? 'bg-primary text-on-primary border-primary'
                          : 'bg-surface-container-low border-outline-variant text-on-surface-variant'
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg">{mode.icon}</span>
                      {t(mode.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <Button type="submit" fullWidth className="mt-6" icon="event_available" size="lg" loading={submitting}>
              {t('followup.scheduleFollowUp')}
            </Button>
          </Card>

          <Card title={t('followup.quickFilter')} icon="filter_alt">
            <div className="flex flex-wrap gap-2">
              {DATE_RANGE_OPTIONS.map((range) => (
                <button
                  key={range.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, range: range.value }))}
                  className={`px-4 py-2 rounded-full text-label-md transition-colors ${
                    form.range === range.value ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant border border-outline-variant'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </Card>
        </form>

        <div className="lg:col-span-2">
          <Card
            title={t('followup.upcomingFollowUps')}
            subtitle={t('followup.scheduledIn', { count: scheduled.length, range: rangeLabel(form.range) })}
            icon="upcoming"
            headerRight={
              <Badge variant="secondary" icon="notifications_active">
                {t('followup.remindersEnabled')}
              </Badge>
            }
          >
            {scheduled.length === 0 ? (
              <div className="text-center py-12 text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl mb-3 block">event_note</span>
                {t('followup.noFollowUpsYet')}
              </div>
            ) : (
              <div className="space-y-3">
                {scheduled.map((s) => (
                  <div key={s.id} className="flex items-center justify-between bg-surface-container-low rounded-lg p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex flex-col items-center justify-center font-headline">
                        <span className="text-label-sm font-bold leading-none">
                          {new Date(s.date).toLocaleString('en-US', { month: 'short' })}
                        </span>
                        <span className="text-title-md font-bold leading-none">
                          {new Date(s.date).getDate()}
                        </span>
                      </div>
                      <div>
                        <p className="font-bold text-on-surface">{s.patientName} · {s.patientId}</p>
                        <p className="text-label-md text-on-surface-variant">
                          {t(`followup.${s.reason}`)} · {new Date(s.date).toLocaleDateString()} {t('followup.at')} {s.time}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" icon={s.mode === 'virtual' ? 'videocam' : s.mode === 'home' ? 'home' : 'person'}>
                        {s.mode === 'in-person' ? t('followup.inPerson') : s.mode === 'virtual' ? t('followup.virtual') : t('followup.homeVisit')}
                      </Badge>
                      <Button size="sm" variant="ghost" onClick={() => setScheduled((prev) => prev.filter((x) => x.id !== s.id))}>
                        {t('common.remove')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
