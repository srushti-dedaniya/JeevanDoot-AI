import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PatientSidebar from '../../components/layout/PatientSidebar';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { downloadPrescriptionPDF, printPrescription } from '../../utils/prescriptionUtils';
import { usePatient } from '../../hooks/usePatient';

const STATUS_BADGE = {
  Completed: 'success',
  Active: 'warning',
  Dispensed: 'neutral',
};

const STATUS_LABEL_KEY = {
  Completed: 'statusCompleted',
  Active: 'statusActive',
  Dispensed: 'statusDispensed',
};

const SAMPLE_PRESCRIPTIONS = [
  {
    id: 'RX-2025-0142',
    doctor: 'Dr. Rajesh Kumar',
    specialization: 'General Physician',
    hospital: 'Amroli Primary Health Centre',
    date: '12 Nov 2025',
    diagnosis: 'Hypertension (Stage 1) & GERD',
    status: 'Completed',
    advice:
      'Take medicines as prescribed. Reduce salt intake, avoid spicy and oily food. Walk 30 minutes daily and monitor blood pressure weekly.',
    medicines: [
      { name: 'Amlodipine 5mg', dosage: '1 tablet', frequency: 'Once daily', duration: '30 days', schedule: { morning: true } },
      { name: 'Omeprazole 20mg', dosage: '1 capsule', frequency: 'Once daily', duration: '15 days', schedule: { morning: true } },
    ],
  },
  {
    id: 'RX-2025-0098',
    doctor: 'Dr. Sunita Patel',
    specialization: 'Endocrinologist',
    hospital: 'District Health Centre, Palia',
    date: '28 Sep 2025',
    diagnosis: 'Type 2 Diabetes',
    status: 'Active',
    advice:
      'Maintain a diabetic diet and check fasting blood sugar every morning. Review in 3 months with recent HbA1c report.',
    medicines: [
      { name: 'Metformin 500mg', dosage: '1 tablet', frequency: 'Twice daily', duration: '90 days', schedule: { morning: true, night: true } },
    ],
  },
  {
    id: 'RX-2025-0071',
    doctor: 'Dr. Rajesh Kumar',
    specialization: 'General Physician',
    hospital: 'Amroli Primary Health Centre',
    date: '03 Jul 2025',
    diagnosis: 'Acute Gastritis',
    status: 'Dispensed',
    advice: 'Avoid tea, coffee and alcohol. Eat small frequent meals. Follow up if symptoms persist beyond a week.',
    medicines: [
      { name: 'Omeprazole 20mg', dosage: '1 capsule', frequency: 'Once daily', duration: '10 days', schedule: { morning: true } },
      { name: 'Antacid Suspension', dosage: '10 ml', frequency: 'After meals', duration: '10 days', schedule: { morning: true, afternoon: true, night: true } },
    ],
  },
];

const buildData = (rx, patient) => ({
  patientId: patient.patientId,
  patientName: patient.name,
  medicines: rx.medicines.map((med) => ({
    medicineName: med.name,
    dosage: med.dosage,
    frequency: med.frequency,
    duration: med.duration,
    schedule: med.schedule || {},
  })),
  diagnosis: rx.diagnosis,
  advice: rx.advice,
});

export default function Prescriptions() {
  const { t } = useTranslation();
  const { patient } = usePatient();
  const [selected, setSelected] = useState(null);

  const handleView = (rx) => setSelected(rx);

  const handleDownload = (rx) => {
    downloadPrescriptionPDF(buildData(rx, patient));
    toast.success(t('patient.prescriptions.pdfDownloaded'));
  };

  const handlePrint = (rx) => {
    printPrescription(buildData(rx, patient));
  };

  const statusLabel = (status) => t(`patient.prescriptions.${STATUS_LABEL_KEY[status]}`);

  const scheduleLabel = (schedule = {}) =>
    Object.entries(schedule)
      .filter(([, value]) => value)
      .map(([key]) => t(`patient.prescriptions.${key}`))
      .join(', ');

  return (
    <DashboardLayout
      sidebar={<PatientSidebar />}
      headerProps={{ title: t('patient.prescriptions.title'), subtitle: t('patient.prescriptions.subtitle') }}
    >
      <div className="space-y-6">
        {SAMPLE_PRESCRIPTIONS.map((rx) => (
          <Card key={rx.id}>
            <div className="flex flex-col lg:flex-row justify-between gap-6">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-headline text-headline-md font-bold text-on-surface">{rx.doctor}</h3>
                  <Badge variant={STATUS_BADGE[rx.status] ?? 'neutral'}>{statusLabel(rx.status)}</Badge>
                </div>
                <p className="text-on-surface-variant mt-0.5">
                  {rx.specialization} · {rx.hospital}
                </p>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-surface-container-low rounded-lg p-4">
                    <p className="text-label-md text-on-surface-variant">{t('common.date')}</p>
                    <p className="font-bold text-on-surface flex items-center gap-1.5 mt-1">
                      <span className="material-symbols-outlined text-primary text-lg">calendar_month</span>
                      {rx.date}
                    </p>
                  </div>
                  <div className="bg-surface-container-low rounded-lg p-4 sm:col-span-2">
                    <p className="text-label-md text-on-surface-variant">{t('common.diagnosis')}</p>
                    <p className="font-bold text-on-surface flex items-center gap-1.5 mt-1">
                      <span className="material-symbols-outlined text-primary text-lg">diagnosis</span>
                      {rx.diagnosis}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-label-md text-on-surface-variant mb-2">{t('patient.prescriptions.medicines')}</p>
                  <div className="flex flex-wrap gap-2">
                    {rx.medicines.map((med) => (
                      <span
                        key={med.name}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary-container text-on-secondary-container font-bold text-label-md"
                      >
                        <span className="material-symbols-outlined text-[16px]">medication</span>
                        {med.name} · {med.dosage} · {med.frequency}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-row lg:flex-col justify-end gap-3 lg:w-64 shrink-0">
                <Button variant="outline" icon="visibility" fullWidth onClick={() => handleView(rx)}>
                  {t('common.view')}
                </Button>
                <Button variant="secondary" icon="download" fullWidth onClick={() => handleDownload(rx)}>
                  {t('patient.prescriptions.downloadPdf')}
                </Button>
                <Button variant="subtle" icon="print" fullWidth onClick={() => handlePrint(rx)}>
                  {t('common.print')}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={
          selected
            ? t('patient.prescriptions.prescriptionTitle', { id: selected.id })
            : t('patient.prescriptions.prescription')
        }
        icon="medication"
        size="lg"
        footer={
          selected && (
            <>
              <Button variant="outline" icon="print" onClick={() => handlePrint(selected)}>
                {t('common.print')}
              </Button>
              <Button icon="download" onClick={() => handleDownload(selected)}>
                {t('patient.prescriptions.downloadPdf')}
              </Button>
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-surface-container-low rounded-lg p-4">
              <div>
                <p className="font-headline text-title-md font-bold text-on-surface">{selected.doctor}</p>
                <p className="text-on-surface-variant">{selected.specialization} · {selected.hospital}</p>
              </div>
              <Badge variant={STATUS_BADGE[selected.status] ?? 'neutral'}>{statusLabel(selected.status)}</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-surface-container-low rounded-lg p-4">
                <p className="text-label-md text-on-surface-variant">{t('patient.prescriptions.patient')}</p>
                <p className="font-bold text-on-surface">{patient.name} ({patient.patientId})</p>
              </div>
              <div className="bg-surface-container-low rounded-lg p-4">
                <p className="text-label-md text-on-surface-variant">{t('common.date')}</p>
                <p className="font-bold text-on-surface">{selected.date}</p>
              </div>
              <div className="bg-surface-container-low rounded-lg p-4 sm:col-span-2">
                <p className="text-label-md text-on-surface-variant">{t('common.diagnosis')}</p>
                <p className="font-bold text-on-surface">{selected.diagnosis}</p>
              </div>
            </div>

            <div>
              <p className="font-bold text-on-surface mb-3">{t('patient.prescriptions.medicines')}</p>
              <div className="space-y-2">
                {selected.medicines.map((med) => (
                  <div
                    key={med.name}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-surface-container-low rounded-lg p-4"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-on-surface flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-primary text-lg">medication</span>
                        {med.name}
                      </p>
                      <p className="text-label-md text-on-surface-variant mt-0.5">
                        {med.dosage} · {med.frequency} · {med.duration}
                      </p>
                    </div>
                    {med.schedule && Object.keys(med.schedule).length > 0 && (
                      <Badge variant="secondary" icon="schedule">{scheduleLabel(med.schedule)}</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {selected.advice && (
              <div className="bg-primary-container rounded-lg p-4">
                <p className="font-bold text-on-primary-container mb-1">{t('patient.prescriptions.advice')}</p>
                <p className="text-sm text-on-primary-container">{selected.advice}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
