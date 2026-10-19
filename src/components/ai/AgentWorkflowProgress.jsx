import { useMemo } from 'react';
import Badge from '../common/Badge';
import { cx } from '../../utils/helpers';

const STEP_ICONS = {
  pending: 'schedule',
  awaiting_input: 'edit',
  awaiting_confirmation: 'check_circle',
  running: 'sync',
  completed: 'done',
  failed: 'error',
  skipped: 'skip_next',
};

const STEP_LABELS = {
  appointment_coordination: [
    'Identify Need',
    'Select Doctor',
    'Select Date/Time',
    'Check Availability',
    'Prepare Proposal',
    'Await Confirmation',
    'Execute Booking',
  ],
  reschedule_cancel: [
    'Identify Appointment',
    'Verify Ownership',
    'Get New Details',
    'Check Availability',
    'Prepare Proposal',
    'Await Confirmation',
    'Execute Change',
  ],
  referral_coordination: [
    'Gather Details',
    'Verify Authorization',
    'Prepare Proposal',
    'Await Confirmation',
    'Execute Referral',
  ],
  followup_coordination: [
    'Identify Context',
    'Verify API',
    'Prepare Action',
    'Await Confirmation',
    'Execute Follow-up',
  ],
  role_aware_coordination: [
    'Identify Permissions',
    'Gather Task Details',
    'Verify Authorization',
    'Prepare Proposal',
    'Await Confirmation',
    'Execute Task',
  ],
};

export default function AgentWorkflowProgress({ workflowPlan }) {
  const { workflowType, status, totalSteps, steps } = workflowPlan || {};

  const stepLabels = useMemo(
    () => STEP_LABELS[workflowType] || steps?.map(s => s.name) || [],
    [workflowType, steps]
  );

  const completedSteps = steps?.filter(s => s.status === 'completed').length || 0;
  const currentStepIndex = steps?.findIndex(s => ['pending', 'awaiting_input', 'awaiting_confirmation', 'running'].includes(s.status)) || -1;
  const activeStep = currentStepIndex >= 0 ? currentStepIndex : (status === 'completed' ? (totalSteps || 0) - 1 : 0);

  if (!workflowPlan) return null;

  return (
    <div className="mt-3 rounded-xl border border-outline-variant/40 bg-surface-container-low overflow-hidden" role="region" aria-label="Workflow progress">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">timeline</span>
          <p className="font-bold text-on-surface text-body-md">Workflow Progress</p>
        </div>
        <Badge variant={status === 'completed' ? 'success' : status === 'failed' ? 'danger' : status === 'cancelled' ? 'neutral' : 'info'} icon="info">
          {status.replace('_', ' ')}
        </Badge>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* Progress bar */}
        <div className="flex items-center gap-2" role="progressbar" aria-valuenow={completedSteps} aria-valuemin={0} aria-valuemax={totalSteps} aria-label="Workflow progress">
          <div className="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
            />
          </div>
          <span className="text-label-md text-on-surface-variant shrink-0">
            {completedSteps} / {totalSteps}
          </span>
        </div>

        {/* Step list */}
        <ul className="space-y-2" role="list" aria-label="Workflow steps">
          {steps.map((step, index) => {
            const isCompleted = step.status === 'completed';
            const isActive = index === activeStep && !isCompleted && !['completed', 'failed', 'cancelled'].includes(status);
            const isFailed = step.status === 'failed';
            const isSkipped = step.status === 'skipped';

            let stepStatusClass = 'text-on-surface-variant';
            if (isCompleted) stepStatusClass = 'text-success';
            else if (isActive) stepStatusClass = 'text-primary';
            else if (isFailed) stepStatusClass = 'text-error';
            else if (isSkipped) stepStatusClass = 'text-on-surface-variant/60';

            const iconName = STEP_ICONS[step.status] || STEP_ICONS.pending;
            const label = stepLabels[index] || step.name;

            return (
              <li
                key={step.stepIndex}
                className={cx(
                  'flex items-start gap-3 transition-colors duration-200',
                  isActive && 'animate-pulse-subtle'
                )}
              >
                <div
                  className={cx(
                    'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-body-sm font-semibold transition-all duration-200',
                    isCompleted ? 'bg-success text-on-success' :
                    isActive ? 'bg-primary text-on-primary' :
                    isFailed ? 'bg-error text-on-error' :
                    isSkipped ? 'bg-surface-container-highest text-on-surface-variant' :
                    'bg-surface-container-highest text-on-surface-variant'
                  )}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span className="material-symbols-outlined text-[18px]">{iconName}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cx('font-semibold text-body-sm', stepStatusClass)}>{label}</span>
                    {isActive && (
                      <Badge variant="info" size="sm" icon="sync">Current</Badge>
                    )}
                    {isFailed && <Badge variant="danger" size="sm" icon="error">Failed</Badge>}
                    {isSkipped && <Badge variant="neutral" size="sm" icon="skip_next">Skipped</Badge>}
                  </div>
                  <p className={cx('text-body-xs mt-0.5 truncate', stepStatusClass)}>
                    {step.description}
                  </p>
                  {step.requiredFields && step.requiredFields.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {step.requiredFields.map((field, fi) => (
                        <Badge key={fi} variant="neutral" size="xs" icon="edit">
                          {field}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                {step.error && (
                  <div className="flex-shrink-0 w-64 px-2 py-1 rounded bg-error-container text-on-error-container text-body-xs">
                    {step.error}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Context summary */}
        {workflowPlan.context && Object.keys(workflowPlan.context).length > 0 && (
          <details className="group">
            <summary className="flex items-center gap-2 text-label-md text-on-surface-variant cursor-pointer select-none">
              <span className="material-symbols-outlined text-on-surface-variant">expand_more</span>
              <span className="font-medium">Workflow Context</span>
            </summary>
            <div className="mt-2 p-3 rounded bg-surface-container-lowest border border-outline-variant/30 text-body-xs text-on-surface-variant font-mono">
              <pre>{JSON.stringify(workflowPlan.context, null, 2)}</pre>
            </div>
          </details>
        )}

        {/* Error display */}
        {workflowPlan.error && (
          <div className="rounded-lg bg-error-container text-on-error-container px-4 py-3 text-body-sm font-semibold" role="alert">
            {workflowPlan.error}
          </div>
        )}

        {/* Proposal/Appointment reference */}
        {(workflowPlan.proposalId || workflowPlan.appointmentId) && (
          <div className="rounded-lg bg-primary-container text-on-primary-container px-4 py-3 text-body-sm">
            {workflowPlan.proposalId && (
              <div className="flex flex-wrap gap-1">
                <span className="font-semibold">Proposal:</span>
                <code className="bg-primary text-on-primary px-1 rounded">{workflowPlan.proposalId}</code>
              </div>
            )}
            {workflowPlan.appointmentId && (
              <div className="flex flex-wrap gap-1">
                <span className="font-semibold">Appointment:</span>
                <code className="bg-primary text-on-primary px-1 rounded">{workflowPlan.appointmentId}</code>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}