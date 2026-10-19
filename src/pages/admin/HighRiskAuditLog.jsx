import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import SearchBar from '../../components/common/SearchBar';
import EmptyState from '../../components/common/EmptyState';
import { reportService } from '../../services/reportService';
import { useDebounce } from '../../hooks/useDebounce';
import { useNotification } from '../../hooks/useNotification';

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

export default function HighRiskAuditLog() {
  const { notify } = useNotification();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    const load = async () => {
      const data = await reportService.getAuditLogs();
      setLogs(data);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = logs.filter(
    (l) =>
      !debouncedQuery ||
      l.patientId.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      l.handledBy.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      l.outcome.toLowerCase().includes(debouncedQuery.toLowerCase())
  );

  const handleExport = async () => {
    await reportService.exportCsv();
    notify({ type: 'success', message: 'Audit log exported as CSV' });
  };

  return (
    <DashboardLayout
      sidebarProps={SIDEBAR}
      headerProps={{
        title: 'High-Risk Case Audit Log',
        subtitle: 'Immutable trail of critical case handling',
        right: <Button icon="download" onClick={handleExport}>Export CSV</Button>,
      }}
    >
      <Card
        title="Audit Entries"
        subtitle={`${filtered.length} entries`}
        headerRight={<SearchBar placeholder="Search patient, staff, outcome..." onSearch={setQuery} containerClassName="w-80" />}
      >
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="manage_search" title="No audit entries" description="No records match your search." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-primary text-on-primary">
                  <th className="px-6 py-3 font-headline font-semibold">Timestamp</th>
                  <th className="px-6 py-3 font-headline font-semibold">Patient ID</th>
                  <th className="px-6 py-3 font-headline font-semibold">Risk Level</th>
                  <th className="px-6 py-3 font-headline font-semibold">Handled By</th>
                  <th className="px-6 py-3 font-headline font-semibold">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log, i) => (
                  <tr key={i} className="border-b border-outline-variant hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-4 text-on-surface-variant">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-outline">lock_clock</span>
                        {log.timestamp}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-semibold text-primary">{log.patientId}</td>
                    <td className="px-6 py-4">
                      <Badge variant={log.risk === 'Critical' ? 'critical' : 'warning'}>{log.risk}</Badge>
                    </td>
                    <td className="px-6 py-4">{log.handledBy}</td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={
                          log.outcome === 'Resolved'
                            ? 'success'
                            : log.outcome === 'Pending'
                              ? 'warning'
                              : 'secondary'
                        }
                        dot
                      >
                        {log.outcome}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </DashboardLayout>
  );
}
