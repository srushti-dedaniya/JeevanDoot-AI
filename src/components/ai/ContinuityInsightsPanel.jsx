import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Badge from '../common/Badge';
import Button from '../common/Button';

const CATEGORY_ICONS = {
  upcoming_appointment: 'event',
  followup_due: 'schedule',
  referral_pending: 'send',
  care_plan_task_overdue: 'warning',
  missing_documentation: 'description',
};

const CATEGORY_LABELS = {
  upcoming_appointment: 'Upcoming Appointment',
  followup_due: 'Follow-up Due',
  referral_pending: 'Referral Pending',
  care_plan_task_overdue: 'Care Plan Task Overdue',
  missing_documentation: 'Missing Documentation',
};

const PRIORITY_COLORS = {
  high: 'error',
  medium: 'warning',
  low: 'info',
};

const PRIORITY_LABELS = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

function getCategoryIcon(category) {
  return CATEGORY_ICONS[category] || 'description';
}

function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] || category;
}

function getPriorityColor(priority) {
  return PRIORITY_COLORS[priority] || 'neutral';
}

function getPriorityLabel(priority) {
  return PRIORITY_LABELS[priority] || priority;
}

function formatDate(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function InsightItem({ insight, t, onCreateReminder }) {
  const evidence = insight.evidence || {};
  const doctorName = evidence.doctor;
  const specialization = evidence.specialization;

  const canCreateReminder = ['upcoming_appointment', 'followup_due', 'referral_pending', 'missing_documentation'].includes(insight.category);

  return (
    <div
      key={insight.ruleId || insight._id}
      className="relative pl-10 pb-6 border-l border-outline-variant/30 last:border-0 last:pb-0"
    >
      <div className="flex items-start gap-3">
        <div
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-body-sm font-semibold transition-all duration-200"
          style={{
            backgroundColor:
              insight.priority === 'high'
                ? 'var(--color-error-container)'
                : insight.priority === 'medium'
                ? 'var(--color-warning-container)'
                : insight.priority === 'low'
                ? 'var(--color-info-container)'
                : 'var(--color-surface-container-highest)',
            color:
              insight.priority === 'high'
                ? 'var(--color-on-error-container)'
                : insight.priority === 'medium'
                ? 'var(--color-on-warning-container)'
                : insight.priority === 'low'
                ? 'var(--color-on-info-container)'
                : 'var(--color-on-surface-variant)',
          }}
        >
          <span className="material-symbols-outlined text-[18px]">{getCategoryIcon(insight.category)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={getPriorityColor(insight.priority)} icon={getCategoryIcon(insight.category)} size="sm">
              {getCategoryLabel(insight.category)}
            </Badge>
            {insight.priority && (
              <Badge variant={getPriorityColor(insight.priority)} size="xs">
                {getPriorityLabel(insight.priority)}
              </Badge>
            )}
            {doctorName && (
              <span className="text-label-sm text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">person</span>
                {doctorName}
                {specialization && ` \u00B7 ${specialization}`}
              </span>
            )}
          </div>
          <p className="font-semibold text-on-surface text-body-md truncate">{insight.title}</p>
          {insight.explanation && (
            <p className="text-body-sm text-on-surface-variant mt-1 line-clamp-2">{insight.explanation}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-label-sm text-on-surface-variant">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">calendar_today</span>
              {formatDate(evidence.appointmentDate || evidence.consultationDate || evidence.createdAt || evidence.issuedAt)}
            </span>
            {evidence.appointmentTime && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">schedule</span>
                {evidence.appointmentTime}
              </span>
            )}
          </div>
          {insight.recommendedAction && (
            <div className="mt-3">
              <p className="text-label-sm font-medium text-on-surface-variant">{t('patient.continuity.recommendedAction')}</p>
              <p className="text-body-sm text-on-surface-variant mt-1">{insight.recommendedAction}</p>
            </div>
          )}
          {doctorName && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" size="xs" icon="person">
                {t('patient.continuity.viewDoctor')}
              </Badge>
            </div>
          )}
          {canCreateReminder && onCreateReminder && (
            <div className="flex items-center gap-2 mt-2">
              <Button variant="outlined" size="xs" icon="notifications" onClick={() => onCreateReminder(insight)}>
                {t('reminders.actions.create') || 'Create Reminder'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ContinuityInsightsPanel({ insights = [], loading = false, error = null, onCreateReminder }) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <Card
        title={t('patient.continuity.title')}
        subtitle={t('patient.continuity.subtitle')}
        icon="analytics"
      >
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
      <Card
        title={t('patient.continuity.title')}
        subtitle={t('patient.continuity.subtitle')}
        icon="analytics"
      >
        <div className="rounded-xl bg-error-container text-on-error-container px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-xl">error</span>
            <div>
              <p className="font-bold text-body-md">{t('common.error')}</p>
              <p className="text-body-sm">{error}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon="refresh"
            className="mt-3 border-on-error-container text-on-error-container"
            onClick={() => window.location.reload()}
          >
            {t('patient.continuity.retry')}
          </Button>
        </div>
      </Card>
    );
  }

  if (!insights || insights.length === 0) {
    return (
      <Card
        title={t('patient.continuity.title')}
        subtitle={t('patient.continuity.subtitle')}
        icon="analytics"
      >
        <div className="text-center py-8">
          <span className="material-symbols-outlined text-6xl text-on-surface-variant/50">analytics</span>
          <p className="mt-4 text-body-lg text-on-surface-variant">
            {t('patient.continuity.emptyTitle')}
          </p>
          <p className="text-body-sm text-on-surface-variant">
            {t('patient.continuity.emptyDescription')}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={t('patient.continuity.title')}
      subtitle={t('patient.continuity.subtitle')}
      icon="analytics"
      headerRight={
        <span className="text-label-md text-on-surface-variant">
          {insights.length} insights
        </span>
      }
    >
      <div className="space-y-4">
        {insights.map((insight) => (
          <InsightItem key={insight.ruleId || insight._id} insight={insight} t={t} onCreateReminder={onCreateReminder} />
        ))}
      </div>
    </Card>
  );
}