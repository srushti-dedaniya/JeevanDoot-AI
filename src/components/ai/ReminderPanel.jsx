import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Badge from '../common/Badge';
import Button from '../common/Button';

const STATUS_LABELS = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  sending: 'Sending',
  sent: 'Sent',
  failed: 'Failed',
  delivery_unknown: 'Delivery Unknown',
  cancelled: 'Cancelled',
};

const STATUS_COLORS = {
  draft: 'neutral',
  pending_approval: 'warning',
  approved: 'success',
  sending: 'info',
  sent: 'success',
  failed: 'error',
  delivery_unknown: 'warning',
  cancelled: 'neutral',
};

const TYPE_LABELS = {
  appointment_upcoming: 'Appointment Upcoming',
  appointment_today: 'Appointment Today',
  followup_overdue: 'Follow-up Overdue',
  followup_due: 'Follow-up Due',
  referral_pending: 'Referral Pending',
  prescription_renewal: 'Prescription Renewal',
  custom: 'Custom',
};

const TYPE_ICONS = {
  appointment_upcoming: 'event',
  appointment_today: 'event',
  followup_overdue: 'schedule',
  followup_due: 'schedule',
  referral_pending: 'send',
  prescription_renewal: 'medication',
  custom: 'notifications',
};

const CHANNEL_LABELS = {
  in_app: 'In-App',
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
};

const PRIORITY_LABELS = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const PRIORITY_COLORS = {
  high: 'error',
  medium: 'warning',
  low: 'info',
};

function formatDate(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function ReminderItem({ reminder, t, onView, onAction }) {
  const statusColor = STATUS_COLORS[reminder.status] || 'neutral';
  const typeLabel = TYPE_LABELS[reminder.type] || reminder.type;
  const typeIcon = TYPE_ICONS[reminder.type] || 'notifications';
  const channelLabel = CHANNEL_LABELS[reminder.channel] || reminder.channel;
  const priorityLabel = PRIORITY_LABELS[reminder.priority] || reminder.priority;
  const priorityColor = PRIORITY_COLORS[reminder.priority] || 'neutral';

  const actions = [];
  if (reminder.status === 'draft') {
    actions.push({ label: t('reminders.actions.submit'), action: 'submit', variant: 'outlined', icon: 'send' });
    actions.push({ label: t('reminders.actions.cancel'), action: 'cancel', variant: 'outlined', icon: 'cancel', color: 'error' });
  } else if (reminder.status === 'pending_approval') {
    actions.push({ label: t('reminders.actions.approve'), action: 'approve', variant: 'filled', icon: 'check' });
    actions.push({ label: t('reminders.actions.cancel'), action: 'cancel', variant: 'outlined', icon: 'cancel', color: 'error' });
  } else if (reminder.status === 'approved') {
    actions.push({ label: t('reminders.actions.send'), action: 'send', variant: 'filled', icon: 'send' });
    actions.push({ label: t('reminders.actions.cancel'), action: 'cancel', variant: 'outlined', icon: 'cancel', color: 'error' });
  } else if (reminder.status === 'failed' || reminder.status === 'delivery_unknown') {
    actions.push({ label: t('reminders.actions.retry'), action: 'retry', variant: 'outlined', icon: 'refresh' });
    actions.push({ label: t('reminders.actions.cancel'), action: 'cancel', variant: 'outlined', icon: 'cancel', color: 'error' });
  } else if (reminder.status === 'sent') {
    // No actions for sent
  }

  return (
    <div key={reminder.id} className="relative pl-10 pb-6 border-l border-outline-variant/30 last:border-0 last:pb-0">
      <div className="flex items-start gap-3">
        <div
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-body-sm font-semibold"
          style={{
            backgroundColor: `var(--color-${statusColor}-container)`,
            color: `var(--color-on-${statusColor}-container)`,
          }}
        >
          <span className="material-symbols-outlined text-[18px]">{typeIcon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant={statusColor} icon={typeIcon} size="sm">
              {t(`reminders.status${STATUS_LABELS[reminder.status].replace(/\s/g, '')}`)}
            </Badge>
            <Badge variant={priorityColor} size="xs">
              {t(`reminders.priority${priorityLabel}`)}
            </Badge>
            <Badge variant="neutral" size="xs" icon="markunread_mailbox">
              {t(`reminders.channel${channelLabel.replace(/\s/g, '')}`)}
            </Badge>
          </div>
          <p className="font-semibold text-on-surface text-body-md truncate">{reminder.message?.subject || typeLabel}</p>
          {reminder.sourceEvent?.description && (
            <p className="text-body-sm text-on-surface-variant mt-1 line-clamp-2">{reminder.sourceEvent.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-label-sm text-on-surface-variant">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">calendar_today</span>
              {formatDate(reminder.scheduledFor)}
            </span>
            {reminder.recipient?.name && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">person</span>
                {reminder.recipient.name}
              </span>
            )}
          </div>
          {actions.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              {actions.map((a) => (
                <Button
                  key={a.action}
                  variant={a.variant}
                  size="sm"
                  icon={a.icon}
                  color={a.color}
                  onClick={() => onAction?.(a.action, reminder)}
                  disabled={a.loading}
                >
                  {t(a.label)}
                </Button>
              ))}
            </div>
          )}
          {onView && (
            <div className="flex items-center gap-2 mt-2">
              <Button variant="outline" size="xs" icon="visibility" onClick={() => onView(reminder)}>
                {t('reminders.actions.view')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReminderPanel({ reminders = [], loading = false, error = null, onView, onAction }) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <Card title={t('reminders.title')} subtitle={t('reminders.subtitle')} icon="notifications">
        <div className="flex items-center justify-center h-48">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className="h-6 w-6 animate-spin border-2 border-primary border-t-transparent rounded-full" />
            <span className="text-body-md">{t('common.loading')}</span>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title={t('reminders.title')} subtitle={t('reminders.subtitle')} icon="notifications">
        <div className="rounded-xl bg-error-container text-on-error-container px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-xl">error</span>
            <div>
              <p className="font-bold text-body-md">{t('common.error')}</p>
              <p className="text-body-sm">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" icon="refresh" className="mt-3 border-on-error-container text-on-error-container" onClick={() => window.location.reload()}>
            {t('common.retry')}
          </Button>
        </div>
      </Card>
    );
  }

  if (!reminders || reminders.length === 0) {
    return (
      <Card title={t('reminders.title')} subtitle={t('reminders.subtitle')} icon="notifications">
        <div className="text-center py-8">
          <span className="material-symbols-outlined text-6xl text-on-surface-variant/50">notifications</span>
          <p className="mt-4 text-body-lg text-on-surface-variant">{t('reminders.emptyTitle')}</p>
          <p className="text-body-sm text-on-surface-variant">{t('reminders.emptyDescription')}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={t('reminders.title')}
      subtitle={t('reminders.subtitle')}
      icon="notifications"
      headerRight={
        <span className="text-label-md text-on-surface-variant">
          {reminders.length} {reminders.length === 1 ? 'reminder' : 'reminders'}
        </span>
      }
    >
      <div className="space-y-4">
        {reminders.map((reminder) => (
          <ReminderItem key={reminder.id} reminder={reminder} t={t} onView={onView} onAction={onAction} />
        ))}
      </div>
    </Card>
  );
}