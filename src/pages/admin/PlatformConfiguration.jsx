import { useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Input from '../../components/common/Input';
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

function Toggle({ label, description, enabled, onChange }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-outline-variant last:border-0">
      <div>
        <p className="font-bold text-on-surface">{label}</p>
        <p className="text-label-md text-on-surface-variant">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`relative w-14 h-8 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant'}`}
        aria-label={label}
      >
        <span
          className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${enabled ? 'left-7' : 'left-1'}`}
        />
      </button>
    </div>
  );
}

export default function PlatformConfiguration() {
  const { notify } = useNotification();
  const [settings, setSettings] = useState({
    twoFactor: true,
    emailAlerts: true,
    smsAlerts: true,
    autoAudit: true,
    offlineMode: false,
    mlRisk: true,
  });
  const [saving, setSaving] = useState(false);

  const toggle = (key) => setSettings((s) => ({ ...s, [key]: !s[key] }));

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    notify({ type: 'success', message: 'Configuration saved successfully' });
  };

  const toggleGroups = [
    {
      title: 'Security',
      icon: 'security',
      items: [
        { key: 'twoFactor', label: 'Two-Factor Authentication', description: 'Require OTP for all staff logins' },
        { key: 'autoAudit', label: 'Automatic Audit Logging', description: 'Record every high-risk case action' },
      ],
    },
    {
      title: 'Notifications',
      icon: 'notifications',
      items: [
        { key: 'emailAlerts', label: 'Email Alerts', description: 'Send critical alerts by email' },
        { key: 'smsAlerts', label: 'SMS Alerts', description: 'Send critical alerts to patient phones' },
      ],
    },
    {
      title: 'Clinical Features',
      icon: 'medical_services',
      items: [
        { key: 'mlRisk', label: 'ML Risk Prediction', description: 'Use ML models to flag high-risk patients' },
        { key: 'offlineMode', label: 'Offline Mode', description: 'Allow field workers to capture data without network' },
      ],
    },
  ];

  return (
    <DashboardLayout
      sidebarProps={SIDEBAR}
      headerProps={{ title: 'Platform Configuration', subtitle: 'System-wide preferences' }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {toggleGroups.map((group) => (
            <Card key={group.title} title={group.title} icon={group.icon}>
              {group.items.map((item) => (
                <Toggle
                  key={item.key}
                  label={item.label}
                  description={item.description}
                  enabled={settings[item.key]}
                  onChange={() => toggle(item.key)}
                />
              ))}
            </Card>
          ))}

          <Card title="Regional Settings" icon="public">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Default Language" defaultValue="English" icon="translate" />
              <Input label="Time Zone" defaultValue="Asia/Kolkata (IST)" icon="schedule" />
              <Input label="Emergency Contact" defaultValue="+91 1800-00-0101" icon="call" />
              <Input label="Data Retention (months)" defaultValue="60" type="number" icon="database" />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Save Changes" icon="save">
            <p className="text-label-md text-on-surface-variant mb-4">
              Configuration changes take effect immediately across all portals.
            </p>
            <Button fullWidth onClick={handleSave} loading={saving} icon="save">Save Configuration</Button>
          </Card>

          <Card title="System Status" icon="monitor_heart">
            <div className="space-y-3">
              {[
                { label: 'API Service', status: 'Operational', dot: 'bg-success' },
                { label: 'Mock Data Mode', status: 'Enabled', dot: 'bg-warning' },
                { label: 'Last Backup', status: 'Today 03:00', dot: 'bg-success' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-on-surface-variant text-label-md">{row.label}</span>
                  <Badge variant="neutral" dot dotColor={row.dot}>{row.status}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Danger Zone" icon="warning" className="border-l-4 border-l-error">
            <p className="text-label-md text-on-surface-variant mb-4">
              Resetting the platform clears all cached state. This cannot be undone.
            </p>
            <Button variant="danger" fullWidth onClick={() => notify({ type: 'error', message: 'Reset requires admin PIN confirmation' })}>
              Reset Platform Data
            </Button>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
