import { cx } from '../../utils/helpers';
import { formatDateTime, formatDuration } from '../../utils/formatDate';
import { SCRIBE_SECTIONS } from '../../utils/transcriptUtils';
import Badge from '../common/Badge';
import Button from '../common/Button';

/**
 * ConsultationSummary - human-readable view of a completed consultation.
 * Props:
 *  - summary: object produced by generateSummary / saved consultation
 *  - onDownload, onPrescription, onClose: action callbacks
 */
export default function ConsultationSummary({
  summary,
  onDownload,
  onPrescription,
  onClose,
  showActions = true,
}) {
  if (!summary) return null;

  const initials = (summary.patientName || 'P')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const vitals = summary.vitals || {};
  const vitalsChips = [
    vitals.bp && { label: 'BP', value: vitals.bp },
    vitals.pulse && { label: 'Pulse', value: `${vitals.pulse} bpm` },
    vitals.temp && { label: 'Temp', value: `${vitals.temp}°F` },
    vitals.spo2 && { label: 'SpO2', value: `${vitals.spo2}%` },
  ].filter(Boolean);

  const medicines = Array.isArray(summary.medicines) ? summary.medicines : [];

  const sectionMeta = SCRIBE_SECTIONS.reduce((acc, section) => {
    acc[section.id] = section;
    return acc;
  }, {});

  const sections = Array.isArray(summary.scribeSections)
    ? summary.scribeSections.filter((s) => String(s.content || '').trim())
    : [];

  const meta = [
    { label: 'Consultation ID', value: summary.consultationId || '—' },
    { label: 'Date & Time', value: summary.date ? formatDateTime(summary.date) : '—' },
    { label: 'Duration', value: formatDuration(summary.duration || 0) },
    { label: 'Doctor', value: summary.doctorName || '—' },
    { label: 'Village', value: summary.patientVillage || '—' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center font-headline text-2xl font-bold">
            {initials}
          </div>
          <div>
            <p className="font-headline text-headline-md font-bold text-on-surface">
              {summary.patientName}
            </p>
            <p className="text-on-surface-variant text-label-md">
              {summary.patientId}
              {summary.patientAge && ` · ${summary.patientAge} yrs`}
              {summary.patientGender && ` · ${summary.patientGender}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <Badge variant="primary" icon="fact_check">Consultation Completed</Badge>
          {summary.diagnosis && (
            <p className="text-label-md text-primary font-bold mt-2">{summary.diagnosis}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {meta.map((item) => (
          <div key={item.label} className="bg-surface-container-low rounded-lg px-4 py-3">
            <p className="text-label-sm text-on-surface-variant">{item.label}</p>
            <p className="font-bold text-on-surface truncate" title={item.value}>{item.value}</p>
          </div>
        ))}
      </div>

      {summary.complaint && (
        <div>
          <p className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wide mb-1">Complaint</p>
          <p className="text-on-surface font-medium">{summary.complaint}</p>
        </div>
      )}

      {vitalsChips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {vitalsChips.map((chip) => (
            <span
              key={chip.label}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low border border-outline-variant"
            >
              <span className="text-label-sm text-on-surface-variant">{chip.label}</span>
              <span className="font-bold text-on-surface">{chip.value}</span>
            </span>
          ))}
        </div>
      )}

      {medicines.length > 0 && (
        <div>
          <p className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wide mb-2">
            Medicines Recommended ({medicines.length})
          </p>
          <div className="overflow-hidden rounded-lg border border-outline-variant">
            {medicines.map((med, i) => (
              <div
                key={med.id || i}
                className={cx(
                  'px-4 py-3 flex items-center justify-between gap-4',
                  i % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface-container-low'
                )}
              >
                <div>
                  <p className="font-bold text-on-surface">{med.medicineName || med.name || '—'}</p>
                  <p className="text-label-sm text-on-surface-variant">
                    {med.dosage || '—'} · {med.frequency || '—'}
                    {med.duration ? ` · ${med.duration} days` : ''}
                  </p>
                </div>
                <span className="material-symbols-outlined text-primary">medication</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {sections.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sections.map((section) => {
            const metaInfo = sectionMeta[section.id] || {};
            return (
              <div key={section.id} className="bg-surface-container-low rounded-lg p-4">
                <p className="flex items-center gap-2 text-label-md font-bold text-primary uppercase tracking-wide mb-1">
                  {metaInfo.icon && (
                    <span className="material-symbols-outlined text-base">{metaInfo.icon}</span>
                  )}
                  {section.title || metaInfo.title || section.id}
                </p>
                <p className="text-on-surface text-body-md leading-relaxed">{section.content}</p>
              </div>
            );
          })}
        </div>
      )}

      {summary.advice && (
        <div>
          <p className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wide mb-1">Advice</p>
          <p className="text-on-surface leading-relaxed">{summary.advice}</p>
        </div>
      )}

      {summary.notes && (
        <div>
          <p className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wide mb-1">Doctor Notes</p>
          <p className="text-on-surface leading-relaxed whitespace-pre-line">{summary.notes}</p>
        </div>
      )}

      {showActions && (
        <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-outline-variant">
          {onClose && (
            <Button variant="outline" icon="close" onClick={onClose}>
              Close
            </Button>
          )}
          {onDownload && (
            <Button variant="secondary" icon="download" onClick={onDownload}>
              Download PDF
            </Button>
          )}
          {onPrescription && (
            <Button icon="prescriptions" onClick={onPrescription}>
              Generate Prescription
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
