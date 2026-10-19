import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import SearchBar from '../../components/common/SearchBar';
import Input from '../../components/common/Input';
import { doctorService } from '../../services/doctorService';
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

const EMPTY_FORM = { name: '', specialty: '', email: '', phone: '' };

export default function DoctorManagement() {
  const { notify } = useNotification();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  const load = async () => {
    setLoading(true);
    const data = await doctorService.getAll();
    setDoctors(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = doctors.filter(
    (d) =>
      !debouncedQuery ||
      d.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      d.specialty.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      d.id.toLowerCase().includes(debouncedQuery.toLowerCase())
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    const created = await doctorService.create(form);
    setSaving(false);
    setDoctors((prev) => [...prev, created]);
    setShowModal(false);
    setForm(EMPTY_FORM);
    notify({ type: 'success', message: `Doctor ${created.id} added` });
  };

  const handleToggle = async (doctor) => {
    await doctorService.toggleStatus(doctor.id);
    setDoctors((prev) =>
      prev.map((d) => (d.id === doctor.id ? { ...d, status: d.status === 'Online' ? 'Offline' : 'Online' } : d))
    );
    notify({ type: 'info', message: `${doctor.name} status toggled` });
  };

  return (
    <DashboardLayout
      sidebarProps={SIDEBAR}
      headerProps={{
        title: 'Doctor Management',
        subtitle: `${doctors.length} doctors registered`,
        right: (
          <Button icon="person_add" onClick={() => setShowModal(true)}>
            Add Doctor
          </Button>
        ),
      }}
    >
      <Card
        title="Registered Doctors"
        subtitle="Manage profiles and availability"
        headerRight={<SearchBar placeholder="Search doctors..." onSearch={setQuery} containerClassName="w-72" />}
      >
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-primary text-on-primary">
                  <th className="px-6 py-3 font-headline font-semibold">Doctor</th>
                  <th className="px-6 py-3 font-headline font-semibold">ID</th>
                  <th className="px-6 py-3 font-headline font-semibold">Specialty</th>
                  <th className="px-6 py-3 font-headline font-semibold">Patients</th>
                  <th className="px-6 py-3 font-headline font-semibold">Rating</th>
                  <th className="px-6 py-3 font-headline font-semibold">Status</th>
                  <th className="px-6 py-3 font-headline font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} className="border-b border-outline-variant hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-headline font-bold">
                          {d.name.replace('Dr. ', '').split(' ').map((n) => n[0]).join('')}
                        </div>
                        <span className="font-bold text-on-surface">{d.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-semibold text-primary">{d.id}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{d.specialty}</td>
                    <td className="px-6 py-4 font-semibold">{d.patients.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1 font-semibold">
                        <span className="material-symbols-outlined text-sm text-warning">star</span>
                        {d.rating}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={d.status === 'Online' ? 'success' : 'neutral'} dot dotColor={d.status === 'Online' ? 'bg-success' : 'bg-outline'}>
                        {d.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleToggle(d)}>
                          {d.status === 'Online' ? 'Set Offline' : 'Set Online'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => notify({ type: 'info', message: `Viewing ${d.name}` })}>
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add New Doctor" icon="person_add" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Full Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Dr. Name" icon="person" required />
          <Input label="Specialty" value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))} placeholder="e.g. General Physician" icon="stethoscope" required />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="doctor@jeevandoot.org" icon="mail" required />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" icon="call" required />
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={saving} icon="person_add">Add Doctor</Button>
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
