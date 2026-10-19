import Card from '../common/Card';
import Badge from '../common/Badge';
import { cx } from '../../utils/helpers';

/**
 * AgentActivityPanel — compact workflow ledger for JeevanDoot AI.
 * In demo mode shows simulated steps; in live mode the same timeline is
 * enriched with real server tool events (never fabricated, never internals).
 * Collapsible on small screens via <details>.
 */
export default function AgentActivityPanel({ steps, summary, mode = 'demo' }) {
  const doneCount = steps.filter((s) => s.state === 'done').length;
  const isLive = mode === 'live';
  const badge = isLive
    ? <Badge variant="success" icon="cloud_done">Live ledger</Badge>
    : <Badge variant="warning" icon="science">Demo</Badge>;
  const subtitle = isLive ? 'Server-recorded workflow steps' : 'Simulated demo steps';
  const summaryLabel = isLive ? 'Workflow summary: ' : 'Demo summary: ';

  const body = (
    <>
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={step.id} className="flex items-start gap-3">
            <span
              className={cx(
                'material-symbols-outlined mt-0.5',
                step.state === 'done' && 'text-primary',
                step.state === 'active' && 'text-tertiary',
                step.state === 'failed' && 'text-error',
                step.state === 'todo' && 'text-outline'
              )}
              aria-hidden="true"
            >
              {step.state === 'done' ? 'check_circle' : step.state === 'active' ? 'progress_activity' : step.state === 'failed' ? 'error' : 'radio_button_unchecked'}
            </span>
            <div className="min-w-0">
              <p
                className={cx(
                  'text-body-sm',
                  step.state === 'todo' ? 'text-on-surface-variant' : 'font-semibold text-on-surface'
                )}
              >
                {i + 1}. {step.label}
              </p>
              {step.state === 'active' && (
                <p className="text-label-md text-on-surface-variant">Working on this step{isLive ? ' (live)' : ' (demo)'}…</p>
              )}
              {step.detail && (
                <p className="text-label-md text-on-surface-variant break-words">{step.detail}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 rounded-lg bg-surface-container px-4 py-3 text-body-sm text-on-surface-variant">
        <span className="font-bold text-on-surface">{summaryLabel}</span>
        {summary} ({doneCount} of {steps.length} steps shown as complete)
      </div>
    </>
  );

  return (
    <>
      {/* Desktop / tablet: static card */}
      <div className="hidden lg:block">
        <Card
          title="Agent activity"
          subtitle={subtitle}
          icon="monitoring"
          headerRight={badge}
        >
          {body}
        </Card>
      </div>
      {/* Mobile: collapsible to save room */}
      <div className="lg:hidden">
        <Card
          title="Agent activity"
          subtitle={subtitle}
          icon="monitoring"
          headerRight={badge}
        >
          <details>
            <summary className="cursor-pointer font-bold text-primary text-body-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
              Show {isLive ? 'workflow' : 'demo'} steps
            </summary>
            <div className="pt-3">{body}</div>
          </details>
        </Card>
      </div>
    </>
  );
}
