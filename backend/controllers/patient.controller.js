import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { success, created, noContent } from '../utils/response.js';
import {
  Patient,
  User,
  Appointment,
  Prescription,
  Consultation,
  MedicalReport,
} from '../models/index.js';

const PUBLIC_FIELDS =
  'patientId personalInfo emergencyContact vitals bloodGroup height allergies medicalHistory vaccinationHistory queue';

/**
 * GET /patients
 * Role: admin, doctor, ngo, government
 * Query: { search, risk, status, village, page, limit }
 */
export const getPatients = asyncHandler(async (req, res) => {
  const { search, risk, status, village, page = 1, limit = 20 } = req.query;

  const query = {};
  if (risk) query['queue.risk'] = risk;
  if (status) query['queue.status'] = status;
  if (village) query['personalInfo.village'] = village;
  if (search) {
    query.$or = [
      { patientId: { $regex: search, $options: 'i' } },
      { 'personalInfo.fullName': { $regex: search, $options: 'i' } },
      { 'personalInfo.phone': { $regex: search, $options: 'i' } },
    ];
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    Patient.find(query)
      .select(PUBLIC_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Patient.countDocuments(query),
  ]);

  return success(
    res,
    items,
    { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
  );
});

/**
 * GET /patients/:id
 */
export const getPatientById = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.id).select(PUBLIC_FIELDS).lean();
  if (!patient) throw new ApiError(404, 'Patient not found.');
  return success(res, patient);
});

/**
 * GET /patients/me  (the logged-in patient's own profile)
 */
export const getMyProfile = asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ user: req.user._id }).select(PUBLIC_FIELDS).lean();
  if (!patient) throw new ApiError(404, 'Patient profile not found.');
  return success(res, patient);
});

/**
 * GET /patients/me/appointments
 */
export const getMyAppointments = asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ user: req.user._id }).lean();
  if (!patient) throw new ApiError(404, 'Patient profile not found.');

  const { status, page = 1, limit = 20 } = req.query;
  const query = { patient: patient._id };
  if (status) query.status = status;

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

  const [items, total] = await Promise.all([
    Appointment.find(query)
      .sort({ date: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('doctor', 'name specialization')
      .lean(),
    Appointment.countDocuments(query),
  ]);

  return success(
    res,
    items,
    { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
  );
});

/**
 * GET /patients/me/prescriptions
 */
export const getMyPrescriptions = asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ user: req.user._id }).lean();
  if (!patient) throw new ApiError(404, 'Patient profile not found.');

  const prescriptions = await Prescription.find({ patient: patient._id })
    .sort({ issuedAt: -1 })
    .populate('doctor', 'name specialization')
    .lean();
  return success(res, prescriptions);
});

/**
 * GET /patients/me/consultations
 */
export const getMyConsultations = asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ user: req.user._id }).lean();
  if (!patient) throw new ApiError(404, 'Patient profile not found.');

  const consultations = await Consultation.find({ patient: patient._id })
    .sort({ startedAt: -1 })
    .populate('doctor', 'name specialization')
    .lean();
  return success(res, consultations);
});

/**
 * GET /patients/me/reports
 */
export const getMyReports = asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ user: req.user._id }).lean();
  if (!patient) throw new ApiError(404, 'Patient profile not found.');

  const reports = await MedicalReport.find({ patient: patient._id })
    .sort({ date: -1 })
    .populate('doctor', 'name specialization')
    .lean();
  return success(res, reports);
});

/**
 * POST /patients
 * Body: { user: <userId>, personalInfo, emergencyContact, ... }
 */
export const createPatient = asyncHandler(async (req, res) => {
  const { user, ...data } = req.body || {};
  if (!user) {
    throw new ApiError(400, 'Patient requires a linked user id.');
  }

  const existing = await Patient.findOne({ user });
  if (existing) throw new ApiError(409, 'A patient profile already exists for this user.');

  const patient = await Patient.create({ user, ...data });
  return created(res, patient);
});

/**
 * PUT /patients/:id
 */
export const updatePatient = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  if (!patient) throw new ApiError(404, 'Patient not found.');

  const { user, ...updates } = req.body || {};
  Object.assign(patient, updates);
  await patient.save();

  return success(res, patient);
});

/**
 * PUT /patients/me  (own profile update)
 */
export const updateMyProfile = asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ user: req.user._id });
  if (!patient) throw new ApiError(404, 'Patient profile not found.');

  const { user, ...updates } = req.body || {};
  Object.assign(patient, updates);
  await patient.save();

  return success(res, patient);
});

/**
 * DELETE /patients/:id
 */
export const deletePatient = asyncHandler(async (req, res) => {
  const patient = await Patient.findByIdAndDelete(req.params.id);
  if (!patient) throw new ApiError(404, 'Patient not found.');

  // Clean up linked user (keeps the DB tidy for admin deletion flows).
  await User.findByIdAndDelete(patient.user);
  return noContent(res);
});

export const patientController = {
  getPatients,
  getPatientById,
  getMyProfile,
  getMyAppointments,
  getMyPrescriptions,
  getMyConsultations,
  getMyReports,
  createPatient,
  updatePatient,
  updateMyProfile,
  deletePatient,
};

export default patientController;
