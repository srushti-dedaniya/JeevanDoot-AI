/**
 * Care Timeline Aggregation Service (Feature 3 - Phase 3A).
 *
 * Aggregates patient care events from multiple domain models into a unified,
 * chronologically sorted timeline. Reads existing records only — never creates
 * or duplicates clinical data.
 */

import ApiError from '../utils/ApiError.js';
import {
  Appointment,
  Referral,
  Prescription,
  Consultation,
  MedicalReport,
  Patient,
} from '../models/index.js';

/**
 * Normalizes an Appointment into a timeline event.
 */
const mapAppointment = (appt) => {
  const occurredAt = appt.date
    ? new Date(appt.date).toISOString().slice(0, 10)
    : null;
  const time = appt.startTime || '';
  const datetime = occurredAt && time
    ? `${occurredAt}T${time}:00.000Z`
    : occurredAt || appt.createdAt;

  return {
    id: `appt-${appt.id}`,
    type: 'appointment',
    title: appt.purpose && appt.purpose !== 'general'
      ? `Appointment: ${appt.purpose}`
      : 'Appointment',
    description: appt.doctor?.name
      ? `With ${appt.doctor.name}${appt.doctor.specialization ? ` (${appt.doctor.specialization})` : ''}`
      : appt.notes || null,
    occurredAt: datetime,
    status: appt.status,
    sourceId: appt.id,
    metadata: {
      doctor: appt.doctor
        ? { id: appt.doctor.id || appt.doctor._id, name: appt.doctor.name, specialization: appt.doctor.specialization }
        : null,
      patientId: appt.patient?.id || appt.patient?._id || appt.patient,
      startTime: appt.startTime,
      endTime: appt.endTime || null,
      purpose: appt.purpose,
      notes: appt.notes || null,
    },
  };
};

/**
 * Normalizes a Referral into a timeline event.
 */
const mapReferral = (ref) => {
  const occurredAt = ref.createdAt || ref.respondedAt || ref.updatedAt;
  return {
    id: `ref-${ref.id}`,
    type: 'referral',
    title: ref.reason
      ? `Referral: ${ref.reason}`
      : `Referral to ${REFERRAL_DESTINATIONS.find(d => d.code === ref.destination)?.label || ref.destination}`,
    description: ref.notes
      ? `${ref.notes}${ref.responseNotes ? ` — Response: ${ref.responseNotes}` : ''}`
      : ref.responseNotes || null,
    occurredAt: occurredAt ? new Date(occurredAt).toISOString() : null,
    status: ref.status,
    sourceId: ref.referralId || ref.id,
    metadata: {
      referralId: ref.referralId,
      destination: ref.destination,
      priority: ref.priority,
      reason: ref.reason,
      notes: ref.notes,
      respondedAt: ref.respondedAt,
      responseNotes: ref.responseNotes,
      doctor: ref.doctor
        ? { id: ref.doctor.id || ref.doctor._id, name: ref.doctor.name, specialization: ref.doctor.specialization }
        : null,
      patientId: ref.patient?.id || ref.patient?._id || ref.patient,
    },
  };
};

const REFERRAL_DESTINATIONS = [
  { code: 'agh', label: 'District Hospital (AGH)' },
  { code: 'dcc', label: 'Community Health Centre (DCC)' },
  { code: 'drr', label: 'District Referral Centre (DRR)' },
];

/**
 * Normalizes a Prescription into a timeline event.
 */
const mapPrescription = (rx) => {
  const occurredAt = rx.issuedAt || rx.createdAt;
  const medicineSummary = rx.medicines?.length
    ? rx.medicines.slice(0, 3).map(m => m.medicineName).join(', ') + (rx.medicines.length > 3 ? ` +${rx.medicines.length - 3} more` : '')
    : null;

  return {
    id: `rx-${rx.id}`,
    type: 'prescription',
    title: rx.diagnosis
      ? `Prescription: ${rx.diagnosis}`
      : 'Prescription',
    description: [
      medicineSummary,
      rx.advice || null,
    ].filter(Boolean).join(' — ') || null,
    occurredAt: occurredAt ? new Date(occurredAt).toISOString() : null,
    status: rx.status,
    sourceId: rx.prescriptionId || rx.id,
    metadata: {
      prescriptionId: rx.prescriptionId,
      doctor: rx.doctor
        ? { id: rx.doctor.id || rx.doctor._id, name: rx.doctor.name, specialization: rx.doctor.specialization }
        : null,
      patientId: rx.patient?.id || rx.patient?._id || rx.patient,
      diagnosis: rx.diagnosis,
      advice: rx.advice,
      medicines: rx.medicines?.map(m => ({
        name: m.medicineName,
        dosage: m.dosage,
        frequency: m.frequency,
        duration: m.duration,
        schedule: m.schedule,
      })) || [],
    },
  };
};

/**
 * Normalizes a Consultation into a timeline event.
 */
const mapConsultation = (cons) => {
  const occurredAt = cons.startedAt || cons.createdAt;
  return {
    id: `cons-${cons.id}`,
    type: 'consultation',
    title: cons.complaint
      ? `Consultation: ${cons.complaint}`
      : 'Consultation',
    description: cons.diagnosis || cons.advice || null,
    occurredAt: occurredAt ? new Date(occurredAt).toISOString() : null,
    status: cons.status,
    sourceId: cons.sessionId || cons.id,
    metadata: {
      sessionId: cons.sessionId,
      doctor: cons.doctor
        ? { id: cons.doctor.id || cons.doctor._id, name: cons.doctor.name, specialization: cons.doctor.specialization }
        : null,
      patientId: cons.patient?.id || cons.patient?._id || cons.patient,
      diagnosis: cons.diagnosis,
      advice: cons.advice,
      complaint: cons.complaint,
      // Explicitly omit transcript, recordingUrl, scribeSections, detailed notes
    },
  };
};

/**
 * Normalizes a MedicalReport into a timeline event.
 */
const mapMedicalReport = (report) => {
  const occurredAt = report.date || report.createdAt;
  const flaggedFields = report.fields?.filter(f => f.flag && f.flag !== 'normal').length || 0;
  return {
    id: `report-${report.id}`,
    type: 'medical_report',
    title: report.title || 'Medical Report',
    description: [
      report.type && `Type: ${report.type}`,
      report.facility && `Facility: ${report.facility}`,
      report.impression || null,
      flaggedFields > 0 && `${flaggedFields} flagged value${flaggedFields > 1 ? 's' : ''}`,
    ].filter(Boolean).join(' — ') || null,
    occurredAt: occurredAt ? new Date(occurredAt).toISOString() : null,
    status: null,
    sourceId: report.reportId || report.id,
    metadata: {
      reportId: report.reportId,
      type: report.type,
      facility: report.facility,
      doctor: report.doctor
        ? { id: report.doctor.id || report.doctor._id, name: report.doctor.name, specialization: report.doctor.specialization }
        : null,
      patientId: report.patient?.id || report.patient?._id || report.patient,
      flaggedCount: flaggedFields,
      // Explicitly omit fields array, findings, impression, filePath
    },
  };
};

/**
 * Builds a patient care timeline by aggregating events from all source models.
 *
 * @param {Object} options
 * @param {mongoose.Types.ObjectId|string} options.patientId - Target patient's ObjectId
 * @param {Object} [options.filters]
 * @param {string} [options.filters.from] - ISO date (YYYY-MM-DD), inclusive
 * @param {string} [options.filters.to] - ISO date (YYYY-MM-DD), inclusive
 * @param {number} [options.page=1] - Page number (1-indexed)
 * @param {number} [options.limit=20] - Items per page (max 100)
 * @returns {Promise<{ events: Array, meta: { page, limit, total, totalPages } }>}
 */
export const getPatientTimeline = async ({
  patientId,
  filters = {},
  page = 1,
  limit = 20,
} = {}) => {
  const { from, to } = filters;

  // Validate date formats
  const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  if (from && !DATE_RE.test(from)) {
    throw new ApiError(400, 'Invalid "from" date. Use YYYY-MM-DD.');
  }
  if (to && !DATE_RE.test(to)) {
    throw new ApiError(400, 'Invalid "to" date. Use YYYY-MM-DD.');
  }
  if (from && to && from > to) {
    throw new ApiError(400, '"from" date cannot be after "to" date.');
  }

  // Validate pagination
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

  // Verify patient exists
  const patient = await Patient.findById(patientId).lean();
  if (!patient) {
    throw new ApiError(404, 'Patient not found.');
  }

  // Build date query for models that have a reliable event date
  const buildDateQuery = () => {
    const query = {};
    if (from || to) {
      query.$gte = from ? new Date(from) : new Date('1900-01-01');
      query.$lte = to ? new Date(`${to}T23:59:59.999Z`) : new Date();
    }
    return Object.keys(query).length ? query : null;
  };

  const dateQuery = buildDateQuery();

  // Build base queries for each model
  const appointmentQuery = { patient: patientId };
  const referralQuery = { patient: patientId };
  const prescriptionQuery = { patient: patientId };
  const consultationQuery = { patient: patientId };
  const reportQuery = { patient: patientId };

  if (dateQuery) {
    appointmentQuery.date = dateQuery;
    referralQuery.createdAt = dateQuery;
    prescriptionQuery.issuedAt = dateQuery;
    consultationQuery.startedAt = dateQuery;
    reportQuery.date = dateQuery;
  }

  // Fetch all source records in parallel
  const [
    appointments,
    referrals,
    prescriptions,
    consultations,
    reports,
  ] = await Promise.all([
    Appointment.find(appointmentQuery)
      .sort({ date: -1, startTime: -1 })
      .populate('doctor', 'name specialization')
      .lean(),
    Referral.find(referralQuery)
      .sort({ createdAt: -1 })
      .populate('doctor', 'name specialization')
      .populate('patient', 'patientId')
      .lean(),
    Prescription.find(prescriptionQuery)
      .sort({ issuedAt: -1 })
      .populate('doctor', 'name specialization')
      .lean(),
    Consultation.find(consultationQuery)
      .sort({ startedAt: -1 })
      .populate('doctor', 'name specialization')
      .lean(),
    MedicalReport.find(reportQuery)
      .sort({ date: -1 })
      .populate('doctor', 'name specialization')
      .lean(),
  ]);

  // Map all records to unified timeline events
  const events = [
    ...appointments.map(mapAppointment),
    ...referrals.map(mapReferral),
    ...prescriptions.map(mapPrescription),
    ...consultations.map(mapConsultation),
    ...reports.map(mapMedicalReport),
  ];

  // Sort by occurredAt descending (most recent first), with stable tie-breaker
  events.sort((a, b) => {
    const dateA = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
    const dateB = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
    if (dateB !== dateA) return dateB - dateA;
    // Tie-breaker: use sourceId for stable ordering
    return String(a.sourceId).localeCompare(String(b.sourceId));
  });

  // Pagination
  const total = events.length;
  const totalPages = Math.ceil(total / limitNum) || 1;
  const start = (pageNum - 1) * limitNum;
  const paginated = events.slice(start, start + limitNum);

  return {
    events: paginated,
    meta: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages,
    },
  };
};

export default { getPatientTimeline };