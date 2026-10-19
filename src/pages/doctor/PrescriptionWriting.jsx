import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Table from '../../components/common/Table';
import { MEDICATION_SUGGESTIONS, COMMON_MEDICINE_SCHEDULES } from '../../utils/constants';
import {
  validatePrescription,
  savePrescription,
  downloadPrescriptionPDF,
  printPrescription,
} from '../../utils/prescriptionUtils';
import { consumePrescriptionDraft } from '../../utils/consultationUtils';
import { prescriptionService } from '../../services/prescriptionService';

const SIDEBAR = {
  items: [
    { labelKey: 'dashboard', to: '/doctor/dashboard', icon: 'dashboard', end: true },
    { labelKey: 'patientQueue', to: '/doctor/queue', icon: 'groups' },
    { labelKey: 'liveConsultation', to: '/doctor/consultation', icon: 'call' },
    { labelKey: 'consultationHistory', to: '/doctor/consultation-history', icon: 'video_library' },
    { labelKey: 'performanceAnalytics', to: '/doctor/performance', icon: 'query_stats' },
    { labelKey: 'aiAssistant', to: '/doctor/ai-assistant', icon: 'smart_toy' },
  ],
};

const DEFAULT_SCHEDULE = {
  morning: false,
  afternoon: false,
  night: false,
};

const EMPTY_MEDICINE = {
  medicineName: '',
  dosage: '',
  frequency: '',
  duration: '',
};

const nextMedicineId = () => `med-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function PrescriptionWriting() {
  const { t } = useTranslation();
  const sidebarItems = SIDEBAR.items.map((item) => ({ ...item, label: t(`nav.${item.labelKey}`) }));
  const [patientId, setPatientId] = useState('JD-5XA2MN');
  const [patientName, setPatientName] = useState('Meera Sharma');
  const [medicines, setMedicines] = useState([]);
  const [current, setCurrent] = useState(EMPTY_MEDICINE);
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [editingId, setEditingId] = useState(null);
  const [diagnosis, setDiagnosis] = useState('');
  const [advice, setAdvice] = useState('');
  const [draftSource, setDraftSource] = useState(null);

  useEffect(() => {
    const draft = consumePrescriptionDraft();
    if (!draft) return;
    if (draft.patientId) setPatientId(draft.patientId);
    if (draft.patientName) setPatientName(draft.patientName);
    if (draft.diagnosis) setDiagnosis(draft.diagnosis);
    if (draft.advice) setAdvice(draft.advice);
    if (Array.isArray(draft.medicines) && draft.medicines.length > 0) {
      setMedicines(draft.medicines);
    }
    setDraftSource(draft.fromConsultation || null);
    toast.success(t('prescription.consultationLoaded'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleLabel = (value = {}) =>
    COMMON_MEDICINE_SCHEDULES.filter((slot) => value[slot.toLowerCase()])
      .map((slot) => t(`prescription.${slot.toLowerCase()}`))
      .join(', ');

  const validateMedicineInput = () => {
    const missing = [];
    if (!current.medicineName.trim()) missing.push(t('prescription.missingMedicineName'));
    if (!current.dosage.trim()) missing.push(t('prescription.missingDosage'));
    if (!current.frequency.trim()) missing.push(t('prescription.missingFrequency'));
    if (!current.duration.trim()) missing.push(t('prescription.missingDuration'));
    return missing;
  };

  const resetMedicineForm = () => {
    setCurrent(EMPTY_MEDICINE);
    setSchedule(DEFAULT_SCHEDULE);
    setEditingId(null);
  };

  const addMedicine = () => {
    const missing = validateMedicineInput();
    if (missing.length > 0) {
      toast.error(t('prescription.cannotAddMissing', { fields: missing.join(', ') }));
      return;
    }

    if (editingId) {
      setMedicines((prev) =>
        prev.map((med) => (med.id === editingId ? { ...med, ...current, schedule } : med))
      );
      toast.success(t('prescription.medicineUpdated'));
    } else {
      setMedicines((prev) => [...prev, { id: nextMedicineId(), ...current, schedule }]);
      toast.success(t('prescription.medicineAdded'));
    }

    resetMedicineForm();
  };

  const startEdit = (med) => {
    setEditingId(med.id);
    setCurrent({
      medicineName: med.medicineName,
      dosage: med.dosage,
      frequency: med.frequency,
      duration: med.duration,
    });
    setSchedule(med.schedule || DEFAULT_SCHEDULE);
    toast.success(t('prescription.editing', { name: med.medicineName }));
  };

  const removeMedicine = (med) => {
    const confirmed = window.confirm(t('prescription.removeConfirm', { name: med.medicineName }));
    if (!confirmed) return;
    setMedicines((prev) => prev.filter((m) => m.id !== med.id));
    if (editingId === med.id) resetMedicineForm();
    toast.success(t('prescription.medicineRemoved'));
  };

  const buildData = () => ({
    patientId,
    patientName,
    medicines,
    diagnosis,
    advice,
  });

  const handleDownload = () => {
    const missingFields = validatePrescription(buildData());
    if (missingFields.length > 0) {
      toast.error(t('prescription.cannotDownloadMissing', { fields: missingFields.join(', ') }));
      return;
    }
    downloadPrescriptionPDF(buildData());
    toast.success(t('prescription.pdfDownloaded'));
  };

  const handleSave = async () => {
    const result = savePrescription(buildData());
    if (!result.success) {
      if (result.missingFields) {
        toast.error(t('prescription.cannotSaveMissing', { fields: result.missingFields.join(', ') }));
      } else {
        toast.error(result.error || t('prescription.couldNotSave'));
      }
      return;
    }
    toast.success(t('prescription.savedSuccess'));
    try {
      const saved = await prescriptionService.create(buildData());
      if (saved?.prescriptionId) {
        toast.success(t('prescription.syncedBackend', { id: saved.prescriptionId }));
      }
    } catch (err) {
      toast.error(t('prescription.syncFailed'));
    }
  };

  const handlePrint = () => {
    const missingFields = validatePrescription(buildData());
    if (missingFields.length > 0) {
      toast.error(t('prescription.cannotPrintMissing', { fields: missingFields.join(', ') }));
      return;
    }
    printPrescription(buildData());
  };

  return (
    <DashboardLayout
      sidebarProps={{ items: sidebarItems }}
      headerProps={{ title: t('prescription.title'), subtitle: t('prescription.subtitle') }}
    >
      {draftSource && (
        <div className="mb-6 flex items-center gap-3 bg-secondary-container text-on-secondary-container rounded-xl px-5 py-4">
          <span className="material-symbols-outlined">fact_check</span>
          <p className="font-bold">
            {t('prescription.prefilledBanner', { id: draftSource })}
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card title={t('prescription.patientInformation')} icon="person">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('prescription.patientId')} value={patientId} onChange={(e) => setPatientId(e.target.value)} icon="badge" />
              <Input label={t('prescription.patientName')} value={patientName} onChange={(e) => setPatientName(e.target.value)} icon="person" />
            </div>
          </Card>

          <Card
            title={editingId ? t('prescription.editMedicine') : t('prescription.addMedication')}
            icon="medication"
            subtitle={editingId ? t('prescription.updateDetailsBelow') : t('prescription.addOneAtATime')}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label={t('prescription.medicineName')}
                value={current.medicineName}
                onChange={(e) => setCurrent((c) => ({ ...c, medicineName: e.target.value }))}
                placeholder={t('prescription.placeholderMedicineName')}
                icon="medication"
              />
              <Input
                label={t('prescription.dosage')}
                value={current.dosage}
                onChange={(e) => setCurrent((c) => ({ ...c, dosage: e.target.value }))}
                placeholder={t('prescription.placeholderDosage')}
                icon="edit_note"
              />
              <Input
                label={t('prescription.frequency')}
                value={current.frequency}
                onChange={(e) => setCurrent((c) => ({ ...c, frequency: e.target.value }))}
                placeholder={t('prescription.placeholderFrequency')}
                icon="schedule"
              />
              <Input
                label={t('prescription.durationDays')}
                value={current.duration}
                onChange={(e) => setCurrent((c) => ({ ...c, duration: e.target.value }))}
                placeholder={t('prescription.placeholderDuration')}
                type="number"
                icon="calendar_today"
              />
            </div>

            <div className="mt-4">
              <p className="font-bold text-on-surface mb-2">{t('prescription.schedule')}</p>
              <div className="flex flex-wrap gap-3">
                {COMMON_MEDICINE_SCHEDULES.map((slot) => (
                  <label
                    key={slot}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer border transition-all ${
                      schedule[slot.toLowerCase()]
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-surface-container-low text-on-surface-variant border-outline-variant'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={schedule[slot.toLowerCase()]}
                      onChange={() => setSchedule((s) => ({ ...s, [slot.toLowerCase()]: !s[slot.toLowerCase()] }))}
                    />
                    <span className="material-symbols-outlined text-sm">{schedule[slot.toLowerCase()] ? 'check' : 'add'}</span>
                    {t(`prescription.${slot.toLowerCase()}`)}
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-end justify-between gap-4 flex-wrap">
              <div className="flex flex-wrap gap-2 flex-1">
                {MEDICATION_SUGGESTIONS.filter((s) => !medicines.some((m) => m.medicineName === s)).slice(0, 4).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setCurrent((c) => ({ ...c, medicineName: s }))}
                    className="px-3 py-1.5 rounded-full bg-surface-container-low border border-outline-variant text-label-md hover:bg-primary-container transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                {editingId && (
                  <Button type="button" onClick={resetMedicineForm} icon="close" variant="outline">
                    {t('common.cancel')}
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={addMedicine}
                  icon={editingId ? 'check' : 'add_circle'}
                  variant={editingId ? 'primary' : 'secondary'}
                >
                  {editingId ? t('prescription.updateMedicine') : t('prescription.addToPrescription')}
                </Button>
              </div>
            </div>
          </Card>

          {medicines.length > 0 && (
            <Card
              title={t('prescription.prescriptionItems')}
              icon="playlist_add_check"
              subtitle={t('prescription.medicinesAdded', { count: medicines.length })}
            >
              <Table
                rowKey="id"
                data={medicines}
                columns={[
                  { key: 'medicineName', header: t('prescription.medicine') },
                  { key: 'dosage', header: t('prescription.dosage') },
                  { key: 'frequency', header: t('prescription.frequency') },
                  {
                    key: 'duration',
                    header: t('common.duration'),
                    render: (row) => t('prescription.durationValue', { count: row.duration }),
                  },
                  {
                    key: 'schedule',
                    header: t('prescription.schedule'),
                    render: (row) => scheduleLabel(row.schedule) || '—',
                  },
                  {
                    key: 'actions',
                    header: t('common.actions'),
                    render: (row) => (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          className="p-2 rounded-full text-primary hover:bg-primary-container/30 transition-colors"
                          aria-label={t('prescription.editAria', { name: row.medicineName })}
                          title={t('prescription.editTitle')}
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeMedicine(row)}
                          className="p-2 rounded-full text-error hover:bg-error-container transition-colors"
                          aria-label={t('prescription.deleteAria', { name: row.medicineName })}
                          title={t('prescription.deleteTitle')}
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    ),
                  },
                ]}
              />
            </Card>
          )}

          <Card title={t('prescription.diagnosisAdvice')} icon="stethoscope">
            <div className="space-y-4">
              <Input
                label={t('prescription.diagnosis')}
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder={t('prescription.placeholderDiagnosis')}
                icon="diagnosis"
              />
              <div>
                <label className="block text-label-lg font-semibold text-on-surface ml-1 mb-2">{t('prescription.adviceForPatient')}</label>
                <textarea
                  value={advice}
                  onChange={(e) => setAdvice(e.target.value)}
                  rows={3}
                  placeholder={t('prescription.advicePlaceholder')}
                  className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={t('common.actions')} icon="bolt">
            <div className="space-y-3">
              <p className="text-label-lg font-bold text-primary">
                {t('prescription.medicinesAdded', { count: medicines.length })}
              </p>
              <Button
                fullWidth
                onClick={handleSave}
                icon="save"
                disabled={medicines.length === 0}
                title={medicines.length === 0 ? t('prescription.addAtLeastOne') : undefined}
              >
                {t('prescription.savePrescription')}
              </Button>
              <Button
                fullWidth
                variant="secondary"
                onClick={handleDownload}
                icon="download"
                disabled={medicines.length === 0}
                title={medicines.length === 0 ? t('prescription.addAtLeastOne') : undefined}
              >
                {t('prescription.downloadPdf')}
              </Button>
              <Button
                fullWidth
                variant="outline"
                onClick={handlePrint}
                icon="print"
                disabled={medicines.length === 0}
                title={medicines.length === 0 ? t('prescription.addAtLeastOne') : undefined}
              >
                {t('common.print')}
              </Button>
            </div>
          </Card>
          <Card title={t('prescription.quickReference')} icon="tips_and_updates">
            <ul className="space-y-2 text-label-md text-on-surface-variant">
              <li>{t('prescription.quickRef1')}</li>
              <li>{t('prescription.quickRef2')}</li>
              <li>{t('prescription.quickRef3')}</li>
              <li>{t('prescription.quickRef4')}</li>
            </ul>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
