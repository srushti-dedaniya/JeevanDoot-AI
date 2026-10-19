import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PatientSidebar from '../../components/layout/PatientSidebar';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import { formatDate } from '../../utils/formatDate';
import { cx } from '../../utils/helpers';
import { usePatient } from '../../hooks/usePatient';

function Field({ label, value, icon, wrapperClassName }) {
  return (
    <div className={cx('bg-surface-container-low rounded-lg p-4 flex items-center gap-3 min-w-0', wrapperClassName)}>
      <span className="material-symbols-outlined text-primary shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-label-md text-on-surface-variant">{label}</p>
        <p className="font-bold text-on-surface truncate">{value || '—'}</p>
      </div>
    </div>
  );
}

export default function Profile() {
  const { t } = useTranslation();
  const { patient: profile, updateProfile } = usePatient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => ({ ...profile, emergencyContact: { ...profile.emergencyContact } }));
  const [passwordModal, setPasswordModal] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });

  const initials = profile.name.split(' ').map((n) => n[0]).join('');

  const startEdit = () => {
    setForm({ ...profile, emergencyContact: { ...profile.emergencyContact } });
    setEditing(true);
  };

  const saveChanges = () => {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      toast.error(t('patient.profile.fieldsRequired'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error(t('patient.profile.emailInvalid'));
      return;
    }
    updateProfile({ ...form, emergencyContact: { ...form.emergencyContact } });
    setEditing(false);
    toast.success(t('patient.profile.updated'));
  };

  const changePassword = () => {
    if (!passwords.current || !passwords.next || !passwords.confirm) {
      toast.error(t('settings.fillAllPasswordFields'));
      return;
    }
    if (passwords.next !== passwords.confirm) {
      toast.error(t('settings.passwordMismatch'));
      return;
    }
    if (passwords.next.length < 8) {
      toast.error(t('patient.profile.passwordTooShort'));
      return;
    }
    setPasswords({ current: '', next: '', confirm: '' });
    setPasswordModal(false);
    toast.success(t('settings.passwordUpdated'));
  };

  const updateField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <DashboardLayout
      sidebar={<PatientSidebar />}
      headerProps={{ title: t('patient.profile.title'), subtitle: t('patient.profile.subtitle') }}
    >
      <Card className="mb-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-24 h-24 rounded-full bg-primary text-on-primary flex items-center justify-center font-headline text-3xl font-bold shrink-0">
              {initials}
            </div>
            <div>
              <h3 className="font-headline text-headline-lg font-bold text-on-surface">{profile.name}</h3>
              <p className="text-on-surface-variant">{t('patient.profile.patientIdLabel', { id: profile.patientId })}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="primary" icon="bloodtype">B+</Badge>
                <Badge variant="success" dot dotColor="bg-primary">{t('patient.profile.activePatient')}</Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            {editing ? (
              <Button icon="save" onClick={saveChanges}>{t('settings.saveChanges')}</Button>
            ) : (
              <Button icon="edit" onClick={startEdit}>{t('patient.profile.editProfile')}</Button>
            )}
            <Button variant="secondary" icon="key" onClick={() => setPasswordModal(true)}>
              {t('settings.changePassword')}
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title={t('patient.profile.contactInfo')} icon="contact_phone">
          {editing ? (
            <div className="space-y-4">
              <Input label={t('patient.profile.fullName')} value={form.name} onChange={(e) => updateField('name', e.target.value)} icon="badge" />
              <Input label={t('settings.email')} type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} icon="mail" />
              <Input label={t('patient.profile.phone')} value={form.phone} onChange={(e) => updateField('phone', e.target.value)} icon="call" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('common.name')} value={profile.name} icon="badge" />
              <Field label={t('patient.profile.patientId')} value={profile.patientId} icon="pin" />
              <Field label={t('settings.email')} value={profile.email} icon="mail" />
              <Field label={t('patient.profile.phone')} value={profile.phone} icon="call" />
            </div>
          )}
        </Card>

        <Card title={t('patient.profile.personalInfo')} icon="person">
          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={t('patient.profile.dateOfBirth')}
                  type="date"
                  value={form.dob}
                  onChange={(e) => updateField('dob', e.target.value)}
                  icon="cake"
                />
                <div>
                  <label className="block text-label-lg font-semibold text-on-surface ml-1 mb-2">{t('patient.profile.gender')}</label>
                  <select
                    value={form.gender}
                    onChange={(e) => updateField('gender', e.target.value)}
                    className="w-full h-14 bg-surface-container-low border border-outline-variant rounded-lg px-4 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Female">{t('patient.profile.genderFemale')}</option>
                    <option value="Male">{t('patient.profile.genderMale')}</option>
                    <option value="Other">{t('patient.profile.genderOther')}</option>
                  </select>
                </div>
              </div>
              <Input label={t('patient.profile.address')} value={form.address} onChange={(e) => updateField('address', e.target.value)} icon="location_on" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('patient.profile.dateOfBirth')} value={formatDate(`${profile.dob}T00:00:00`, 'dd MMM yyyy')} icon="cake" />
              <Field label={t('patient.profile.gender')} value={profile.gender} icon="wc" />
              <Field label={t('patient.profile.address')} value={profile.address} icon="location_on" wrapperClassName="sm:col-span-2" />
            </div>
          )}
        </Card>
      </div>

      <Card title={t('patient.profile.emergencyContact')} icon="emergency" className="mt-6">
        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label={t('patient.profile.contactName')}
              value={form.emergencyContact.name}
              onChange={(e) => updateField('emergencyContact', { ...form.emergencyContact, name: e.target.value })}
              icon="person"
            />
            <Input
              label={t('patient.profile.relationship')}
              value={form.emergencyContact.relationship}
              onChange={(e) => updateField('emergencyContact', { ...form.emergencyContact, relationship: e.target.value })}
              icon="family_restroom"
            />
            <Input
              label={t('patient.profile.phone')}
              value={form.emergencyContact.phone}
              onChange={(e) => updateField('emergencyContact', { ...form.emergencyContact, phone: e.target.value })}
              icon="call"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label={t('patient.profile.contactName')} value={profile.emergencyContact.name} icon="person" />
            <Field label={t('patient.profile.relationship')} value={profile.emergencyContact.relationship} icon="family_restroom" />
            <Field label={t('patient.profile.phone')} value={profile.emergencyContact.phone} icon="call" />
          </div>
        )}
      </Card>

      <Modal
        open={passwordModal}
        onClose={() => setPasswordModal(false)}
        title={t('settings.changePassword')}
        icon="key"
        footer={
          <>
            <Button variant="outline" onClick={() => setPasswordModal(false)}>{t('common.cancel')}</Button>
            <Button icon="key" onClick={changePassword}>{t('patient.profile.updatePassword')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            type="password"
            label={t('settings.currentPassword')}
            value={passwords.current}
            onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
            icon="lock"
            placeholder="••••••••"
          />
          <Input
            type="password"
            label={t('settings.newPassword')}
            value={passwords.next}
            onChange={(e) => setPasswords((p) => ({ ...p, next: e.target.value }))}
            icon="lock"
            placeholder={t('patient.profile.passwordMinChars')}
          />
          <Input
            type="password"
            label={t('settings.confirmNewPassword')}
            value={passwords.confirm}
            onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
            icon="lock"
            placeholder="••••••••"
          />
        </div>
      </Modal>
    </DashboardLayout>
  );
}
