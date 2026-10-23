import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Button from '../common/Button';
import Input from '../common/Input';
import Textarea from '../common/Textarea';
import Select from '../common/Select';

const TYPE_OPTIONS = [
  { value: 'appointment_upcoming', label: 'Appointment Upcoming' },
  { value: 'appointment_today', label: 'Appointment Today' },
  { value: 'followup_overdue', label: 'Follow-up Overdue' },
  { value: 'followup_due', label: 'Follow-up Due' },
  { value: 'referral_pending', label: 'Referral Pending' },
  { value: 'prescription_renewal', label: 'Prescription Renewal' },
  { value: 'custom', label: 'Custom' },
];

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const CHANNEL_OPTIONS = [
  { value: 'in_app', label: 'In-App' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

export default function ReminderForm({
  initialData = {},
  onSubmit,
  onCancel,
  loading = false,
  title,
}) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    patientId: '',
    type: 'appointment_upcoming',
    sourceEvent: { type: '', id: '', title: '', description: '', eventDate: '' },
    channel: 'in_app',
    priority: 'medium',
    scheduledFor: '',
    message: { subject: '', body: '' },
    ...initialData,
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        patientId: '',
        type: 'appointment_upcoming',
        sourceEvent: { type: '', id: '', title: '', description: '', eventDate: '' },
        channel: 'in_app',
        priority: 'medium',
        scheduledFor: '',
        message: { subject: '', body: '' },
        ...initialData,
      });
    }
  }, [initialData]);

  const validate = () => {
    const newErrors = {};
    if (!formData.patientId) newErrors.patientId = t('common.required');
    if (!formData.type) newErrors.type = t('common.required');
    if (!formData.message?.subject?.trim()) newErrors.subject = t('common.required');
    if (!formData.message?.body?.trim()) newErrors.body = t('common.required');
    if (formData.channel !== 'in_app' && !formData.scheduledFor) {
      newErrors.scheduledFor = t('common.required');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value },
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit?.(formData);
  };

  return (
    <Card title={title || t('reminders.createTitle')} subtitle={t('reminders.subtitle')} icon="notifications">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t('reminders.patient')}
            type="text"
            placeholder="Patient ID (auto-filled if from context)"
            value={formData.patientId}
            onChange={(e) => handleChange('patientId', e.target.value)}
            error={errors.patientId}
            disabled={!!initialData.patientId}
          />

          <Select
            label={t('reminders.type')}
            value={formData.type}
            onChange={(e) => handleChange('type', e.target.value)}
            options={TYPE_OPTIONS}
            error={errors.type}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label={t('reminders.priority')}
            value={formData.priority}
            onChange={(e) => handleChange('priority', e.target.value)}
            options={PRIORITY_OPTIONS}
          />

          <Select
            label={t('reminders.channel')}
            value={formData.channel}
            onChange={(e) => handleChange('channel', e.target.value)}
            options={CHANNEL_OPTIONS}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t('reminders.scheduledFor')}
            type="datetime-local"
            value={formData.scheduledFor ? formData.scheduledFor.slice(0, 16) : ''}
            onChange={(e) => handleChange('scheduledFor', e.target.value)}
            error={errors.scheduledFor}
          />

          <Input
            label={t('reminders.sourceEvent.title')}
            type="text"
            placeholder="e.g., Appointment with Dr. Smith"
            value={formData.sourceEvent.title}
            onChange={(e) => handleChange('sourceEvent.title', e.target.value)}
          />
        </div>

        <Input
          label={t('reminders.sourceEvent.description')}
          type="text"
          placeholder="Additional event details"
          value={formData.sourceEvent.description}
          onChange={(e) => handleChange('sourceEvent.description', e.target.value)}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label={t('reminders.sourceEventType')}
            value={formData.sourceEvent.type}
            onChange={(e) => handleChange('sourceEvent.type', e.target.value)}
            options={[
              { value: 'Appointment', label: 'Appointment' },
              { value: 'Consultation', label: 'Consultation' },
              { value: 'Referral', label: 'Referral' },
              { value: 'Prescription', label: 'Prescription' },
              { value: 'Custom', label: 'Custom' },
            ]}
          />

          <Input
            label={t('reminders.sourceEvent.eventDate')}
            type="datetime-local"
            value={formData.sourceEvent.eventDate ? formData.sourceEvent.eventDate.slice(0, 16) : ''}
            onChange={(e) => handleChange('sourceEvent.eventDate', e.target.value)}
          />
        </div>

        <Input
          label={t('reminders.subject')}
          type="text"
          placeholder="Reminder subject"
          value={formData.message.subject}
          onChange={(e) => handleChange('message.subject', e.target.value)}
          error={errors.subject}
        />

        <Textarea
          label={t('reminders.body')}
          placeholder="Reminder message body"
            value={formData.message.body}
            onChange={(e) => handleChange('message.body', e.target.value)}
            rows={5}
            error={errors.body}
        />

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant">
          <Button type="button" variant="outlined" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={loading}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Card>
  );
}