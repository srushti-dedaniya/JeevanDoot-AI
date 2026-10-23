/**
 * Care Continuity Controller (Feature 3 - Phase 2).
 *
 * GET /api/v1/patients/:id/continuity
 * Returns care continuity insights for the specified patient.
 *
 * Authorization:
 * - Patients: own continuity insights only
 * - Doctors: patients they are authorized to treat
 * - Admin: all patients
 * - NGO/Government: denied (no individual clinical access)
 */

import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { success } from '../utils/response.js';
import { Patient } from '../models/index.js';
import { evaluateContinuityRules } from '../services/continuity.service.js';
import { ROLES } from '../models/User.js';

/**
 * GET /api/v1/patients/:id/continuity
 * Query: { page, limit }
 *
 * Returns care continuity insights for the specified patient.
 */
export const getContinuityInsights = async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 20 } = req.query;

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
  const isDoctor = user.role === 'doctor';
  const isAdmin = user.role === 'admin';

  if (!isOwner && !isDoctor && !isAdmin) {
    throw new ApiError(403, 'You do not have permission to view this care continuity.');
  }

  // Doctor authorization: verify doctor has access to this patient
  if (!isOwner && !isAdmin) {
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
      throw new ApiError(403, 'You are not authorized to view this patient\'s continuity insights.');
    }
  }

  // Pagination
  const pageNum = Math.max(1, Number(req.query.page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const start = (pageNum - 1) * limitNum;
  const paginated = insights.slice(start, start + limitNum);

  return success(res, {
    insights: paginated,
    meta: {
      page: pageNum,
      limit: limitNum,
      total: insights.length,
      totalPages: Math.ceil(insights.length / limitNum),
    },
  });
};

export const continuityController = { getContinuityInsights };
export default { getContinuityInsights };