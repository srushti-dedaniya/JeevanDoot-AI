import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PatientSidebar from '../../components/layout/PatientSidebar';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { cx } from '../../utils/helpers';

const STORAGE_KEY = 'jd_patient_notifications';

const DEFAULT_NOTIFICATIONS = [
  {
    id: 'pn-1',
    type: 'appointment',
    title: 'Appointment Reminder',
    message: 'Your appointment with Dr. Rajesh Kumar is tomorrow at 10:30 AM at Amroli Primary Health Centre.',
    time: '2 hours ago',
    read: false,
  },
  {
    id: 'pn-2',
    type: 'prescription',
    title: 'Prescription Ready',
    message: 'Prescription RX-2025-0142 is ready. You can view and download it from My Prescriptions.',
    time: 'Yesterday',
    read: false,
  },
  {
    id: 'pn-3',
    type: 'report',
    title: 'Lab Report Uploaded',
    message: 'Your Complete Blood Count & Lipid Profile report has been uploaded to Reports.',
    time: '2 days ago',
    read: false,
  },
  {
    id: 'pn-4',
    type: 'message',
    title: 'Doctor Message',
    message: 'Dr. Sunita Patel: Please share your latest fasting blood sugar readings before our next visit.',
    time: '3 days ago',
    read: true,
  },
  {
    id: 'pn-5',
    type: 'appointment',
    title: 'Appointment Reminder',
    message: 'Your follow-up with Dr. Sunita Patel is scheduled for August 2 at 11:00 AM. Please carry your HbA1c report.',
    time: '1 week ago',
    read: true,
  },
];

const TYPE_META = {
  appointment: { icon: 'event_available', tone: 'bg-primary-fixed-dim/40 text-primary' },
  prescription: { icon: 'medication', tone: 'bg-secondary-container/60 text-on-secondary-container' },
  report: { icon: 'description', tone: 'bg-tertiary-container/40 text-tertiary' },
  message: { icon: 'chat', tone: 'bg-success-container text-on-success-container' },
};

const loadNotifications = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    /* ignore storage errors */
  }
  return DEFAULT_NOTIFICATIONS;
};

export default function Notifications() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState(loadNotifications);
  const [filter, setFilter] = useState('All');

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch {
      /* ignore storage errors */
    }
  }, [notifications]);

  const markAsRead = (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    toast.success(t('patient.notifications.markedRead'));
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success(t('patient.notifications.allMarkedRead'));
  };

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    toast.success(t('patient.notifications.deleted'));
  };

  const filtered = filter === 'Unread' ? notifications.filter((n) => !n.read) : notifications;

  const filters = [
    { key: 'All', labelKey: 'filterAll' },
    { key: 'Unread', labelKey: 'filterUnread' },
  ];

  return (
    <DashboardLayout
      sidebar={<PatientSidebar />}
      headerProps={{ title: t('patient.notifications.title'), subtitle: t('patient.notifications.subtitle') }}
    >
      <Card
        title={t('patient.notifications.title')}
        icon="notifications"
        subtitle={t(
          notifications.length === 1 ? 'patient.notifications.countOne' : 'patient.notifications.countMany',
          { count: notifications.length }
        )}
        headerRight={
          unreadCount > 0 && (
            <Button variant="outline" size="sm" icon="mark_email_read" onClick={markAllRead}>
              {t('patient.notifications.markAllRead')}
            </Button>
          )
        }
      >
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-error-container text-on-error-container font-bold text-label-md">
            <span className="material-symbols-outlined text-[16px]">notifications</span>
            {t('patient.notifications.unread', { count: unreadCount })}
          </span>
          <div className="flex items-center gap-2">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cx(
                  'px-3 py-1.5 rounded-full text-label-md font-bold transition-colors',
                  filter === f.key
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                )}
              >
                {t(`patient.notifications.${f.labelKey}`)}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-14">
            <span className="material-symbols-outlined text-5xl text-outline">notifications_off</span>
            <p className="font-bold text-on-surface mt-3">
              {filter === 'Unread' ? t('patient.notifications.noUnread') : t('patient.notifications.noneYet')}
            </p>
            <p className="text-on-surface-variant text-label-md mt-1">
              {t('patient.notifications.allCaughtUp')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant">
            {filtered.map((n) => {
              const meta = TYPE_META[n.type] ?? TYPE_META.message;
              return (
                <div
                  key={n.id}
                  className={cx(
                    'flex items-start gap-4 px-2 py-4 transition-colors',
                    !n.read && 'bg-primary-fixed/10 rounded-lg px-4'
                  )}
                >
                  <span
                    className={cx(
                      'mt-0.5 w-11 h-11 rounded-full flex items-center justify-center material-symbols-outlined text-xl shrink-0',
                      meta.tone
                    )}
                  >
                    {meta.icon}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={cx('text-on-surface', n.read ? 'font-semibold' : 'font-bold')}>{n.title}</p>
                      {!n.read && (
                        <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" aria-label={t('patient.notifications.unreadAria')} />
                      )}
                    </div>
                    <p className="text-on-surface-variant text-body-md mt-0.5">{n.message}</p>
                    <p className="text-label-sm text-on-surface-variant/80 mt-1">{n.time}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {!n.read && (
                      <button
                        type="button"
                        onClick={() => markAsRead(n.id)}
                        className="p-2 rounded-full text-primary hover:bg-primary-container/30 transition-colors"
                        title={t('patient.notifications.markAsRead')}
                        aria-label={t('patient.notifications.markAsReadAria', { title: n.title })}
                      >
                        <span className="material-symbols-outlined text-lg">check</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeNotification(n.id)}
                      className="p-2 rounded-full text-error hover:bg-error-container transition-colors"
                      title={t('patient.notifications.delete')}
                      aria-label={t('patient.notifications.deleteAria', { title: n.title })}
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </DashboardLayout>
  );
}
