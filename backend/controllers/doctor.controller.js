import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { success, created, noContent } from '../utils/response.js';
import { Doctor, Patient, Consultation } from '../models/index.js';
import { dashboardService } from '../services/dashboard.service.js';

/**
 * GET /doctor/dashboard
 * Role: doctor
 */
export const getDashboard = asyncHandler(async (req, res) => {
  let doctor = await Doctor.findOne({ user: req.user._id }).lean();
  if (!doctor) {
    doctor = await Doctor.create({
      user: req.user._id,
      name: req.user.name,
      email: req.user.email,
      specialization: 'General Medicine',
      availability: { status: 'online' },
    });
  }

  const [dashboard, queue, recent] = await Promise.all([
    dashboardService.buildDoctorDashboard({ doctorId: doctor._id }),
    Patient.find({ 'queue.status': { $in: ['waiting', 'inReview'] } })
      .sort({ 'queue.joinedAt': 1 })
      .limit(10)
      .populate('user', 'name')
      .lean(),
    Consultation.find({ doctor: doctor._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('patient', 'patientId')
      .lean(),
  ]);

  return success(res, {
    doctor,
    stats: dashboard.stats,
    queue: queue.map((p) => ({ id: p.patientId, name: p.user?.name, ...p.queue })),
    recentConsultations: recent,
  });
});

/**
 * GET /doctors
 * Role: admin, doctor, patient, ngo, government
 * Query: { specialization, status, search, page, limit }
 */
export const getDoctors = asyncHandler(async (req, res) => {
  const {
    specialization,
    status,
    search,
    page = 1,
    limit = 20,
  } = req.query;

  const query = {};
  if (specialization) query.specialization = specialization;
  if (status) query['availability.status'] = status;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { specialization: { $regex: search, $options: 'i' } },
      { doctorId: { $regex: search, $options: 'i' } },
    ];
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    Doctor.find(query).sort({ name: 1 }).skip(skip).limit(limitNum).lean(),
    Doctor.countDocuments(query),
  ]);

  return success(
    res,
    items,
    { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
  );
});

/**
 * GET /doctors/:id
 */
export const getDoctorById = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id)
    .populate('user', 'name email phone avatar')
    .lean();
  if (!doctor) throw new ApiError(404, 'Doctor not found.');
  return success(res, doctor);
});

/**
 * GET /doctors/:id/profile  (alias for the doctor's own profile)
 */
export const getMyProfile = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findOne({ user: req.user._id })
    .populate('user', 'name email phone avatar')
    .lean();
  if (!doctor) throw new ApiError(404, 'Doctor profile not found.');
  return success(res, doctor);
});

/**
 * POST /doctors
 * Body: { user: <userId>, name, specialization, hospital, experience, ... }
 */
export const createDoctor = asyncHandler(async (req, res) => {
  const { user, name, ...rest } = req.body || {};
  if (!user || !name) {
    throw new ApiError(400, 'Doctor requires a linked user id and name.');
  }

  const existing = await Doctor.findOne({ user });
  if (existing) throw new ApiError(409, 'A doctor profile already exists for this user.');

  const doctor = await Doctor.create({ user, name, ...rest });
  return created(res, doctor);
});

/**
 * PUT /doctors/:id
 * Updates profile fields; user's linked name can be updated too.
 */
export const updateDoctor = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id);
  if (!doctor) throw new ApiError(404, 'Doctor not found.');

  const { user, ...updates } = req.body || {};
  Object.assign(doctor, updates);
  await doctor.save();

  return success(res, doctor);
});

/**
 * POST /doctors/:id/toggle-status
 * Body: { status?: 'online'|'offline'|'busy' } — toggles if omitted.
 */
export const toggleDoctorStatus = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id);
  if (!doctor) throw new ApiError(404, 'Doctor not found.');

  const next =
    req.body?.status ||
    (doctor.availability.status === 'online' ? 'offline' : 'online');
  doctor.availability.status = next;
  await doctor.save();

  return success(res, { id: doctor._id, availability: doctor.availability });
});

/**
 * DELETE /doctors/:id
 */
export const deleteDoctor = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findByIdAndDelete(req.params.id);
  if (!doctor) throw new ApiError(404, 'Doctor not found.');
  return noContent(res);
});

export const doctorController = {
  getDashboard,
  getDoctors,
  getDoctorById,
  getMyProfile,
  createDoctor,
  updateDoctor,
  toggleDoctorStatus,
  deleteDoctor,
};

export default doctorController;
