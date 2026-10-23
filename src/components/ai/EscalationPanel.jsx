import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Badge from '../common/Badge';
import Button from '../common/Button';
import Textarea from '../common/Textarea';
import Modal from '../common/Modal';
import { api } from '../../services/api';

const STATUS_LABELS = {
  pending_review: 'Pending Review',
  acknowledged: 'Acknowledged',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

const STATUS_COLORS = {
  pending_review: 'warning',
  acknowledged: 'info',
  in_progress: 'primary',
  resolved: 'success',
  dismissed: 'neutral',
};

const TYPE_LABELS = {
  followup_overdue: 'Follow-up Overdue',
  referral_pending_long: 'Referral Pending Long',
  care_plan_task_overdue: 'Care Plan Task Overdue',
  missing_documentation: 'Missing Documentation',
  continuity_task_unresolved: 'Continuity Task Unresolved',
  appointment_upcoming: 'Appointment Upcoming',
  appointment_today: 'Appointment Today',
};

const TYPE_ICONS = {
  followup_overdue: 'schedule',
  referral_pending_long: 'send',
  care_plan_task_overdue: 'warning',
  missing_documentation: 'description',
  continuity_task_unresolved: 'analytics',
  appointment_upcoming: 'event',
  appointment_today: 'event',
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

function formatDateTime(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function EscalationItem({ escalation, t, onView, onAction }) {
  const statusColor = STATUS_COLORS[escalation.status] || 'neutral';
  const typeLabel = TYPE_LABELS[escalation.type] || escalation.type;
  const typeIcon = TYPE_ICONS[escalation.type] || 'analytics';
  const priorityLabel = PRIORITY_LABELS[escalation.priority] || escalation.priority;
  const priorityColor = PRIORITY_COLORS[escalation.priority] || 'neutral';

  const actions = [];
  if (escalation.status === 'pending_review') {
    actions.push({ label: t('escalations.actions.acknowledge'), action: 'acknowledge', variant: 'filled', icon: 'check' });
    actions.push({ label: t('escalations.actions.dismiss'), action: 'dismiss', variant: 'outlined', icon: 'cancel', color: 'error' });
  } else if (escalation.status === 'acknowledged') {
    actions.push({ label: t('escalations.actions.progress'), action: 'progress', variant: 'filled', icon: 'play_arrow' });
    actions.push({ label: t('escalations.actions.dismiss'), action: 'dismiss', variant: 'outlined', icon: 'cancel', color: 'error' });
  } else if (escalation.status === 'in_progress') {
    actions.push({ label: t('escalations.actions.resolve'), action: 'resolve', variant: 'filled', icon: 'check' });
    actions.push({ label: t('escalations.actions.dismiss'), action: 'dismiss', variant: 'outlined', icon: 'cancel', color: 'error' });
  } else if (escalation.status === 'resolved' || escalation.status === 'dismissed') {
    // No actions for resolved/dismissed
  }

  return (
    <div key={escalation.id} className="relative pl-10 pb-6 border-l border-outline-variant/30 last:border-0 last:pb-0">
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
              {t(`escalations.status${STATUS_LABELS[escalation.status].replace(/\s/g, '')}`)}
            </Badge>
            <Badge variant={priorityColor} size="xs">
              {t(`escalations.priority${priorityLabel}`)}
            </Badge>
          </div>
          <p className="font-semibold text-on-surface text-body-md truncate">{escalation.reason || typeLabel}</p>
          {escalation.sourceEvent?.description && (
            <p className="text-body-sm text-on-surface-variant mt-1 line-clamp-2">{escalation.sourceEvent.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-label-sm text-on-surface-variant">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">calendar_today</span>
              {formatDate(escalation.sourceEvent?.eventDate)}
            </span>
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
                  onClick={() => onAction?.(a.action, escalation)}
                >
                  {t(a.label)}
                </Button>
              ))}
            </div>
          )}
          {onView && (
            <div className="flex items-center gap-2 mt-2">
              <Button variant="outline" size="xs" icon="visibility" onClick={() => onView(escalation)}>
                {t('escalations.actions.view')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResolveDismissModal({ isOpen, onClose, title, action, _escalation, t, onSubmit, loading }) {
  const [reason, setReason] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setReason('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={title}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Textarea
          label={t('escalations.reason') + ' ' + (action === 'resolve' ? '(' + t('escalations.resolution') + ')' : '(' + t('escalations.dismissalReason') + ')')}
          placeholder={t('escalations.' + (action === 'resolve' ? 'resolutionPlaceholder' : 'dismissalReasonPlaceholder')) || 'Enter reason...'}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          required
          autoFocus
        />
        <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant">
          <Button variant="outlined" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={loading} variant="filled" color={action === 'dismiss' ? 'error' : 'primary'}>
            {t('escalations.actions.' + action)}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EscalationViewModal({ isOpen, onClose, escalation, t, loading, error }) {
  if (!isOpen) return null;

  const formatDateTime = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Modal
        open={true}
        onClose={onClose}
        title={t('escalations.viewTitle') || 'Escalation Details'}
        size="lg"
      >
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className="h-8 w-8 animate-spin border-2 border-primary border-t-transparent rounded-full" />
            <span className="text-body-md">{t('common.loading')}</span>
          </div>
        </div>
      </Modal>
    );
  }

  if (error) {
    return (
      <Modal
        open={true}
        onClose={onClose}
        title={'Error'}
        size="md"
      >
        <div className="rounded-xl bg-error-container text-on-error-container px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-xl">error</span>
            <div>
              <p className="font-bold text-body-md">{t('common.error')}</p>
              <p className="text-body-sm">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" icon="refresh" className="mt-3 border-on-error-container text-on-error-container" onClick={onClose}>
            {t('common.retry')}
          </Button>
        </div>
      </Modal>
    );
  }

  const e = escalation;

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={t('escalations.viewTitle') || 'Escalation Details'}
      size="lg"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-label-md text-on-surface-variant">{t('escalations.type')}</p>
            <p className="text-body-md font-medium capitalize">{e.type?.replace(/_/g, ' ') || '-'}</p>
          </div>
          <div>
            <p className="text-label-md text-on-surface-variant">{t('escalations.status')}</p>
            <p className="text-body-md font-medium capitalize">{e.status?.replace(/_/g, ' ') || '-'}</p>
          </div>
          <div>
            <p className="text-label-md text-on-surface-variant">{t('escalations.priority')}</p>
            <p className="text-body-md font-medium capitalize">{e.priority || '-'}</p>
          </div>
          <div>
            <p className="text-label-md text-on-surface-variant">{t('escalations.reason')}</p>
            <p className="text-body-md">{e.reason || '-'}</p>
          </div>
          <div>
            <p className="text-label-md text-on-surface-variant">{t('escalations.createdAt')}</p>
            <p className="text-body-md">{formatDateTime(e.createdAt)}</p>
          </div>
          <div>
            <p className="text-label-md text-on-surface-variant">{t('escalations.updatedAt')}</p>
            <p className="text-body-md">{formatDateTime(e.updatedAt)}</p>
          </div>
        </div>

        <div className="border-t border-outline-variant pt-4">
          <p className="text-label-lg font-semibold text-on-surface mb-2">{t('escalations.sourceEvent')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-label-md text-on-surface-variant">{t('escalations.sourceEventType')}</p>
              <p className="text-body-md">{e.sourceEvent?.type || '-'}</p>
            </div>
            <div>
              <p className="text-label-md text-on-surface-variant">{t('escalations.sourceEventTitle')}</p>
              <p className="text-body-md">{e.sourceEvent?.title || '-'}</p>
            </div>
            <div>
              <p className="text-label-md text-on-surface-variant">{t('escalations.sourceEventDescription')}</p>
              <p className="text-body-md">{e.sourceEvent?.description || '-'}</p>
            </div>
            <div>
              <p className="text-label-md text-on-surface-variant">{t('escalations.sourceEventDate')}</p>
              <p className="text-body-md">{formatDateTime(e.sourceEvent?.eventDate)}</p>
            </div>
          </div>
        </div>

        {e.resolution && (
          <div className="border-t border-outline-variant pt-4">
            <p className="text-label-lg font-semibold text-on-surface mb-2">{t('escalations.resolution')}</p>
            <p className="text-body-md">{e.resolution}</p>
            <p className="text-label-sm text-on-surface-variant mt-1">
              {t('escalations.resolvedAt')} {formatDateTime(e.resolvedAt)}
            </p>
          </div>
        )}

        {e.dismissalReason && (
          <div className="border-t border-outline-variant pt-4">
            <p className="text-label-lg font-semibold text-on-surface mb-2">{t('escalations.dismissalReason')}</p>
            <p className="text-body-md">{e.dismissalReason}</p>
            <p className="text-label-sm text-on-surface-variant mt-1">
              {t('escalations.dismissedAt')} {formatDateTime(e.dismissedAt)}
            </p>
          </div>
        )}

        {e.auditTrail && e.auditTrail.length > 0 && (
          <div className="border-t border-outline-variant pt-4">
            <p className="text-label-lg font-semibold text-on-surface mb-2">{t('escalations.auditHistory')}</p>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {e.auditTrail
                .slice()
                .reverse()
                .map((entry, idx) => (
                  <div key={idx} className="bg-surface-container-low rounded-lg p-3 border border-outline-variant">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-on-surface capitalize">{entry.action?.replace(/_/g, ' ') || 'Action'}</span>
                      <span className="text-label-sm text-on-surface-variant">{formatDateTime(entry.performedAt)}</span>
                    </div>
                    <div className="text-label-sm text-on-surface-variant">
                      {entry.performedBy && (
                        <>
                          By: <span className="font-medium">{entry.performedBy.name || entry.performedBy}</span>
                        </>
                      )}
                      {entry.details && Object.keys(entry.details).length > 0 && (
                        <pre className="mt-1 text-xs text-on-surface-variant overflow-x-auto">{JSON.stringify(entry.details, null, 2)}</pre>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant">
          <Button variant="outlined" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const EscalationPanel = forwardRef((props, ref) => {
  const { escalations = [], loading = false, error = null, onView, onAction } = props;
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState(null);
  const [modalEscalation, setModalEscalation] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewEscalation, setViewEscalation] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState(null);

  const fetchEscalationDetails = useCallback(async (escalationId) => {
    setViewLoading(true);
    setViewError(null);
    try {
      const response = await api.get(`/escalations/${escalationId}`);
      setViewEscalation(response.data);
      setViewModalOpen(true);
    } catch (err) {
      setViewError(err.message || 'Failed to load escalation details');
    } finally {
      setViewLoading(false);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    fetchEscalationDetails,
  }));

  const openModal = (action, escalation) => {
    setModalAction(action);
    setModalEscalation(escalation);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalAction(null);
    setModalEscalation(null);
  };

  const closeViewModal = () => {
    setViewModalOpen(false);
    setViewEscalation(null);
    setViewError(null);
  };

  const handleModalSubmit = async (reason) => {
    const trimmed = reason.trim();
    if (!trimmed) return;
    setModalLoading(true);
    try {
      if (modalAction === 'resolve') {
        await onAction?.('resolve', modalEscalation, trimmed);
      } else if (modalAction === 'dismiss') {
        await onAction?.('dismiss', modalEscalation, trimmed);
      }
      closeModal();
    } catch {
      // Error is handled by the parent component
    } finally {
      setModalLoading(false);
    }
  };

  if (loading) {
    return (
      <Card title={t('escalations.title')} subtitle={t('escalations.subtitle')} icon="warning">
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
      <Card title={t('escalations.title')} subtitle={t('escalations.subtitle')} icon="warning">
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

  if (!escalations || escalations.length === 0) {
    return (
      <Card title={t('escalations.title')} subtitle={t('escalations.subtitle')} icon="warning">
        <div className="text-center py-8">
          <span className="material-symbols-outlined text-6xl text-on-surface-variant/50">warning</span>
          <p className="mt-4 text-body-lg text-on-surface-variant">{t('escalations.emptyTitle')}</p>
          <p className="text-body-sm text-on-surface-variant">{t('escalations.emptyDescription')}</p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card
        title={t('escalations.title')}
        subtitle={t('escalations.subtitle')}
        icon="warning"
        headerRight={
          <span className="text-label-md text-on-surface-variant">
            {escalations.length} {escalations.length === 1 ? 'escalation' : 'escalations'}
          </span>
        }
      >
        <div className="space-y-4">
          {escalations.map((escalation) => (
            <EscalationItem key={escalation.id} escalation={escalation} t={t} onView={fetchEscalationDetails} onAction={openModal} />
          ))}
        </div>
      </Card>

      {modalOpen && modalAction && modalEscalation && (
        <ResolveDismissModal
          isOpen={modalOpen}
          onClose={closeModal}
          title={t('escalations.actions.' + modalAction)}
          action={modalAction}
          escalation={modalEscalation}
          t={t}
          onSubmit={handleModalSubmit}
          loading={modalLoading}
        />
      )}

      {viewModalOpen && viewEscalation && (
        <EscalationViewModal
          isOpen={viewModalOpen}
          onClose={closeViewModal}
          escalation={viewEscalation}
          t={t}
          loading={viewLoading}
          error={viewError}
        />
      )}
    </>
  );
});

export default EscalationPanel;