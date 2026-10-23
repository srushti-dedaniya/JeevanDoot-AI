import { useEffect, useState, useContext, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PatientSidebar from '../../components/layout/PatientSidebar';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';
import PatientContext from '../../context/PatientContext';
import ContinuityInsightsPanel from '../../components/ai/ContinuityInsightsPanel';
import ReminderPanel from '../../components/ai/ReminderPanel';
import ReminderForm from '../../components/ai/ReminderForm';
import EscalationPanel from '../../components/ai/EscalationPanel';

const TYPE_ICONS = {
  appointment: 'event',
  referral: 'share',
  prescription: 'medication',
  consultation: 'medical_services',
  medical_report: 'description',
};

const TYPE_LABELS = {
  appointment: 'patient.timeline.appointment',
  referral: 'patient.timeline.referral',
  prescription: 'patient.timeline.prescription',
  consultation: 'patient.timeline.consultation',
  medical_report: 'patient.timeline.medicalReport',
};

const TYPE_COLORS = {
  appointment: 'primary',
  referral: 'secondary',
  prescription: 'tertiary',
  consultation: 'info',
  medical_report: 'success',
};

export default function CareTimeline() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const role = user?.role || 'patient';

  const [timeline, setTimeline] = useState({ events: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  const [continuity, setContinuity] = useState({ insights: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  const [reminders, setReminders] = useState({ items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  const [loading, setLoading] = useState(false);
  const [continuityLoading, setContinuityLoading] = useState(false);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [escalationsLoading, setEscalationsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters] = useState({ from: '', to: '' });
  const [patientId, setPatientId] = useState(null);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderFormData, setReminderFormData] = useState(null);
  const [reminderFormLoading, setReminderFormLoading] = useState(false);
  const [escalations, setEscalations] = useState({ items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  const escalationPanelRef = useRef(null);
  const { patient } = useContext(PatientContext);

  useEffect(() => {
    if (role === 'patient') {
      setPatientId(patient?._id);
    }
  }, [role, patient]);

  const fetchTimeline = useCallback(async (pageNum = 1) => {
    if (!patientId) return;

    setLoading(true);
    setError(null);

    try {
      const params = {
        page: pageNum,
        limit: 20,
        ...(filters.from && { from: filters.from }),
        ...(filters.to && { to: filters.to }),
      };

      const { data, meta } = await api.get(`/patients/${patientId}/timeline`, params);
      setTimeline({ events: data || [], meta });
    } catch (err) {
      setError(err.message || 'Failed to load timeline');
      setTimeline({ events: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    } finally {
      setLoading(false);
    }
  }, [patientId, filters.from, filters.to]);

  const fetchContinuity = useCallback(async (pageNum = 1) => {
    if (!patientId) return;

    setContinuityLoading(true);
    setError(null);

    try {
      const params = {
        page: pageNum,
        limit: 20,
      };

      const response = await api.get(`/patients/${patientId}/continuity`, params);
      const insights = response.data?.insights || [];
      const meta = response.data?.meta || { page: 1, limit: 20, total: 0, totalPages: 0 };
      setContinuity({ insights, meta });
    } catch (err) {
      setError(err.message || 'Failed to load continuity insights');
      setContinuity({ insights: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    } finally {
      setContinuityLoading(false);
    }
  }, [patientId]);

  const fetchReminders = useCallback(async (pageNum = 1) => {
    if (!patientId) return;

    setRemindersLoading(true);
    setError(null);

    try {
      const params = {
        page: pageNum,
        limit: 20,
        patientId,
      };

      const response = await api.get('/reminders', params);
      const items = response.data || [];
      const meta = response.meta || { page: 1, limit: 20, total: 0, totalPages: 0 };
      setReminders({ items, meta });
    } catch (err) {
      setError(err.message || 'Failed to load reminders');
      setReminders({ items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    } finally {
      setRemindersLoading(false);
    }
  }, [patientId]);

  const fetchEscalations = useCallback(async (pageNum = 1) => {
    if (!patientId) return;

    setEscalationsLoading(true);
    setError(null);

    try {
      const params = {
        page: pageNum,
        limit: 20,
        patientId,
      };

      const response = await api.get('/escalations', params);
      const items = response.data || [];
      const meta = response.meta || { page: 1, limit: 20, total: 0, totalPages: 0 };
      setEscalations({ items, meta });
    } catch (err) {
      setError(err.message || 'Failed to load escalations');
      setEscalations({ items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    } finally {
      setEscalationsLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchTimeline(1);
    fetchContinuity(1);
    fetchReminders(1);
    fetchEscalations(1);
  }, [patientId, filters.from, filters.to, fetchTimeline, fetchContinuity, fetchReminders, fetchEscalations]);

  const handleCreateReminder = (insight) => {
    const evidence = insight.evidence || {};
    let type = null;
    let sourceEvent = null;

    if (insight.category === 'upcoming_appointment') {
      type = insight.ruleId === 'upcoming_appointment_today' ? 'appointment_today' : 'appointment_upcoming';
      sourceEvent = {
        type: 'Appointment',
        id: evidence.appointmentId,
        title: insight.title,
        description: `${evidence.doctor || 'your doctor'} - ${evidence.appointmentTime || ''}`,
        eventDate: evidence.appointmentDate ? new Date(evidence.appointmentDate) : null,
      };
    } else if (insight.category === 'followup_due') {
      type = 'followup_overdue';
      sourceEvent = {
        type: 'Consultation',
        id: evidence.consultationId,
        title: insight.title,
        description: evidence.doctor || '',
        eventDate: evidence.consultationDate ? new Date(evidence.consultationDate) : null,
      };
    } else if (insight.category === 'referral_pending') {
      type = 'referral_pending';
      sourceEvent = {
        type: 'Referral',
        id: evidence.referralObjectId || evidence.referralId,
        title: insight.title,
        description: evidence.destination || '',
        eventDate: evidence.createdAt ? new Date(evidence.createdAt) : null,
      };
    } else if (insight.category === 'missing_documentation' && insight.ruleId === 'prescription_not_dispensed') {
      type = 'prescription_renewal';
      sourceEvent = {
        type: 'Prescription',
        id: evidence.prescriptionId,
        title: insight.title,
        description: evidence.medicines || '',
        eventDate: evidence.issuedAt ? new Date(evidence.issuedAt) : null,
      };
    }

    if (type && sourceEvent) {
      setReminderFormData({
        patientId,
        type,
        sourceEvent,
        channel: 'in_app',
        priority: insight.priority || 'medium',
      });
      setShowReminderForm(true);
    }
  };

  const handleReminderFormSubmit = async (formData) => {
    setReminderFormLoading(true);
    try {
      const response = await api.post('/reminders', formData);
      if (response.data) {
        fetchReminders(1);
        setShowReminderForm(false);
        setReminderFormData(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to create reminder');
    } finally {
      setReminderFormLoading(false);
    }
  };

  const handleReminderFormCancel = () => {
    setShowReminderForm(false);
    setReminderFormData(null);
  };

  const handleEscalationAction = async (action, escalation) => {
    try {
      if (action === 'acknowledge') {
        await api.post(`/escalations/${escalation.id}/acknowledge`);
        fetchEscalations(1);
      } else if (action === 'progress') {
        await api.post(`/escalations/${escalation.id}/progress`);
        fetchEscalations(1);
      } else if (action === 'resolve') {
        // Open a modal/dialog for resolution reason
        const reason = window.prompt('Enter resolution reason:');
        if (reason) {
          await api.post(`/escalations/${escalation.id}/resolve`, { resolution: reason });
          fetchEscalations(1);
        }
      } else if (action === 'dismiss') {
        // Open a modal/dialog for dismissal reason
        const reason = window.prompt('Enter dismissal reason:');
        if (reason) {
          await api.post(`/escalations/${escalation.id}/dismiss`, { dismissalReason: reason });
          fetchEscalations(1);
        }
      } else if (action === 'view') {
        // Use the EscalationPanel ref to fetch and display details
        escalationPanelRef.current?.fetchEscalationDetails?.(escalation.id);
      }
    } catch (err) {
      setError(err.message || 'Failed to perform action');
    }
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchTimeline(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= timeline.meta.totalPages) {
      fetchTimeline(newPage);
    }
  };

  const handlePatientSelect = (selectedPatientId) => {
    setPatientId(selectedPatientId);
  };

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const getTypeColor = (type) => TYPE_COLORS[type] || 'neutral';

  if (!patientId && role === 'patient') {
    return (
      <DashboardLayout
        sidebar={<PatientSidebar />}
        headerProps={{ title: t('patient.timeline.title'), subtitle: t('patient.timeline.subtitle') }}
      >
        <Card>
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-6xl text-on-surface-variant/50">timeline</span>
            <p className="mt-4 text-body-lg text-on-surface-variant">{t('patient.timeline.selectPatient')}</p>
          </div>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      sidebar={role === 'patient' ? <PatientSidebar /> : null}
      headerProps={{
        title: t('patient.timeline.title'),
        subtitle: t('patient.timeline.subtitle'),
        right: role === 'doctor' && (
          <select
            value={patientId || ''}
            onChange={(e) => handlePatientSelect(e.target.value)}
            className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 text-label-md focus:outline-none"
            aria-label={t('patient.timeline.selectPatient')}
          >
            <option value="">{t('patient.timeline.selectPatient')}</option>
          </select>
        )}
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Care Timeline */}
        <Card
          className="lg:col-span-2"
          title={t('patient.timeline.title')}
          subtitle={t('patient.timeline.subtitle')}
          icon="timeline"
          headerRight={
            <Badge variant="neutral" icon="info">
              {timeline.events.length === 0 ? 'No events' : `${timeline.events.length} event${timeline.events.length > 1 ? 's' : ''}`}
            </Badge>
          }
        >
          {timeline.events.length === 0 && !loading && (
            <div className="space-y-5">
              <div className="flex items-start gap-3 rounded-xl bg-surface-container px-4 py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                  <span className="material-symbols-outlined">timeline</span>
                </span>
                <div>
                  <p className="font-bold text-on-surface text-body-md">
                    {t('patient.timeline.welcomeTitle')}
                  </p>
                  <p className="text-body-sm text-on-surface-variant">
                    {t('patient.timeline.welcomeDescription')}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-label-lg font-bold text-on-surface-variant uppercase tracking-wide mb-2">
                  Suggested filters
                </p>
                <div className="flex flex-wrap gap-2">
                  {['Show my timeline', 'Show my appointments', 'Show my prescriptions', 'Show my referrals'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleFilterSubmit({ preventDefault: () => {} })}
                      className="rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 text-body-sm font-semibold text-primary hover:bg-primary-fixed-dim/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <EmptyState
                icon="timeline"
                title={t('patient.timeline.emptyTitle')}
                description={t('patient.timeline.emptyDescription')}
              />
            </div>
          )}

          {timeline.events.length > 0 && (
            <div
              className="space-y-4 max-h-[55vh] overflow-y-auto pr-1 custom-scrollbar"
              role="log"
              aria-live="polite"
              aria-label="Care timeline"
            >
              {timeline.events.map((event) => (
                <div key={event.id} className="relative pl-10 pb-6 border-l border-outline-variant/30 last:border-0 last:pb-0">
                  <div className="absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center text-body-sm shrink-0" style={{
                    backgroundColor: `var(--color-${getTypeColor(event.type)}-container)`,
                    color: `var(--color-on-${getTypeColor(event.type)}-container)`
                  }}>
                    <span className="material-symbols-outlined">{TYPE_ICONS[event.type] || 'circle'}</span>
                  </div>
                  <div className="bg-surface-container-low rounded-xl p-4 hover:bg-surface-container transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant={TYPE_COLORS[event.type] || 'neutral'} icon={TYPE_ICONS[event.type] || 'circle'} size="sm">
                            {t(TYPE_LABELS[event.type] || event.type)}
                          </Badge>
                          {event.status && (
                            <Badge variant="neutral" size="xs">
                              {event.status}
                            </Badge>
                          )}
                          {event.metadata?.doctor && (
                            <span className="text-label-sm text-on-surface-variant flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">person</span>
                              {event.metadata.doctor.name}
                              {event.metadata.doctor.specialization && ` \u00B7 ${event.metadata.doctor.specialization}`}
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-on-surface text-body-md truncate">{event.title}</p>
                        {event.description && (
                          <p className="text-body-sm text-on-surface-variant mt-1 line-clamp-2">{event.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-label-sm text-on-surface-variant">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                            {formatDate(event.occurredAt)}
                          </span>
                          {formatTime(event.occurredAt) && (
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">schedule</span>
                              {formatTime(event.occurredAt)}
                            </span>
                          )}
                        </div>
                      </div>
                      {event.metadata?.doctor && (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" size="xs" icon="person">
                            {t('patient.timeline.viewDoctor')}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center h-32">
              <div className="flex items-center gap-2 text-on-surface-variant">
                <span className="h-6 w-6 animate-spin border-2 border-primary border-t-transparent rounded-full" />
                <span className="text-body-md">{t('common.loading')}</span>
              </div>
            </div>
          )}

          {error && !timeline.events.length && (
            <div className="rounded-xl bg-error-container text-on-error-container px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-xl">error</span>
                <div>
                  <p className="font-bold text-body-md">{t('common.error')}</p>
                  <p className="text-body-sm">{error}</p>
                </div>
              </div>
            </div>
          )}

          {(timeline.meta.totalPages > 1) && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-label-md text-on-surface-variant">
                {t('pagination.showing', { start: (timeline.meta.page - 1) * timeline.meta.limit + 1, end: Math.min(timeline.meta.page * timeline.meta.limit, timeline.meta.total), total: timeline.meta.total })}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon="chevron_left"
                  onClick={() => handlePageChange(timeline.meta.page - 1)}
                  disabled={timeline.meta.page <= 1}
                >
                  {t('pagination.previousPage')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon="chevron_right"
                  onClick={() => handlePageChange(timeline.meta.page + 1)}
                  disabled={timeline.meta.page >= timeline.meta.totalPages}
                >
                  {t('pagination.nextPage')}
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Continuity Insights Panel */}
        <ContinuityInsightsPanel
          insights={continuity.insights}
          loading={continuityLoading}
          error={error}
          onCreateReminder={handleCreateReminder}
        />

        {/* Reminders Panel */}
        <ReminderPanel
          reminders={reminders.items}
          loading={remindersLoading}
          error={error}
        />

        {/* Escalations Panel */}
        <EscalationPanel
          ref={escalationPanelRef}
          escalations={escalations.items}
          loading={escalationsLoading}
          error={error}
          onAction={handleEscalationAction}
        />
      </div>

      {showReminderForm && reminderFormData && (
        <ReminderForm
          initialData={reminderFormData}
          onSubmit={handleReminderFormSubmit}
          onCancel={handleReminderFormCancel}
          title={t('reminders.createTitle')}
          loading={reminderFormLoading}
        />
      )}
    </DashboardLayout>
  );
}