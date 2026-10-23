/**
 * Care Timeline Controller (Feature 3 - Phase 3A).
 *
 * GET /api/v1/patients/:id/timeline
 * Returns a chronologically sorted, paginated timeline of care events
 * for the specified patient.
 */

import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { success } from '../utils/response.js';
import { getPatientTimeline } from '../services/timeline.service.js';

/**
 * GET /api/v1/patients/:id/timeline
 * Query: { from, to, page, limit }
 *
 * Returns a chronologically sorted, paginated timeline of care events.
 * Authorization:
 * - Patients: own timeline only (derived from authenticated user)
 * - Doctors: patients they are authorized to view
 * - Admin: all patients
 * - NGO/Government: denied (no individual clinical access)
 */
export const getTimeline = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { from, to, page = 1, limit = 20 } = req.query;

  // Validate patient ID format
  const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
  if (!OBJECT_ID_RE.test(id)) {
    throw new ApiError(400, 'Invalid patient ID.');
  }

  // Verify patient exists
  const patient = await Patient.findById(id).select('_id user').lean();
  if (!patient) {
    throw new ApiError(404, 'Patient not found.');
  }

  // Authorization checks
  const user = req.user;
  const isOwner = String(patient.user) === String(user._id);
  const isDoctor = user.role === ROLES.DOCTOR;
  const isAdmin = user.role === ROLES.ADMIN;

  if (!isOwner && !isDoctor && !isAdmin) {
    // NGO, Government, and other roles denied for individual clinical timelines
    throw new ApiError(403, 'You do not have permission to view this care timeline.');
  }

  // Doctor authorization: verify doctor has access to this patient
  if (isDoctor && !isOwner) {
    const { Doctor } = await import('../models/index.js');
    const doctor = await Doctor.findOne({ user: user._id }).lean();
    if (!doctor) {
      throw new ApiError(403, 'Doctor profile not found.');
    }

    // Check if doctor has an appointment/referral/consultation with this patient
    const { Appointment, Referral, Consultation, Prescription } = await import('../models/index.js');
    const [hasAppointment, hasReferral, hasConsultation, hasPrescription] = await Promise.all([
      Appointment.exists({ patient: id, doctor: doctor._id }),
      Referral.exists({ patient: id, doctor: doctor._id }),
      Consultation.exists({ patient: id, doctor: doctor._id }),
      Prescription.exists({ patient: id, doctor: doctor._id }),
    ]);

    if (!hasAppointment && !hasReferral && !hasConsultation && !hasPrescription) {
      throw new ApiError(403, 'You are not authorized to view this patient\'s timeline.');
    }
  }

  const fromDate = req.query.from;
  const toDate = req.query.to;

  if (fromDate && !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    throw new ApiError(400, 'Invalid "from" date. Use YYYY-MM-DD.');
  }
  if (toDate && !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    throw new ApiError(400, 'Invalid "to" date. Use YYYY-MM-DD.');
  }
  if (fromDate && toDate && fromDate > toDate) {
    throw new ApiError(400, '"from" date cannot be after "to" date.');
  }
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

  const result = await getPatientTimeline({
    patientId: id,
    filters: { from: fromDate, to: toDate },
    page: pageNum,
    limit: limitNum,
  });

  return success(res, result.events, result.meta);
});

export const timelineController = { getTimeline };
export default timelineController;