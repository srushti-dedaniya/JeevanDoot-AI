import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PatientSidebar from '../../components/layout/PatientSidebar';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { downloadReportPDF } from '../../utils/pdfUtils';
import { usePatient } from '../../hooks/usePatient';

const TYPE_META = {
  'Blood Test': { icon: 'bloodtype', color: 'bg-error-container text-on-error-container' },
  ECG: { icon: 'monitor_heart', color: 'bg-primary-fixed text-on-primary-fixed-variant' },
  'X-Ray': { icon: 'xray', color: 'bg-secondary-container text-on-secondary-container' },
  MRI: { icon: 'mri', color: 'bg-tertiary-fixed-dim text-tertiary' },
  'CT Scan': { icon: 'scan', color: 'bg-secondary-container text-on-secondary-container' },
};

const SAMPLE_REPORTS = [
  {
    id: 'RPT-BT-2025-0192',
    type: 'Blood Test',
    title: 'Complete Blood Count & Lipid Profile',
    date: '2025-11-10T08:30:00',
    facility: 'Amroli Primary Health Centre Lab',
    doctor: 'Dr. Rajesh Kumar',
    status: 'Completed',
    fields: [
      { name: 'Hemoglobin', value: '12.8', unit: 'g/dL', reference: '12.0 - 16.0', flag: 'Normal' },
      { name: 'WBC Count', value: '7,400', unit: '/µL', reference: '4,000 - 11,000', flag: 'Normal' },
      { name: 'Platelet Count', value: '2.4', unit: 'lakh/µL', reference: '1.5 - 4.5', flag: 'Normal' },
      { name: 'Total Cholesterol', value: '218', unit: 'mg/dL', reference: '< 200', flag: 'High' },
      { name: 'LDL Cholesterol', value: '142', unit: 'mg/dL', reference: '< 100', flag: 'High' },
      { name: 'HDL Cholesterol', value: '48', unit: 'mg/dL', reference: '> 40', flag: 'Normal' },
      { name: 'Triglycerides', value: '165', unit: 'mg/dL', reference: '< 150', flag: 'High' },
      { name: 'Fasting Glucose', value: '118', unit: 'mg/dL', reference: '70 - 110', flag: 'High' },
    ],
  },
  {
    id: 'RPT-ECG-2025-0041',
    type: 'ECG',
    title: '12-Lead Resting ECG',
    date: '2025-11-10T09:00:00',
    facility: 'Amroli Primary Health Centre',
    doctor: 'Dr. Anil Mehta',
    status: 'Completed',
    findings: [
      'Sinus rhythm at 78 bpm.',
      'No ST-segment or T-wave changes suggestive of ischemia.',
      'Occasional premature atrial complexes noted.',
    ],
    impression: 'Normal sinus rhythm with occasional premature atrial complexes; no acute ischemic changes.',
  },
  {
    id: 'RPT-XR-2025-0088',
    type: 'X-Ray',
    title: 'Chest X-Ray (PA View)',
    date: '2025-09-05T10:15:00',
    facility: 'District Health Centre, Palia',
    doctor: 'Dr. Rajesh Kumar',
    status: 'Completed',
    findings: [
      'Clear lung fields bilaterally.',
      'Cardiac silhouette within normal limits.',
      'No pleural effusion or pneumothorax.',
    ],
    impression: 'Normal chest radiograph.',
  },
  {
    id: 'RPT-MRI-2025-0024',
    type: 'MRI',
    title: 'MRI Brain (T1, T2, FLAIR)',
    date: '2025-07-15T14:30:00',
    facility: 'District Cardiology Center, Palia',
    doctor: 'Dr. Anil Mehta',
    status: 'Completed',
    findings: [
      'No focal mass lesion or midline shift.',
      'Ventricular system normal in size and position.',
      'Mild age-related cortical atrophy noted.',
    ],
    impression: 'Unremarkable MRI brain with mild age-related changes.',
  },
  {
    id: 'RPT-CT-2025-0013',
    type: 'CT Scan',
    title: 'CT Abdomen & Pelvis (Contrast)',
    date: '2025-04-20T11:45:00',
    facility: 'District Health Centre, Palia',
    doctor: 'Dr. Sunita Patel',
    status: 'Completed',
    findings: [
      'Liver is normal in size with mild diffuse fatty infiltration.',
      'No biliary calculi or pancreatic duct dilatation.',
      'Kidneys and spleen appear unremarkable.',
    ],
    impression: 'Mild hepatic steatosis; no acute intra-abdominal pathology.',
  },
];

const FLAG_VARIANT = {
  Normal: 'success',
  High: 'warning',
  Low: 'warning',
  Critical: 'critical',
};

const FLAG_LABEL_KEY = {
  Normal: 'flagNormal',
  High: 'flagHigh',
  Low: 'flagLow',
  Critical: 'flagCritical',
};

export default function Reports() {
  const { t } = useTranslation();
  const { patient } = usePatient();
  const [selected, setSelected] = useState(null);

  const handleView = (report) => setSelected(report);

  const handleDownload = (report) => {
    downloadReportPDF({ ...report, patientId: patient.patientId, patientName: patient.name });
    toast.success(t('patient.reports.pdfDownloaded'));
  };

  const statusLabel = (status) => (status === 'Completed' ? t('common.completed') : t('common.pending'));

  return (
    <DashboardLayout
      sidebar={<PatientSidebar />}
      headerProps={{ title: t('patient.reports.title'), subtitle: t('patient.reports.subtitle') }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {SAMPLE_REPORTS.map((report) => {
          const meta = TYPE_META[report.type] ?? { icon: 'description', color: 'bg-surface-container-high text-on-surface-variant' };
          return (
            <Card key={report.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <span className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center ${meta.color}`}>
                  <span className="material-symbols-outlined text-[28px]">{meta.icon}</span>
                </span>
                <Badge variant="success">{statusLabel(report.status)}</Badge>
              </div>

              <h3 className="font-headline text-title-md font-bold text-on-surface mt-4">{report.title}</h3>
              <p className="text-label-md text-on-surface-variant mt-0.5">{report.type}</p>

              <div className="mt-4 space-y-2 text-label-md">
                <p className="text-on-surface-variant flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-lg shrink-0">calendar_month</span>
                  {new Date(report.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <p className="text-on-surface-variant flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-lg shrink-0">local_hospital</span>
                  {report.facility}
                </p>
                <p className="text-on-surface-variant flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-lg shrink-0">person</span>
                  {report.doctor}
                </p>
              </div>

              <div className="mt-auto pt-5 flex flex-row gap-3">
                <Button variant="outline" icon="visibility" fullWidth onClick={() => handleView(report)}>
                  {t('common.view')}
                </Button>
                <Button variant="secondary" icon="download" fullWidth onClick={() => handleDownload(report)}>
                  {t('common.download')}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? selected.title : t('patient.reports.report')}
        icon="description"
        size="lg"
        footer={
          selected && (
            <Button icon="download" onClick={() => handleDownload(selected)}>
              {t('patient.reports.downloadPdf')}
            </Button>
          )
        }
      >
        {selected && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-surface-container-low rounded-lg p-4">
              <div>
                <p className="font-headline text-title-md font-bold text-on-surface">
                  {t('patient.reports.reportType', { type: selected.type })}
                </p>
                <p className="text-on-surface-variant text-label-md">
                  {selected.id} · {new Date(selected.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <Badge variant="success">{statusLabel(selected.status)}</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-surface-container-low rounded-lg p-4">
                <p className="text-label-md text-on-surface-variant">{t('patient.reports.facility')}</p>
                <p className="font-bold text-on-surface">{selected.facility}</p>
              </div>
              <div className="bg-surface-container-low rounded-lg p-4">
                <p className="text-label-md text-on-surface-variant">{t('patient.reports.authorizedBy')}</p>
                <p className="font-bold text-on-surface">{selected.doctor}</p>
              </div>
            </div>

            {selected.fields && selected.fields.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-primary text-on-primary">
                      <th className="px-4 py-3 font-headline font-semibold">{t('patient.reports.test')}</th>
                      <th className="px-4 py-3 font-headline font-semibold">{t('patient.reports.result')}</th>
                      <th className="px-4 py-3 font-headline font-semibold">{t('patient.reports.reference')}</th>
                      <th className="px-4 py-3 font-headline font-semibold">{t('patient.reports.flag')}</th>
                    </tr>
                  </thead>
                  <tbody className="text-on-surface">
                    {selected.fields.map((field, index) => (
                      <tr key={field.name} className={`border-b border-outline-variant ${index % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface-container-low'}`}>
                        <td className="px-4 py-3 font-bold">{field.name}</td>
                        <td className="px-4 py-3">{field.value} {field.unit}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{field.reference}</td>
                        <td className="px-4 py-3">
                          <Badge variant={FLAG_VARIANT[field.flag] ?? 'neutral'}>
                            {t(`patient.reports.${FLAG_LABEL_KEY[field.flag]}`)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selected.findings && selected.findings.length > 0 && (
              <div>
                <p className="font-bold text-on-surface mb-2">{t('patient.reports.findings')}</p>
                <ul className="space-y-1.5 text-on-surface-variant">
                  {selected.findings.map((finding, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-primary text-lg shrink-0">check_circle</span>
                      {finding}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selected.impression && (
              <div className="bg-primary-container rounded-lg p-4">
                <p className="font-bold text-on-primary-container mb-1">{t('patient.reports.impression')}</p>
                <p className="text-sm text-on-primary-container">{selected.impression}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
