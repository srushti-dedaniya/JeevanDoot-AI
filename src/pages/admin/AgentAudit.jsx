import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Select from '../../components/common/Select';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import EmptyState from '../../components/common/EmptyState';
import Loader from '../../components/common/Loader';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import { getAllAgentRuns } from '../../services/aiAgentService';

const SIDEBAR = {
  items: [
    { label: 'Dashboard', to: '/admin/dashboard', icon: 'dashboard', end: true },
    { label: 'Disease Surveillance', to: '/admin/surveillance', icon: 'public_health' },
    { label: 'Case-Level Analytics', to: '/admin/case-analytics', icon: 'analytics' },
    { label: 'Audit Log', to: '/admin/audit-log', icon: 'verified_user' },
    { label: 'Report Generation', to: '/admin/reports', icon: 'summarize' },
    { label: 'Doctor Management', to: '/admin/doctors', icon: 'medical_services' },
    { label: 'Configuration', to: '/admin/settings', icon: 'settings' },
    { label: 'JeevanDoot AI', to: '/admin/ai-assistant', icon: 'smart_toy' },
    { label: 'Agent Audit', to: '/admin/agent-audit', icon: 'monitor_heart' },
  ],
};

const STATUS_OPTIONS = ['', 'started', 'awaiting_confirmation', 'running', 'completed', 'failed', 'expired'];
const INTENT_OPTIONS = ['', 'UPCOMING_APPOINTMENTS', 'BOOK_APPOINTMENT', 'RESCHEDULE_APPOINTMENT', 'CANCEL_APPOINTMENT', 'DOCTOR_DIRECTORY', 'REFERRALS', 'FOLLOW_UPS', 'CLINIC_INFORMATION', 'UNKNOWN_OR_UNSUPPORTED'];

const STATUS_BADGE = {
  completed: 'success',
  failed: 'error',
  expired: 'warning',
  running: 'tertiary',
  awaiting_confirmation: 'warning',
  started: 'neutral',
};

const shortId = (id) => (id && id.length > 13 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id || '—');

export default function AgentAudit() {
  const [status, setStatus] = useState('');
  const [intent, setIntent] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { limit: 100 };
      if (status) params.status = status;
      if (intent) params.intent = intent;
      if (from) params.from = from;
      if (to) params.to = to;
      const { runs: items } = await getAllAgentRuns(params);
      setRuns(items);
    } catch (err) {
      setError(err?.message || 'Could not load agent runs.');
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [status, intent, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = [
    { key: 'requestId', header: 'Request', render: (r) => <span className="font-mono text-body-sm" title={r.requestId}>{shortId(r.requestId)}</span> },
    { key: 'intent', header: 'Intent', render: (r) => <span className="text-body-sm">{r.intent || '—'}</span> },
    {
      key: 'status', header: 'Status',
      render: (r) => <Badge variant={STATUS_BADGE[r.status] || 'neutral'}>{r.status}</Badge>,
    },
    {
      key: 'events', header: 'Tools',
      render: (r) => <span className="text-body-sm text-on-surface-variant">{(r.events || []).map((e) => e.tool).join(', ') || '—'}</span>,
    },
    {
      key: 'result', header: 'Result',
      render: (r) => <span className="text-body-sm font-semibold">{r.result || '—'}{r.errorCode ? ` (${r.errorCode})` : ''}</span>,
    },
    {
      key: 'createdAt', header: 'Started',
      render: (r) => <span className="text-body-sm text-on-surface-variant">{r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN') : '—'}</span>,
    },
  ];

  return (
    <DashboardLayout
      sidebarProps={SIDEBAR}
      headerProps={{ title: 'Agent Audit', subtitle: 'Persistent AI workflow ledger (admin only)' }}
    >
      <div className="space-y-6">
        <Card title="Filters" icon="filter_alt">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={STATUS_OPTIONS.map((v) => ({ value: v, label: v || 'All statuses' }))} />
            <Select label="Intent" value={intent} onChange={(e) => setIntent(e.target.value)} options={INTENT_OPTIONS.map((v) => ({ value: v, label: v || 'All intents' }))} />
            <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            <div className="flex items-end">
              <Button onClick={load} icon="refresh" loading={loading}>Apply</Button>
            </div>
          </div>
        </Card>

        <Card
          title="Agent runs"
          subtitle="Minimal safe summaries — no transcripts or patient details"
          icon="monitoring"
          headerRight={<Badge variant="neutral">{runs.length} shown</Badge>}
        >
          {loading ? (
            <Loader label="Loading agent runs…" />
          ) : error ? (
            <EmptyState
              icon="error"
              title="Could not load audit data"
              description={error}
              action={<Button size="sm" icon="refresh" onClick={load}>Retry</Button>}
            />
          ) : (
            <>
              <Table
                columns={columns}
                data={runs}
                rowKey="requestId"
                onRowClick={setSelected}
                emptyState={<EmptyState icon="monitoring" title="No agent runs yet" description="Runs appear here once users interact with JeevanDoot AI." />}
              />
              <Pagination items={runs} perPage={10} />
            </>
          )}
        </Card>
      </div>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Agent run detail" icon="monitoring" size="lg">
        {selected && (
          <dl className="space-y-3 text-body-sm">
            <div className="flex gap-2"><dt className="w-36 shrink-0 text-on-surface-variant">Request ID</dt><dd className="font-mono break-all">{selected.requestId}</dd></div>
            <div className="flex gap-2"><dt className="w-36 shrink-0 text-on-surface-variant">Intent</dt><dd className="font-semibold">{selected.intent || '—'}</dd></div>
            <div className="flex gap-2"><dt className="w-36 shrink-0 text-on-surface-variant">Status</dt><dd><Badge variant={STATUS_BADGE[selected.status] || 'neutral'}>{selected.status}</Badge></dd></div>
            <div className="flex gap-2"><dt className="w-36 shrink-0 text-on-surface-variant">Actor role</dt><dd>{selected.role || '—'}{selected.actor?.name ? ` · ${selected.actor.name}` : ''}</dd></div>
            <div className="flex gap-2"><dt className="w-36 shrink-0 text-on-surface-variant">Proposal</dt><dd className="font-mono break-all">{selected.proposalId || '—'}</dd></div>
            <div className="flex gap-2"><dt className="w-36 shrink-0 text-on-surface-variant">Appointment</dt><dd className="font-mono break-all">{selected.appointmentId || '—'}</dd></div>
            <div>
              <dt className="text-on-surface-variant mb-1">Tool events</dt>
              <dd>
                {(selected.events || []).length === 0 && <span className="text-on-surface-variant">No tool calls recorded.</span>}
                <ul className="space-y-1">
                  {(selected.events || []).map((e, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Badge variant={e.outcome === 'ok' ? 'success' : 'error'}>{e.outcome}</Badge>
                      <span className="font-semibold">{e.tool}</span>
                      {e.code && <span className="text-on-surface-variant">({e.code})</span>}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
            <div className="flex gap-2"><dt className="w-36 shrink-0 text-on-surface-variant">Result</dt><dd className="font-semibold">{selected.result || '—'}{selected.errorCode ? ` (${selected.errorCode})` : ''}</dd></div>
          </dl>
        )}
      </Modal>
    </DashboardLayout>
  );
}
