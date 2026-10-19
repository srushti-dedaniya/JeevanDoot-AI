import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PatientSidebar from '../../components/layout/PatientSidebar';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import ConsultationSummary from '../../components/consultation/ConsultationSummary';
import { downloadConsultationSummaryPDF } from '../../utils/pdfUtils';
import { formatDateTime } from '../../utils/formatDate';
import { usePatient } from '../../hooks/usePatient';

const STATUS_BADGE = {
  Completed: 'success',
  'Follow-up': 'warning',
  Reviewed: 'neutral',
};

const STATUS_LABEL_KEY = {
  Completed: 'statusCompleted',
  'Follow-up': 'statusFollowUp',
  Reviewed: 'statusReviewed',
};

const DUMMY_CONSULTATIONS = [
  {
    consultationId: 'CS-2025-0118',
    doctorId: 'DR-1024',
    doctorName: 'Dr. Rajesh Kumar',
    specialization: 'General Physician',
    date: '2025-11-12T10:30:00',
    duration: 1740,
    complaint: 'Persistent headache and fatigue since last week. Occasional dizziness on standing.',
    diagnosis: 'Hypertension (Stage 1) & GERD',
    vitals: { bp: '138/86', pulse: 84, temp: '98.4', spo2: 97 },
    medicines: [
      { id: 'rx-1', medicineName: 'Amlodipine 5mg', dosage: '1 tablet', frequency: 'Once daily', duration: '30', schedule: { morning: true } },
      { id: 'rx-2', medicineName: 'Omeprazole 20mg', dosage: '1 capsule', frequency: 'Once daily', duration: '15', schedule: { morning: true } },
    ],
    scribeSections: [
      { id: 'historyOfPresentIllness', title: 'History of Present Illness', icon: 'history', content: 'Headache localized to occipital region, worse in the morning. Reflux after heavy meals, relieved by antacids.' },
      { id: 'symptoms', title: 'Symptoms', icon: 'monitor_heart', content: 'Dizziness on standing, post-meal acidity, occasional palpitations.' },
      { id: 'assessment', title: 'Assessment', icon: 'fact_check', content: 'Blood pressure elevated on repeated measurement. GERD consistent with symptom pattern.' },
      { id: 'plan', title: 'Plan', icon: 'assignment_turned_in', content: 'Start Amlodipine 5mg and Omeprazole 20mg. Home BP monitoring twice daily.' },
    ],
    advice: 'Reduce salt intake, avoid oily and spicy food. Walk 30 minutes daily. Monitor blood pressure weekly.',
    notes: 'Patient counselled on lifestyle modification. Follow-up in 1 month with BP log.',
    status: 'Completed',
  },
  {
    consultationId: 'CS-2025-0087',
    doctorId: 'DR-1102',
    doctorName: 'Dr. Sunita Patel',
    specialization: 'Endocrinologist',
    date: '2025-09-28T11:00:00',
    duration: 2100,
    complaint: 'Fatigue, increased thirst and frequent urination over the past month.',
    diagnosis: 'Type 2 Diabetes — Uncontrolled',
    vitals: { bp: '128/80', pulse: 90, temp: '98.2', spo2: 98 },
    medicines: [
      { id: 'rx-3', medicineName: 'Metformin 500mg', dosage: '1 tablet', frequency: 'Twice daily', duration: '90', schedule: { morning: true, night: true } },
    ],
    scribeSections: [
      { id: 'historyOfPresentIllness', title: 'History of Present Illness', icon: 'history', content: 'Polyuria and polydipsia progressively increased. HbA1c reported at 8.9% at last lab visit.' },
      { id: 'assessment', title: 'Assessment', icon: 'fact_check', content: 'Glycemic control inadequate on current single-agent therapy.' },
      { id: 'followUp', title: 'Follow-up Recommendation', icon: 'event_repeat', content: 'Recheck HbA1c after 3 months. Review diet and medication compliance.' },
    ],
    advice: 'Follow a diabetic diet chart. Check fasting blood sugar every morning. Maintain foot care.',
    notes: 'Referral made to community nutritionist for diet counselling.',
    status: 'Follow-up',
  },
  {
    consultationId: 'CS-2025-0054',
    doctorId: 'DR-1507',
    doctorName: 'Dr. Anil Mehta',
    specialization: 'Cardiologist',
    date: '2025-07-02T14:00:00',
    duration: 2400,
    complaint: 'Chest discomfort on exertion, subsides with rest. History of hypertension.',
    diagnosis: 'Stable Angina — Monitor',
    vitals: { bp: '142/88', pulse: 88, temp: '98.6', spo2: 95 },
    medicines: [
      { id: 'rx-4', medicineName: 'Aspirin 75mg', dosage: '1 tablet', frequency: 'Once daily', duration: '30', schedule: { morning: true } },
      { id: 'rx-5', medicineName: 'Atorvastatin 20mg', dosage: '1 tablet', frequency: 'Once at night', duration: '30', schedule: { night: true } },
    ],
    scribeSections: [
      { id: 'symptoms', title: 'Symptoms', icon: 'monitor_heart', content: 'Retrosternal burning on brisk walking, relieved by rest in 3-4 minutes.' },
      { id: 'assessment', title: 'Assessment', icon: 'fact_check', content: 'ECG shows non-specific ST-T changes. Stable pattern currently, needs close monitoring.' },
      { id: 'plan', title: 'Plan', icon: 'assignment_turned_in', content: 'Start Aspirin and statin. Stress test to be scheduled.' },
    ],
    advice: 'Avoid strenuous activity. Carry emergency contact card. Report worsening chest pain immediately.',
    notes: 'Stress test appointment arranged at District Cardiology Center.',
    status: 'Completed',
  },
  {
    consultationId: 'CS-2025-0021',
    doctorId: 'DR-1024',
    doctorName: 'Dr. Rajesh Kumar',
    specialization: 'General Physician',
    date: '2025-04-15T09:15:00',
    duration: 1200,
    complaint: 'General health checkup. Annual screening request.',
    diagnosis: 'Routine Health Screening',
    vitals: { bp: '126/78', pulse: 76, temp: '98.2', spo2: 98 },
    medicines: [],
    scribeSections: [
      { id: 'chiefComplaint', title: 'Chief Complaint', icon: 'sick', content: 'No acute complaints. Annual preventive health screening.' },
      { id: 'assessment', title: 'Assessment', icon: 'fact_check', content: 'Within normal limits on examination. Laboratory workup ordered.' },
    ],
    advice: 'Results will be reviewed at the next visit. Maintain regular exercise and balanced diet.',
    notes: 'Blood work and lipid profile advised.',
    status: 'Reviewed',
  },
];

export default function ConsultationHistory() {
  const { t } = useTranslation();
  const { patient } = usePatient();
  const [selected, setSelected] = useState(null);

  const consultations = useMemo(
    () =>
      DUMMY_CONSULTATIONS.map((c) => ({
        ...c,
        patientId: patient.patientId,
        patientName: patient.name,
        patientAge: patient.age,
        patientGender: patient.gender,
        patientVillage: patient.village,
      })),
    [patient]
  );

  const handleView = (row) => setSelected(row);

  const handleDownload = (row) => {
    downloadConsultationSummaryPDF(row);
    toast.success(t('patient.consultations.summaryPdfDownloaded'));
  };

  const columns = [
    {
      key: 'doctorName',
      header: t('patient.consultations.doctor'),
      render: (row) => (
        <div>
          <p className="font-bold text-on-surface">{row.doctorName}</p>
          <p className="text-label-sm text-on-surface-variant">{row.specialization}</p>
        </div>
      ),
    },
    {
      key: 'date',
      header: t('common.date'),
      render: (row) => (
        <div>
          <p className="font-bold text-on-surface">{formatDateTime(row.date, 'MMM d, yyyy')}</p>
          <p className="text-label-sm text-on-surface-variant">{formatDateTime(row.date, 'h:mm a')}</p>
        </div>
      ),
    },
    {
      key: 'diagnosis',
      header: t('common.diagnosis'),
      render: (row) => (
        <Badge variant="primary">{row.diagnosis}</Badge>
      ),
    },
    {
      key: 'prescription',
      header: t('patient.consultations.prescription'),
      render: (row) =>
        row.medicines.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container font-bold text-label-md">
            <span className="material-symbols-outlined text-[16px]">medication</span>
            {t('patient.consultations.medicineCount', { count: row.medicines.length })}
          </span>
        ) : (
          <span className="text-on-surface-variant">—</span>
        ),
    },
    {
      key: 'summary',
      header: t('patient.consultations.summary'),
      render: (row) => (
        <p className="text-on-surface-variant max-w-xs truncate" title={row.complaint}>
          {row.complaint}
        </p>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'neutral'}>
          {t(`patient.consultations.${STATUS_LABEL_KEY[row.status]}`)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleView(row)}
            className="p-2 rounded-full text-primary hover:bg-primary-container/30 transition-colors"
            title={t('patient.consultations.viewSummary')}
            aria-label={t('patient.consultations.viewSummaryAria', { id: row.consultationId })}
          >
            <span className="material-symbols-outlined text-lg">visibility</span>
          </button>
          <button
            type="button"
            onClick={() => handleDownload(row)}
            className="p-2 rounded-full text-primary hover:bg-primary-container/30 transition-colors"
            title={t('patient.consultations.downloadPdf')}
            aria-label={t('patient.consultations.downloadAria', { id: row.consultationId })}
          >
            <span className="material-symbols-outlined text-lg">download</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout
      sidebar={<PatientSidebar />}
      headerProps={{ title: t('patient.consultations.title'), subtitle: t('patient.consultations.subtitle') }}
    >
      <Card
        title={t('patient.consultations.pastConsultations')}
        icon="video_library"
        subtitle={t(
          consultations.length === 1 ? 'patient.consultations.onRecordOne' : 'patient.consultations.onRecordMany',
          { count: consultations.length }
        )}
      >
        <Table
          columns={columns}
          data={consultations}
          rowKey="consultationId"
          emptyState={
            <div className="text-center py-14">
              <span className="material-symbols-outlined text-5xl text-outline">video_library</span>
              <p className="font-bold text-on-surface mt-3">{t('patient.consultations.noneYet')}</p>
              <p className="text-on-surface-variant text-label-md mt-1">
                {t('patient.consultations.willAppearHere')}
              </p>
            </div>
          }
        />
      </Card>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={t('patient.consultations.consultationSummary')}
        icon="fact_check"
        size="lg"
      >
        {selected && (
          <ConsultationSummary
            summary={selected}
            onDownload={() => handleDownload(selected)}
            onClose={() => setSelected(null)}
          />
        )}
      </Modal>
    </DashboardLayout>
  );
}
