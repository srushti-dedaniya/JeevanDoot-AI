import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from '../../utils/helpers';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useAuth } from '../../hooks/useAuth';

const DOCTOR_NOTIFICATIONS = [
  {
    id: 'n1',
    titleKey: 'n1Title',
    descKey: 'n1Desc',
    timeKey: 'n1Time',
    icon: 'person_add',
    tone: 'primary',
    unread: true,
  },
  {
    id: 'n2',
    titleKey: 'n2Title',
    descKey: 'n2Desc',
    timeKey: 'n2Time',
    icon: 'event_available',
    tone: 'secondary',
    unread: true,
  },
  {
    id: 'n3',
    titleKey: 'n3Title',
    descKey: 'n3Desc',
    timeKey: 'n3Time',
    icon: 'emergency_home',
    tone: 'tertiary',
    unread: true,
  },
  {
    id: 'n4',
    titleKey: 'n4Title',
    descKey: 'n4Desc',
    timeKey: 'n4Time',
    icon: 'description',
    tone: 'success',
    unread: false,
  },
  {
    id: 'n5',
    titleKey: 'n5Title',
    descKey: 'n5Desc',
    timeKey: 'n5Time',
    icon: 'videocam',
    tone: 'primary',
    unread: false,
  },
];

const NGO_NOTIFICATIONS = [
  {
    id: 'ngo1',
    titleKey: 'ngoN1Title',
    descKey: 'ngoN1Desc',
    timeKey: 'ngoN1Time',
    icon: 'vaccines',
    tone: 'primary',
    unread: true,
  },
  {
    id: 'ngo2',
    titleKey: 'ngoN2Title',
    descKey: 'ngoN2Desc',
    timeKey: 'ngoN2Time',
    icon: 'payments',
    tone: 'success',
    unread: true,
  },
  {
    id: 'ngo3',
    titleKey: 'ngoN3Title',
    descKey: 'ngoN3Desc',
    timeKey: 'ngoN3Time',
    icon: 'volunteer_activism',
    tone: 'secondary',
    unread: true,
  },
  {
    id: 'ngo4',
    titleKey: 'ngoN4Title',
    descKey: 'ngoN4Desc',
    timeKey: 'ngoN4Time',
    icon: 'campaign',
    tone: 'tertiary',
    unread: false,
  },
];

const GOVERNMENT_NOTIFICATIONS = [
  {
    id: 'govt1',
    titleKey: 'govtN1Title',
    descKey: 'govtN1Desc',
    timeKey: 'govtN1Time',
    icon: 'trending_up',
    tone: 'success',
    unread: true,
  },
  {
    id: 'govt2',
    titleKey: 'govtN2Title',
    descKey: 'govtN2Desc',
    timeKey: 'govtN2Time',
    icon: 'help',
    tone: 'tertiary',
    unread: true,
  },
  {
    id: 'govt3',
    titleKey: 'govtN3Title',
    descKey: 'govtN3Desc',
    timeKey: 'govtN3Time',
    icon: 'description',
    tone: 'primary',
    unread: true,
  },
  {
    id: 'govt4',
    titleKey: 'govtN4Title',
    descKey: 'govtN4Desc',
    timeKey: 'govtN4Time',
    icon: 'campaign',
    tone: 'secondary',
    unread: false,
  },
];

const NOTIFICATIONS_BY_ROLE = {
  ngo: NGO_NOTIFICATIONS,
  government: GOVERNMENT_NOTIFICATIONS,
};

const TONE_STYLES = {
  primary: 'bg-primary-fixed-dim/40 text-primary',
  secondary: 'bg-secondary-container/60 text-on-secondary-container',
  tertiary: 'bg-tertiary-container/40 text-tertiary',
  success: 'bg-success-container text-on-success-container',
};

const loadNotifications = (key, fallback) => {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
  } catch {
    /* ignore storage errors */
  }
  return fallback;
};

export default function NotificationBell() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const role = user?.role;
  const storageKey = `jd_notifications_${role ?? 'default'}`;
  const fallback = NOTIFICATIONS_BY_ROLE[role] ?? DOCTOR_NOTIFICATIONS;
  const [notifications, setNotifications] = useState(() => loadNotifications(storageKey, fallback));
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false), open);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const translatedNotifications = notifications.map((n) => ({
    ...n,
    title: n.titleKey ? t(`notifications.${n.titleKey}`) : n.title,
    description: n.descKey ? t(`notifications.${n.descKey}`) : n.description,
    time: n.timeKey ? t(`notifications.${n.timeKey}`) : n.time,
  }));

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(notifications));
    } catch {
      /* ignore storage errors */
    }
  }, [notifications, storageKey]);

  const markAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 text-on-surface-variant hover:text-primary rounded-full transition-colors"
        aria-label={t('notifications.title')}
        aria-expanded={open}
      >
        <span className="material-symbols-outlined">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-error text-on-error rounded-full flex items-center justify-center text-label-sm font-bold border-2 border-surface">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-3 w-80 max-w-[calc(100vw-2rem)] bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-elevation3 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant bg-surface-container-low">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">notifications</span>
              <p className="font-bold text-on-surface text-sm">{t('notifications.title')}</p>
              {unreadCount > 0 && (
                <span className="bg-primary text-on-primary text-label-sm font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-label-md text-primary hover:underline"
              >
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {translatedNotifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => markAsRead(n.id)}
                className={cx(
                  'w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-surface-container-low',
                  !n.unread && 'opacity-75'
                )}
              >
                <span
                  className={cx(
                    'mt-0.5 w-9 h-9 rounded-full flex items-center justify-center material-symbols-outlined text-lg shrink-0',
                    TONE_STYLES[n.tone] ?? 'bg-surface-container-high text-on-surface-variant'
                  )}
                >
                  {n.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cx('block text-body-sm', n.unread ? 'font-bold text-on-surface' : 'text-on-surface')}>
                    {n.title}
                  </span>
                  <span className="block text-label-md text-on-surface-variant truncate">{n.description}</span>
                  <span className="block text-label-sm text-on-surface-variant/80 mt-0.5">{n.time}</span>
                </span>
                {n.unread && <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-primary shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
